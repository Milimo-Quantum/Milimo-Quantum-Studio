import { GoogleGenAI, FunctionDeclaration, Type, Content, Part } from "@google/genai";
import type { AIResponse, AgentStatusUpdate, PlacedGate, AIAction, Message, SimulationResult, ReplaceCircuitPayload, Source, AddGatePayload } from "../types";
import { gateMap, gates } from "../data/gates";
import { ANALYZE_PROMPT } from "../App";

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


const designTools = [addGateTool, replaceCircuitTool, getSimulationResultsTool];

const orchestratorSystemInstruction = (numQubits: number) => `You are the Orchestrator for Milimo AI, a team of specialized quantum AI agents. Your job is to analyze the user's request and current circuit context, assess its implied complexity and intent, and then generate a high-quality research prompt for the Research Agent.

**Current Canvas State:**
- The circuit has ${numQubits} qubits available (indexed 0 to ${numQubits - 1}).

**Circuit Context (if provided):**
If the user's prompt begins with a circuit description like "Circuit description: [...]", you MUST use that information as the primary context for your analysis.

**Your Core Directives:**
1.  **Analyze Intent:** Do not just take the user's words literally. Infer their goal. A request for "quantum communication for advanced spacecrafts" is NOT a request for a basic Bell State. It's a request for something robust, advanced, and context-specific.
2.  **Scale Complexity:** If the user's prompt implies a need for an advanced solution, your research prompt MUST reflect that. Ask for specific, named protocols (like Shor's Algorithm, BB84, Quantum Error Correction), not just "fundamental" concepts.
3.  **Activate Research or Design:**
    *   **Research Agent**: For requests that are abstract, creative, high-level, or require external knowledge (e.g., "build a circuit for quantum communication in spacecrafts", "what is quantum error correction?", "show me something for a quantum sensor"). Your output prompt should be a detailed research query.
    *   **Design Agent**: For requests that are concrete and specific (e.g., "put a hadamard on qubit 0", "what's the probability of |101>?"). Your output prompt should be a direct command.

**Example 1: Advanced, Abstract Request (on a 3-qubit canvas)**
User Prompt: "build a circuit which can be used in quantum entangle communication in space crafts"
Your Response (JSON):
{
  "agent_to_call": "Research",
  "reasoning": "The user's request implies a need for a robust, advanced protocol suitable for a specific, high-stakes application. A basic Bell state is insufficient. I will task the Research Agent to find a more appropriate, named algorithm like an error correction code or a secure communication protocol that can be demonstrated on the available ${numQubits} qubits.",
  "prompt_for_next_agent": "Research specific, advanced quantum communication protocols beyond a simple Bell state, such as those used for error correction or secure communication (like the BB84 protocol), which would be relevant for a robust application like spacecraft communication. Provide a step-by-step guide to build a representative circuit for the chosen protocol on a ${numQubits}-qubit system."
}

**Example 2: Simple, Concrete Request (on a 3-qubit canvas)**
User Prompt: "Make a GHZ state and then tell me the probability of measuring |000>"
Your Response (JSON):
{
  "agent_to_call": "Design",
  "reasoning": "The user's request is specific and involves direct circuit manipulation and simulation data retrieval, which are tasks for the Design agent on the current ${numQubits}-qubit canvas.",
  "prompt_for_next_agent": "First, build a ${numQubits}-qubit GHZ state from scratch using a Hadamard gate and CNOT gates. Then, use the 'get_simulation_results' tool to find the probability of the |${'0'.repeat(numQubits)}> state. Finally, report this probability to the user."
}`;

const orchestratorSchema = {
    type: Type.OBJECT,
    properties: {
        agent_to_call: { type: Type.STRING, enum: ['Research', 'Design'] },
        reasoning: { type: Type.STRING },
        prompt_for_next_agent: { type: Type.STRING },
    },
    required: ['agent_to_call', 'reasoning', 'prompt_for_next_agent'],
};

