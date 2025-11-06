import { GoogleGenAI, FunctionDeclaration, Type, Content, Part, FunctionCall } from "@google/genai";
// FIX: Import the missing 'ReplaceCircuitPayload' type.
import type { AIResponse, AgentStatusUpdate, PlacedGate, AIAction, Message, SimulationResult, AddGatePayload, ReplaceCircuitPayload } from "../types";
import { gateMap } from "../data/gates";
import { templates, templateMap } from "../data/circuitTemplates";

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const model = 'gemini-2.5-pro';

// --- Function Declarations for Gemini ---
const gateIds = Array.from(gateMap.keys());
const templateIds = Array.from(templateMap.keys());

const addGateTool: FunctionDeclaration = {
  name: 'add_gate',
  description: 'Adds a single quantum gate to a specific qubit on the circuit.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      gateId: { type: Type.STRING, description: 'The ID of the gate to add.', enum: gateIds },
      qubit: { type: Type.INTEGER, description: 'The index of the qubit to apply the gate to (e.g., 0, 1, 2).' },
      controlQubit: { type: Type.INTEGER, description: 'For controlled gates (cnot, cz, swap), this is the index of the other qubit involved.' },
      left: { type: Type.NUMBER, description: 'The horizontal position of the gate on the circuit, as a percentage from the left (0-100).' },
    },
    required: ['gateId', 'qubit', 'left'],
  },
};

const replaceCircuitTool: FunctionDeclaration = {
  name: 'replace_circuit',
  description: 'Replaces the entire existing circuit with a new set of gates. This is useful for complex operations like optimization or creating a completely new state.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      gates: {
        type: Type.ARRAY,
        description: 'An array of gate objects to form the new circuit.',
        items: {
          type: Type.OBJECT,
          properties: {
            gateId: { type: Type.STRING, enum: gateIds },
            qubit: { type: Type.INTEGER },
            controlQubit: { type: Type.INTEGER },
            left: { type: Type.NUMBER },
          },
          required: ['gateId', 'qubit', 'left'],
        }
      }
    },
    required: ['gates']
  }
};

const clearCircuitTool: FunctionDeclaration = {
  name: 'clear_circuit',
  description: 'Removes all gates from the circuit.',
  parameters: { type: Type.OBJECT, properties: {} },
};

const generateCodeTool: FunctionDeclaration = {
  name: 'generate_code',
  description: 'Generates the Qiskit Python code for the current circuit and displays it to the user.',
  parameters: { type: Type.OBJECT, properties: {} },
};

const getSimulationResultsTool: FunctionDeclaration = {
    name: 'get_simulation_results',
    description: "Retrieves the current simulation's outcome, including measurement probabilities for each state. Use this to answer questions about the circuit's output.",
    parameters: { type: Type.OBJECT, properties: {} }
};

const loadTemplateTool: FunctionDeclaration = {
    name: 'load_template',
    description: "Loads a predefined quantum circuit template onto the canvas. Use this as a starting point for common algorithms or states.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            templateId: { type: Type.STRING, description: "The ID of the template to load.", enum: templateIds }
        },
        required: ['templateId']
    }
}

const getSystemInstruction = (numQubits: number) => `You are Milimo AI, an expert quantum circuit design assistant integrated into a web IDE.
- Your primary goal is to help the user build, understand, and optimize quantum circuits.
- You MUST use the provided tools to perform actions. Do not describe changes in text without calling the appropriate tool.
- When the user asks to "see the code", use the 'generate_code' tool, then briefly explain it.
- To answer questions about circuit results (e.g., "what's the probability of measuring |101>?"), you MUST use the 'get_simulation_results' tool first, then interpret the data in your answer.
- You can load predefined circuits using 'load_template'. Suggest this when a user asks for a common state like an entangled state ('bell_state') or GHZ state ('ghz_state').
- After using tools, provide a brief, friendly explanation of the action you took.
- The circuit has ${numQubits} qubits (0 to ${numQubits - 1}). Ensure all 'qubit' and 'controlQubit' values are within this range.
- The 'left' parameter (0-100) dictates gate order. Choose sensible, spaced-out values (e.g., 20, 40, 60).
- For controlled gates (cnot, cz, swap), you MUST specify both 'qubit' and 'controlQubit'.`;


