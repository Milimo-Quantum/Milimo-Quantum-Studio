import { GoogleGenAI, FunctionDeclaration, Type, Content, Part } from "@google/genai";
import type { AIResponse, AgentStatusUpdate, PlacedGate, AIAction, Message, SimulationResult, ReplaceCircuitPayload, Source } from "../types";
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
  parameters: {
    type: Type.OBJECT,
    properties: {
      gateId: { type: Type.STRING, enum: gateIds },
      qubit: { type: Type.INTEGER },
      controlQubit: { type: Type.INTEGER },
      left: { type: Type.NUMBER },
    },
    required: ['gateId', 'qubit', 'left'],
  },
};

const replaceCircuitTool: FunctionDeclaration = {
  name: 'replace_circuit',
  parameters: {
    type: Type.OBJECT,
    properties: {
      gates: {
        type: Type.ARRAY,
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

const getSimulationResultsTool: FunctionDeclaration = {
    name: 'get_simulation_results',
    parameters: { type: Type.OBJECT, properties: {} }
};

const loadTemplateTool: FunctionDeclaration = {
    name: 'load_template',
    parameters: {
        type: Type.OBJECT,
        properties: {
            templateId: { type: Type.STRING, enum: templateIds }
        },
        required: ['templateId']
    }
}

const designTools = [addGateTool, replaceCircuitTool, getSimulationResultsTool, loadTemplateTool];

const orchestratorSystemInstruction = `You are the Orchestrator for Milimo AI, a team of specialized quantum AI agents. Your job is to analyze the user's request and the current application state, then decide which agent needs to be called to fulfill the request.

You have two primary agents you can activate:
1.  **Research Agent**: For requests that are abstract, creative, high-level, or require external knowledge (e.g., "build a circuit for quantum communication in spacecrafts", "what is quantum error correction?", "show me something for a quantum sensor").
2.  **Design Agent**: For requests that are concrete, specific, and can be immediately translated into a circuit diagram (e.g., "create a bell state", "put a hadamard on qubit 0", "what's the probability of |101>?", "load the GHZ template").

Based on the user's prompt, you must respond with a single JSON object with your decision.

**Decision Schema:**
{
  "agent_to_call": "Research" | "Design",
  "reasoning": "A brief explanation for your choice.",
  "prompt_for_next_agent": "The refined prompt to pass to the chosen agent."
}

Example 1:
User Prompt: "build a circuit which can be used in quantum entangle communication in space crafts"
Your Response:
{
  "agent_to_call": "Research",
  "reasoning": "The user's request is abstract and requires external knowledge about quantum communication protocols used in specific applications like spacecrafts. The Research agent needs to find the most relevant real-world algorithm or principle first.",
  "prompt_for_next_agent": "Find the most fundamental quantum circuit or algorithm used for quantum entanglement communication, suitable for applications like spacecraft. Explain the principle and provide a step-by-step guide on how to build the circuit."
}

Example 2:
User Prompt: "Make a GHZ state and then tell me the probability of measuring |000>"
Your Response:
{
  "agent_to_call": "Design",
  "reasoning": "The user's request is specific and involves direct circuit manipulation and simulation data retrieval, which are tasks for the Design agent.",
  "prompt_for_next_agent": "First, load the 'ghz_state' template. Then, use the 'get_simulation_results' tool to find the probability of the |000> state. Finally, report this probability to the user."
}`;

const designAgentSystemInstruction = (numQubits: number, researchContext: string = '') => `You are the Design Agent for Milimo AI. Your purpose is to translate user requests and research findings into a concrete quantum circuit on the canvas using your available tools.

**Circuit Constraints:**
- The circuit has ${numQubits} qubits (indexed 0 to ${numQubits - 1}).
- The 'left' parameter (0-100) dictates gate order. Choose sensible, spaced-out values (e.g., 20, 40, 60).
- For controlled gates, you MUST specify both 'qubit' and 'controlQubit'.

**Core Directive:**
- Execute the user's request precisely using your tools.
- If you need to answer a question about the circuit's output (e.g., "what's the probability of measuring |101>?"), you MUST use the 'get_simulation_results' tool.
- If the user asks for a named circuit, check if a template exists and use 'load_template' if it does. Otherwise, build it from scratch.
- Prioritize using 'replace_circuit' for building new states to ensure the canvas is clean.

${researchContext ? `**Research Context:**\nA Research Agent has provided the following information. You MUST use this context to inform your circuit design.\n---\n${researchContext}\n---` : ''}`;

const explanationAgentSystemInstruction = `You are the Explanation Agent for Milimo AI. Your job is to provide a final, user-facing response that is clear, concise, and helpful. You will receive the user's initial prompt, the results of any research, and a summary of the actions taken by the Design Agent. Synthesize all this information into a single, cohesive answer. Explain WHAT was built and WHY it's relevant to the user's original request.`;


export const getAgentResponse = async (
  allMessages: Message[],
  currentCircuit: PlacedGate[],
  simulationResult: SimulationResult | null,
  numQubits: number,
  onStatusUpdate: (update: AgentStatusUpdate) => void
): Promise<AIResponse> => {
  onStatusUpdate({ agent: 'Orchestrator', status: 'running', message: 'Analyzing request...' });
  
  // FIX: Replace findLast with a compatible alternative for older JS targets.
  const lastUserMessage = [...allMessages].reverse().find(m => m.type === 'text' && m.sender === 'user');
  const userPromptText = (lastUserMessage && lastUserMessage.type === 'text') ? lastUserMessage.text : '';

  // 1. Orchestrator Agent: Decide which agent to call next
  const orchestratorResponse = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: userPromptText }] }],
    config: { responseMimeType: 'application/json' }
  });

  let orchestratorDecision;
  try {
      orchestratorDecision = JSON.parse(orchestratorResponse.text);
  } catch (e) {
      // Fallback for non-JSON response
      return { displayText: "I'm sorry, I had trouble understanding that request. Could you please rephrase?", actions: [] };
  }

  onStatusUpdate({ agent: 'Orchestrator', status: 'completed', message: 'Plan generated.' });

  let researchContext = '';
  let sources: Source[] | undefined = undefined;

  // 2. Research Agent (Optional)
  if (orchestratorDecision.agent_to_call === 'Research') {
    onStatusUpdate({ agent: 'Research', status: 'running', message: 'Searching for information...' });
    
    const researchResponse = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: orchestratorDecision.prompt_for_next_agent }] }],
      config: { tools: [{ googleSearch: {} }] }
    });
    
    researchContext = researchResponse.text;
    const groundingMetadata = researchResponse.candidates?.[0]?.groundingMetadata;
    if (groundingMetadata?.groundingChunks) {
        sources = groundingMetadata.groundingChunks
            .map(chunk => ({ uri: chunk.web?.uri || '', title: chunk.web?.title || 'Untitled' }))
            .filter(source => source.uri);
    }
    onStatusUpdate({ agent: 'Research', status: 'completed', message: 'Context gathered.' });
  }

  // 3. Design Agent: Always runs, but may have research context
  onStatusUpdate({ agent: 'Design', status: 'running', message: 'Constructing circuit...' });
  const actions: AIAction[] = [];
  const history: Content[] = [];
  const designPrompt = orchestratorDecision.prompt_for_next_agent;
  
  const designResponse = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: designPrompt }] }],
      config: { tools: [{ functionDeclarations: designTools }] },
      systemInstruction: designAgentSystemInstruction(numQubits, researchContext)
  });
  
  const toolResponses: Part[] = [];

  if (designResponse.functionCalls && designResponse.functionCalls.length > 0) {
      for (const funcCall of designResponse.functionCalls) {
          let toolResponse: object | null = null;
          switch(funcCall.name) {
              case 'replace_circuit':
                  actions.push({ type: 'replace_circuit', payload: (funcCall.args as any).gates });
                  toolResponse = { result: "ok, circuit replaced" };
                  break;
              case 'load_template':
                  const template = templateMap.get((funcCall.args as any).templateId);
                  if (template) {
                      actions.push({ type: 'replace_circuit', payload: template.gates as ReplaceCircuitPayload });
                  }
                  toolResponse = { result: `ok, loaded ${template?.name}` };
                  break;
              case 'get_simulation_results':
                  toolResponse = { result: simulationResult ? JSON.stringify(simulationResult.probabilities) : "No simulation data." };
                  break;
          }
          if(toolResponse) {
               toolResponses.push({ toolResponse: { name: funcCall.name, response: toolResponse } });
          }
      }
      history.push({role: 'model', parts: [{ functionCall: designResponse.functionCalls[0] }]});
      history.push({role: 'user', parts: toolResponses});
  }
  onStatusUpdate({ agent: 'Design', status: 'completed', message: 'Circuit built.' });
  
  // 4. Explanation Agent
  onStatusUpdate({ agent: 'Explanation', status: 'running', message: 'Generating explanation...' });
  
  const explanationContext = `The user's original request was: "${userPromptText}".
  ${researchContext ? `Research found: "${researchContext}"` : ''}
  The design agent took the following actions: ${actions.map(a => a.type).join(', ') || 'None'}.
  Please provide a comprehensive explanation for the user.`;

  const finalContents: Content[] = [
    {role: 'user', parts: [{text: designPrompt}]},
    ...history,
    {role: 'user', parts: [{text: explanationContext}]}
  ];

  const explanationResponse = await ai.models.generateContent({
      model,
      contents: finalContents,
      systemInstruction: explanationAgentSystemInstruction,
  });

  const displayText = explanationResponse.text;
  onStatusUpdate({ agent: 'Explanation', status: 'completed', message: 'Response ready.' });
  
  return { displayText, actions, sources };
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