const designAgentSystemInstruction = (numQubits: number, researchContext: string = '') => `You are the Design Agent for Milimo AI, a master quantum circuit builder. Your purpose is to translate user requests and research findings into a concrete quantum circuit on the canvas.

**Circuit Constraints:**
- The circuit has ${numQubits} qubits (indexed 0 to ${numQubits - 1}).
- The 'left' parameter (0-100) dictates gate order. Choose sensible, spaced-out values (e.g., 20, 40, 60).
- For controlled gates, you MUST specify both 'qubit' (target) and 'controlQubit'.

**Available Components:**
${gates.map(g => `- **${g.name} (gateId: '${g.id}')**: ${g.description}`).join('\n')}

**Core Directive:**
- **BUILD FROM SCRATCH:** You MUST construct all circuits from first principles using the 'replace_circuit' or 'add_gate' tools. You have full knowledge of all available gates.
- **EXECUTE PRECISELY:** Execute the user's request or the research findings with precision.
- **USE YOUR TOOLS:** If you need to answer a question about the circuit's output (e.g., "what's the probability of measuring |101>?"), you MUST use the 'get_simulation_results' tool.
- **PRIORITIZE 'replace_circuit'**: For building new states, using 'replace_circuit' is preferred to ensure the canvas is clean.

${researchContext ? `**Research Context:**\nA Research Agent has provided the following information. You MUST use this context to synthesize and build the most appropriate and complete circuit possible.\n---\n${researchContext}\n---` : ''}`;

const explanationAgentSystemInstruction = `You are the Explanation Agent for Milimo AI. Your job is to provide a final, user-facing response that is clear, concise, and helpful. You will receive the user's initial prompt, the results of any research, and a summary of the actions taken by the Design Agent. Synthesize all this information into a single, cohesive answer. Explain WHAT was built and WHY it's relevant to the user's original request. Be specific and reference the concepts from the research.`;


export const getAgentResponse = async (
  allMessages: Message[],
  currentCircuit: PlacedGate[],
  simulationResult: SimulationResult | null,
  numQubits: number,
  onStatusUpdate: (update: AgentStatusUpdate) => void
): Promise<AIResponse> => {
  onStatusUpdate({ agent: 'Orchestrator', status: 'running', message: 'Analyzing request...' });
  
  const lastUserMessage = [...allMessages].reverse().find(m => m.type === 'text' && m.sender === 'user');
  let userPromptText = (lastUserMessage && lastUserMessage.type === 'text') ? lastUserMessage.text : '';

  if (userPromptText === ANALYZE_PROMPT) {
      if (currentCircuit.length > 0) {
        const circuitDescription = currentCircuit.map(g => {
            const gateName = gateMap.get(g.gateId)?.name || g.gateId;
            let description = `${gateName} on q[${g.qubit}]`;
            if (g.controlQubit !== undefined) {
                description += ` controlled by q[${g.controlQubit}]`;
            }
            return description;
        }).join('; ');
        userPromptText = `The user wants to analyze the current circuit. Circuit description: [${circuitDescription}].\n\nUser's request: ${userPromptText}`;
      } else {
         return { displayText: "The circuit is empty. Add some gates and I'll be happy to analyze it for you!", actions: [] };
      }
  }


  // 1. Orchestrator Agent: Decide which agent to call next
  const orchestratorResponse = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: userPromptText }] }],
    config: { 
        systemInstruction: orchestratorSystemInstruction(numQubits),
        responseMimeType: 'application/json',
        responseSchema: orchestratorSchema
    }
  });

  let orchestratorDecision;
  try {
      orchestratorDecision = JSON.parse(orchestratorResponse.text);
  } catch (e) {
      return { displayText: "I'm sorry, I had trouble understanding that request. Could you please rephrase?", actions: [] };
  }

  if (!orchestratorDecision.prompt_for_next_agent || !orchestratorDecision.prompt_for_next_agent.trim()) {
    return { displayText: "I'm sorry, I couldn't determine the next step. Could you be more specific?", actions: [] };
  }

  onStatusUpdate({ agent: 'Orchestrator', status: 'completed', message: 'Plan generated.' });

  let researchContext = '';
  let sources: Source[] | undefined = undefined;

  // 2. Research Agent (Optional)
  if (orchestratorDecision.agent_to_call === 'Research') {
    onStatusUpdate({ agent: 'Research', status: 'running', message: 'Researching advanced protocols...' });
    
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
  onStatusUpdate({ agent: 'Design', status: 'running', message: 'Constructing circuit from scratch...' });
  const actions: AIAction[] = [];
  const designPrompt = orchestratorDecision.agent_to_call === 'Design' 
    ? orchestratorDecision.prompt_for_next_agent 
    : researchContext; // If research was done, the entire context IS the prompt.
  
  const designResponse = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: designPrompt }] }],
      config: { 
        tools: [{ functionDeclarations: designTools }],
        systemInstruction: designAgentSystemInstruction(numQubits, researchContext)
      },
  });
  
  const conversationHistory: Content[] = [
      { role: 'user', parts: [{ text: designPrompt }] },
      designResponse.candidates[0].content // The model's first response (text + function calls)
  ];
  
  const finalUserParts: Part[] = [];

  if (designResponse.functionCalls && designResponse.functionCalls.length > 0) {
      const toolFunctionResponses: Part[] = [];
      for (const funcCall of designResponse.functionCalls) {
          let toolResponse: Record<string, unknown> | null = null;
          switch(funcCall.name) {
              case 'add_gate':
                  actions.push({ type: 'add_gate', payload: funcCall.args as AddGatePayload });
                  toolResponse = { result: "ok, gate added" };
                  break;
              case 'replace_circuit':
                  actions.push({ type: 'replace_circuit', payload: (funcCall.args as any).gates });
                  toolResponse = { result: "ok, circuit replaced" };
                  break;
              case 'get_simulation_results':
                  toolResponse = { result: simulationResult ? JSON.stringify(simulationResult.probabilities) : "No simulation data." };
                  break;
          }
          if(toolResponse) {
               toolFunctionResponses.push({ functionResponse: { name: funcCall.name, response: toolResponse } });
          }
      }
      finalUserParts.push(...toolFunctionResponses);
  }
  onStatusUpdate({ agent: 'Design', status: 'completed', message: 'Circuit built.' });
  
  // 4. Explanation Agent
  onStatusUpdate({ agent: 'Explanation', status: 'running', message: 'Generating explanation...' });
  
  const explanationContext = `The user's original request was: "${userPromptText}".
  ${researchContext ? `Research found: "${researchContext}"` : ''}
  The design agent took the following actions: ${actions.map(a => a.type).join(', ') || 'None'}.
  Based on all this information, provide a comprehensive, final explanation for the user. Synthesize everything into a single, cohesive answer. Explain WHAT was built and WHY it's relevant to the user's original request.`;

  finalUserParts.push({ text: explanationContext });
  
  // Consolidate parts for the next user turn
  const nextUserTurn: Content = { role: 'user', parts: finalUserParts };
  if (finalUserParts.length > 0) {
    conversationHistory.push(nextUserTurn);
  }


  const explanationResponse = await ai.models.generateContent({
      model,
      contents: conversationHistory,
      config: {
        systemInstruction: explanationAgentSystemInstruction,
      },
  });

  const displayText = explanationResponse.text;
  onStatusUpdate({ agent: 'Explanation', status: 'completed', message: 'Response ready.' });
  
  return { displayText, actions, sources };
};