export const getAgentResponse = async (
  allMessages: Message[],
  currentCircuit: PlacedGate[],
  simulationResult: SimulationResult | null,
  numQubits: number,
  onStatusUpdate: (update: AgentStatusUpdate) => void
): Promise<AIResponse> => {
  onStatusUpdate({ agent: 'Orchestrator', status: 'running', message: 'Analyzing request...' });
  
  const history: Content[] = allMessages
    .filter((m): m is Message & { type: 'text' } => m.type === 'text')
    .map(m => ({
      role: m.sender === 'ai' ? 'model' : 'user',
      parts: [{ text: m.text }],
    }));

  const userPrompt = history.pop();
  if (!userPrompt) return { displayText: 'An error occurred.', actions: [] };

  const promptWithContext = `Current circuit: ${JSON.stringify(currentCircuit)}\n\nUser request: ${userPrompt.parts[0].text}`;
  userPrompt.parts[0].text = promptWithContext;

  const initialResponse = await ai.models.generateContent({
    model,
    contents: [...history, userPrompt],
    config: {
        tools: [{ functionDeclarations: [addGateTool, replaceCircuitTool, clearCircuitTool, generateCodeTool, getSimulationResultsTool, loadTemplateTool] }],
    },
    systemInstruction: getSystemInstruction(numQubits)
  });

  onStatusUpdate({ agent: 'Orchestrator', status: 'completed', message: 'Plan generated.' });

  const actions: AIAction[] = [];
  let displayText = initialResponse.text || "I've performed the requested action.";

  if (initialResponse.functionCalls && initialResponse.functionCalls.length > 0) {
    onStatusUpdate({ agent: 'Design', status: 'running', message: 'Executing tools...' });
    
    const functionCallPart: Part = { functionCall: initialResponse.functionCalls[0] }; // This is simplified; real use might have multiple
    const toolResponses: Part[] = [];

    for (const funcCall of initialResponse.functionCalls) {
        let toolResponse: object | null = null;
        switch(funcCall.name) {
            case 'add_gate':
                actions.push({ type: 'add_gate', payload: funcCall.args as any });
                toolResponse = { result: "ok" };
                break;
            case 'replace_circuit':
                actions.push({ type: 'replace_circuit', payload: (funcCall.args as any).gates });
                toolResponse = { result: "ok" };
                break;
            case 'clear_circuit':
                actions.push({ type: 'clear_circuit', payload: null });
                toolResponse = { result: "ok" };
                break;
            case 'generate_code':
                actions.push({ type: 'generate_code', payload: null });
                toolResponse = { result: "ok" };
                break;
            case 'load_template':
                const template = templateMap.get((funcCall.args as any).templateId);
                if (template) {
                    actions.push({ type: 'replace_circuit', payload: template.gates as ReplaceCircuitPayload });
                }
                toolResponse = { result: "ok" };
                break;
            case 'get_simulation_results':
                toolResponse = { result: simulationResult ? JSON.stringify(simulationResult.probabilities) : "No simulation data available." };
                break;
        }

        if(toolResponse) {
             toolResponses.push({
                toolResponse: {
                    name: funcCall.name,
                    response: toolResponse,
                }
            });
        }
    }
    
    onStatusUpdate({ agent: 'Design', status: 'completed', message: 'Modifications ready.' });
    
    // If there were any tool calls, especially ones that require a textual response,
    // send the results back to the model to generate the final display text.
    if(toolResponses.length > 0) {
        onStatusUpdate({ agent: 'Explanation', status: 'running', message: 'Generating explanation...' });
        
        const secondResponse = await ai.models.generateContent({
            model,
            contents: [...history, userPrompt, functionCallPart, ...toolResponses]
        });
        displayText = secondResponse.text || "I've performed the requested actions.";
        onStatusUpdate({ agent: 'Explanation', status: 'completed', message: 'Explanation ready.' });
    }

  } else {
     onStatusUpdate({ agent: 'Explanation', status: 'running', message: 'Generating response...' });
     onStatusUpdate({ agent: 'Explanation', status: 'completed', message: 'Response ready.' });
  }
  
  return { displayText, actions };
};

export const generateQiskitCode = (placedGates: PlacedGate[], numQubits: number): string => {
    const sortedGates = [...placedGates].sort((a, b) => a.left - b.left);
    
    let code = `from qiskit import QuantumCircuit\n\n`;
    code += `# Create a quantum circuit with ${numQubits} qubits\n`;
    code += `qc = QuantumCircuit(${numQubits})\n\n`;

    if (sortedGates.length > 0) code += `# Add gates to the circuit\n`;
    
    for (const gate of sortedGates) {
        const { gateId, qubit, controlQubit } = gate;
        switch (gateId) {
            case 'h':
            case 'x':
            case 'y':
            case 'z':
            case 's':
            case 't':
                code += `qc.${gateId}(${qubit})\n`;
                break;
            case 'sdg':
            case 'tdg':
                 code += `qc.${gateId}(${qubit})\n`;
                 break;
            case 'cnot':
                if (controlQubit !== undefined) code += `qc.cx(${controlQubit}, ${qubit})\n`;
                break;
            case 'cz':
                if (controlQubit !== undefined) code += `qc.cz(${controlQubit}, ${qubit})\n`;
                break;
            case 'swap':
                if (controlQubit !== undefined) code += `qc.swap(${qubit}, ${controlQubit})\n`;
                break;
            case 'measure':
                code += `qc.measure(${qubit}, ${qubit})\n`;
                break;
        }
    }
    
    return code
        .replace(/(from|import|as)/g, '<span class="text-purple-400">$&</span>')
        .replace(/(QuantumCircuit)/g, '<span class="text-sky-400">$&</span>')
        .replace(/\b(qc)\b/g, '<span class="text-yellow-400">$&</span>')
        .replace(/(\.(?:h|x|y|z|s|sdg|t|tdg|cx|cz|swap|measure)\()/g, '<span class="text-cyan-400">$&</span>')
        .replace(/(#.*)/g, '<span class="text-gray-500">$&</span>');
};