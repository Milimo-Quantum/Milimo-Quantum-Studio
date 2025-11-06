import { GoogleGenAI, FunctionDeclaration, Type, HarmCategory, HarmBlockThreshold, Content } from "@google/genai";
import type { AIResponse, AgentStatusUpdate, PlacedGate, AIAction, Message } from "../types";
import { gateMap } from "../data/gates";

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const model = 'gemini-2.5-pro';

// --- Function Declarations for Gemini ---
const gateIds = Array.from(gateMap.keys());

const addGateTool: FunctionDeclaration = {
  name: 'add_gate',
  description: 'Adds a single quantum gate to a specific qubit on the circuit.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      gateId: {
        type: Type.STRING,
        description: 'The ID of the gate to add.',
        enum: gateIds,
      },
      qubit: {
        type: Type.INTEGER,
        description: 'The index of the qubit to apply the gate to (e.g., 0, 1, 2).',
      },
      controlQubit: {
        type: Type.INTEGER,
        description: 'For controlled gates like CNOT, the index of the control qubit. Must be provided for CNOT gates.',
      },
      left: {
        type: Type.NUMBER,
        description: 'The horizontal position of the gate on the circuit, as a percentage from the left (0-100).',
      },
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
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

const generateCodeTool: FunctionDeclaration = {
  name: 'generate_code',
  description: 'Generates the Qiskit Python code for the current circuit and displays it to the user.',
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};


const SYSTEM_INSTRUCTION = `You are Milimo AI, an expert quantum circuit design assistant integrated into a web IDE.
- Your primary goal is to help the user build, understand, and optimize quantum circuits.
- You MUST use the provided tools ('add_gate', 'replace_circuit', 'clear_circuit', 'generate_code') to perform actions. Do not describe changes in text without calling the appropriate tool.
- When the user asks to "see the code" or "generate the qiskit code", use the 'generate_code' tool. Then, provide a brief explanation of the code.
- When the user asks to create a state (e.g., "create a bell state"), design the circuit using the tools.
- When asked to optimize, analyze the provided circuit and use the 'replace_circuit' tool if a more efficient version is possible.
- After using tools, provide a brief, friendly, and informative explanation of the action you took.
- If the user asks a question that doesn't require circuit modification, provide a helpful textual answer.
- The circuit has 3 qubits, indexed 0, 1, and 2.
- The 'left' parameter for gates is a percentage (0-100) and represents the order of operations. Gates with smaller 'left' values are applied first. Choose sensible, spaced-out values (e.g., 20, 40, 60).
- For CNOT gates, you MUST specify both 'qubit' (target) and 'controlQubit'.`;


/**
 * Gets a response from the Gemini model based on conversation history and current circuit state.
 * @param allMessages The entire message history.
 * @param currentCircuit The current state of the quantum circuit.
 * @param onStatusUpdate A callback to stream agent status updates to the UI.
 * @returns A promise that resolves to an AIResponse object with actions and text.
 */
export const getAgentResponse = async (
  allMessages: Message[],
  currentCircuit: PlacedGate[],
  onStatusUpdate: (update: AgentStatusUpdate) => void
): Promise<AIResponse> => {
  onStatusUpdate({ agent: 'Orchestrator', status: 'running', message: 'Analyzing request...' });
  
  const history: Content[] = allMessages
    .filter((m): m is Message & { type: 'text' } => m.type === 'text')
    .map(m => ({
      role: m.sender === 'ai' ? 'model' : 'user',
      parts: [{ text: m.text }],
    }));

  // The last message is the current prompt.
  const userPrompt = history.pop();
  if (!userPrompt) {
    return { displayText: 'An error occurred.', actions: [] };
  }

  // Prepend the current circuit state to the user's prompt for context.
  const promptWithContext = `Current circuit state (do not repeat this in your response): ${JSON.stringify(currentCircuit)}\n\nUser request: ${userPrompt.parts[0].text}`;
  userPrompt.parts[0].text = promptWithContext;

  const response = await ai.models.generateContent({
    model,
    contents: [...history, userPrompt],
    config: {
        tools: [{ functionDeclarations: [addGateTool, replaceCircuitTool, clearCircuitTool, generateCodeTool] }],
    },
    systemInstruction: SYSTEM_INSTRUCTION
  });

  onStatusUpdate({ agent: 'Orchestrator', status: 'completed', message: 'Plan generated.' });

  const actions: AIAction[] = [];
  let displayText = "";

  if (response.functionCalls && response.functionCalls.length > 0) {
    onStatusUpdate({ agent: 'Design', status: 'running', message: 'Applying circuit modifications...' });
    for (const funcCall of response.functionCalls) {
      if (funcCall.name === 'add_gate' && funcCall.args) {
        actions.push({ type: 'add_gate', payload: funcCall.args as any });
      } else if (funcCall.name === 'replace_circuit' && funcCall.args) {
        actions.push({ type: 'replace_circuit', payload: (funcCall.args as any).gates });
      } else if (funcCall.name === 'clear_circuit') {
        actions.push({ type: 'clear_circuit', payload: null });
      } else if (funcCall.name === 'generate_code') {
        actions.push({ type: 'generate_code', payload: null });
      }
    }
     onStatusUpdate({ agent: 'Design', status: 'completed', message: 'Modifications ready.' });
  }

  onStatusUpdate({ agent: 'Explanation', status: 'running', message: 'Generating explanation...' });
  displayText = response.text || "I've performed the requested action.";
  onStatusUpdate({ agent: 'Explanation', status: 'completed', message: 'Explanation ready.' });
  
  return {
    displayText,
    actions
  };
};


/**
 * Generates syntax-highlighted Qiskit code from the placed gates.
 * @param placedGates The array of gates on the circuit.
 * @returns An HTML string of the generated code.
 */
export const generateQiskitCode = (placedGates: PlacedGate[]): string => {
    const sortedGates = [...placedGates].sort((a, b) => a.left - b.left);
    const numQubits = sortedGates.reduce((max, g) => Math.max(max, g.qubit, g.controlQubit ?? -1), 0) + 1;

    let code = '';
    code += `from qiskit import QuantumCircuit\n\n`;
    code += `# Create a quantum circuit with ${numQubits} qubits\n`;
    code += `qc = QuantumCircuit(${numQubits})\n\n`;

    if (sortedGates.length > 0) {
        code += `# Add gates to the circuit\n`;
    }

    for (const gate of sortedGates) {
        switch (gate.gateId) {
            case 'h':
                code += `qc.h(${gate.qubit})\n`;
                break;
            case 'x':
                code += `qc.x(${gate.qubit})\n`;
                break;
            case 'cnot':
                if (gate.controlQubit !== undefined) {
                    code += `qc.cx(${gate.controlQubit}, ${gate.qubit})\n`;
                }
                break;
            case 'measure':
                // In Qiskit, measurement requires a classical bit as well.
                // We'll assume a 1-to-1 mapping for simplicity.
                code += `qc.measure(${gate.qubit}, ${gate.qubit})\n`;
                break;
        }
    }
    
    // Simple syntax highlighting
    return code
        .replace(/(from|import|as)/g, '<span class="text-purple-400">$&</span>')
        .replace(/(QuantumCircuit)/g, '<span class="text-sky-400">$&</span>')
        .replace(/\b(qc)\b/g, '<span class="text-yellow-400">$&</span>')
        .replace(/(\.h\(|\.x\(|\.cx\(|\.measure\()/g, '<span class="text-cyan-400">$&</span>')
        .replace(/(#.*)/g, '<span class="text-gray-500">$&</span>');
};