// --- SOTA FIX: Refactored to be data-driven, robust, and scalable ---
const qiskitMethodMap: Record<string, (g: PlacedGate) => string | null> = {
  'h': g => `qc.h(${g.qubit})`,
  'x': g => `qc.x(${g.qubit})`,
  'y': g => `qc.y(${g.qubit})`,
  'z': g => `qc.z(${g.qubit})`,
  's': g => `qc.s(${g.qubit})`,
  'sdg': g => `qc.sdg(${g.qubit})`,
  't': g => `qc.t(${g.qubit})`,
  'tdg': g => `qc.tdg(${g.qubit})`,
  'cnot': g => g.controlQubit !== undefined ? `qc.cx(${g.controlQubit}, ${g.qubit})` : null,
  'cz': g => g.controlQubit !== undefined ? `qc.cz(${g.controlQubit}, ${g.qubit})` : null,
  'swap': g => g.controlQubit !== undefined ? `qc.swap(${g.qubit}, ${g.controlQubit})` : null,
  'measure': g => `qc.measure(${g.qubit}, ${g.qubit})`,
};

const methodNames = Object.keys(qiskitMethodMap).join('|').replace('cnot', 'cx'); // use 'cx' for highlighting

export const generateQiskitCode = (placedGates: PlacedGate[], numQubits: number): string => {
    const sortedGates = [...placedGates].sort((a, b) => a.left - b.left);
    
    let code = `from qiskit import QuantumCircuit\n\n`;
    code += `# Create a quantum circuit with ${numQubits} qubits\n`;
    code += `qc = QuantumCircuit(${numQubits})\n\n`;

    if (sortedGates.length > 0) code += `# Add gates to the circuit\n`;
    
    for (const gate of sortedGates) {
        const generator = qiskitMethodMap[gate.gateId];
        if (generator) {
            const line = generator(gate);
            if(line) code += line + '\n';
        }
    }
    
    // Dynamically build highlighting regex for maintainability
    const methodRegex = new RegExp(`(\\.(?:${methodNames})\\()`, 'g');

    return code
        .replace(/(from|import|as)/g, '<span class="text-purple-400">$&</span>')
        .replace(/(QuantumCircuit)/g, '<span class="text-sky-400">$&</span>')
        .replace(/\b(qc)\b/g, '<span class="text-yellow-400">$&</span>')
        .replace(methodRegex, '<span class="text-cyan-400">$&</span>')
        .replace(/(#.*)/g, '<span class="text-gray-500">$&</span>');
};
