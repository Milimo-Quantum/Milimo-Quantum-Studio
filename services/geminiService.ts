import { GoogleGenAI, FunctionDeclaration, Type, Content, Part } from "@google/genai";
import type { AIResponse, AgentStatusUpdate, PlacedGate, AIAction, Message, SimulationResult, Source, AddGatePayload } from "../types";
import { gateMap, gates } from "../data/gates";
import { ANALYZE_PROMPT } from "../App";

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}
const ai = new GoogleGenAI({ apiKey: API_KEY });
const model = 'gemini-2.5-pro';

// --- Tool Declarations ---
const gateIds = Array.from(gateMap.keys());
const addGateTool: FunctionDeclaration = { name: 'add_gate', parameters: { type: Type.OBJECT, properties: { gateId: { type: Type.STRING, enum: gateIds }, qubit: { type: Type.INTEGER }, controlQubit: { type: Type.INTEGER }, left: { type: Type.NUMBER } }, required: ['gateId', 'qubit', 'left'] } };
const replaceCircuitTool: FunctionDeclaration = { name: 'replace_circuit', parameters: { type: Type.OBJECT, properties: { gates: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { gateId: { type: Type.STRING, enum: gateIds }, qubit: { type: Type.INTEGER }, controlQubit: { type: Type.INTEGER }, left: { type: Type.NUMBER } }, required: ['gateId', 'qubit', 'left'] } } }, required: ['gates'] } };
const getSimulationResultsTool: FunctionDeclaration = { name: 'get_simulation_results', parameters: { type: Type.OBJECT, properties: {} } };
const setQubitCountTool: FunctionDeclaration = { 
  name: 'set_qubit_count', 
  description: "Sets the number of qubits on the canvas. Must be between 2 and 5. **Warning:** This action will clear all existing gates from the circuit.",
  parameters: { type: Type.OBJECT, properties: { qubit_count: { type: Type.INTEGER, description: "The desired number of qubits." } }, required: ['qubit_count'] } 
};
const designTools = [addGateTool, replaceCircuitTool, getSimulationResultsTool, setQubitCountTool];

// --- Agent System Instructions ---
const gateLibrary = gates.map(g => `- **${g.name} (id: '${g.id}', type: ${g.type})**: ${g.description}`).join('\n');

const managerSystemInstruction = (numQubits: number) => `You are the Manager of Milimo AI, a team of specialized quantum AI agents. Your job is to create a robust, multi-step plan to fulfill the user's request with the highest quality.

**Canvas State:** The canvas currently has ${numQubits} qubits (0 to ${numQubits - 1}), but this can be changed to any value between 2 and 5 using the 'set_qubit_count' tool.

**Gate Library:**
${gateLibrary}

**Core Directives:**
1.  **Prioritize the Ideal Solution:** First, determine the best, most advanced, and most appropriate circuit for the user's request, regardless of the current qubit count. THEN, formulate a plan to either build it directly if it fits, or adapt the canvas first if necessary.
2.  **Analyze Intent & Complexity:** Infer the user's true goal. If they use words like "advanced," "SOTA," or "robust," you MUST formulate a plan that delivers a sophisticated result. A request for "advanced spacecraft communication" MUST NOT result in a basic Bell state.
3.  **Encourage Gate Diversity:** Your plan should leverage the full potential of the gate library. If a request involves phase manipulation or state swapping, the plan should guide agents to consider specialized gates like 'cz' or 'swap'.
4.  **Mandatory Quality Assurance:** For any abstract or complex request that requires research, your plan MUST include a 'Critic' step immediately after the 'Research' step. The Critic's job is to prevent "lazy" solutions.
5.  **Formulate the Plan:** Your output MUST be a single JSON object containing a "plan" array.

**Example: Advanced Request**
*User Prompt:* "build a circuit for the 5-qubit error correcting code"
*Your JSON Output:*
{
  "plan": [
    {
      "agent_to_call": "Research",
      "reasoning": "The user has requested a specific, advanced algorithm. I need to verify its structure and qubit requirements before proceeding.",
      "prompt": "Provide the specific gate sequence for the encoding circuit of the 5-qubit perfect error correcting code. Confirm it requires 5 qubits."
    },
    {
      "agent_to_call": "Critic",
      "reasoning": "The Critic will verify that the research is accurate and will formulate a precise, multi-step prompt for the Design agent, including changing the canvas size.",
      "prompt": ""
    },
    {
      "agent_to_call": "Design",
      "reasoning": "The Design agent will construct the circuit for the protocol approved by the Critic.",
      "prompt": ""
    }
  ]
}`;

const managerSchema = {
    type: Type.OBJECT,
    properties: {
        plan: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    agent_to_call: { type: Type.STRING, enum: ['Research', 'Critic', 'Design'] },
                    reasoning: { type: Type.STRING },
                    prompt: { type: Type.STRING },
                },
                required: ['agent_to_call', 'reasoning', 'prompt'],
            }
        }
    },
    required: ['plan'],
};

const criticSystemInstruction = `You are the Critic for Milimo AI, the Quality Assurance agent. Your goal is to evaluate a proposed research finding against the user's original intent to prevent lazy or overly simplistic solutions.

**Gate Library:**
${gateLibrary}

**Core Directives:**
1. **Assess Alignment:** Does the research finding truly address the user's request, especially regarding specified complexity (e.g., "advanced")?
2. **Evaluate Implementation Elegance:** When creating the \`refined_prompt\`, you MUST consider if there is a more direct or elegant way to build the circuit using the full range of available gates. For example, instead of a complex combination of CNOTs and Hadamards to create a Controlled-Z, you MUST instruct the agent to use the 'cz' gate directly.
3. **Manage Canvas Resources:** If the best-researched option requires a different number of qubits than is currently on the canvas (but is still within the 2-5 limit), your 'refined_prompt' for the Design Agent MUST begin with the instruction to change the qubit count using the 'set_qubit_count' tool.
4. **Provide Actionable Feedback:** Your output MUST be a JSON object with \`is_approved\`, \`reasoning\`, and a \`refined_prompt\` for the Design Agent if approved.

**Example:**
*User Request:* "build the 5-qubit error correcting code"
*Research Finding:* "The 5-qubit code requires 5 qubits and a sequence of Hadamard and CNOT gates..."
*Your JSON Output:*
{
  "is_approved": true,
  "reasoning": "The research confirms the user's request is feasible within the 2-5 qubit limit. The plan is approved and the canvas must be resized.",
  "refined_prompt": "First, use the 'set_qubit_count' tool to set the canvas to 5 qubits. Then, construct the encoding circuit for the 5-qubit error correction code using the specific gate sequence found during research."
}`;

const criticSchema = {
    type: Type.OBJECT,
    properties: {
        is_approved: { type: Type.BOOLEAN },
        reasoning: { type: Type.STRING },
        refined_prompt: { type: Type.STRING },
    },
    required: ['is_approved', 'reasoning'],
};

const designAgentSystemInstruction = (numQubits: number) => `You are the Design Agent for Milimo AI, a master quantum circuit builder. Your purpose is to execute a PRE-APPROVED plan from the Manager and Critic.

**Circuit Constraints:**
- The circuit has ${numQubits} qubits (0 to ${numQubits - 1}).
- 'left' parameter (0-100) dictates gate order. Use sensible, spaced-out values (e.g., 20, 40, 60).
- For controlled gates, you MUST specify both 'qubit' (target) and 'controlQubit'.

**Available Components & Tools:**
${gateLibrary}
- **Set Qubit Count (tool: 'set_qubit_count')**: Changes the number of qubits on the canvas (from 2-5). This will clear the board.
- **Get Simulation Results (tool: 'get_simulation_results')**: Retrieves the current state vector and measurement probabilities.

**Core Directive:**
- **EXECUTE PRECISELY:** Your task has been vetted. Do not deviate. You MUST construct the circuit exactly as described in the prompt using the available tools.
- **PRIORITIZE 'replace_circuit'**: For building entire new states from scratch, 'replace_circuit' is preferred to ensure a clean canvas, especially after changing the qubit count.`;

const explanationAgentSystemInstruction = `You are the Explanation Agent for Milimo AI. Your job is to provide a final, user-facing response that synthesizes the entire problem-solving journey.

**Your Input:** A JSON object containing the user's original request, research findings, the critic's reasoning, and a summary of actions taken.

**Core Directive:**
- Weave a cohesive narrative. Do not just list the inputs.
- Explain WHAT was built on the canvas.
- Crucially, explain WHY it was built, referencing the user's intent and the critic's decision-making process (e.g., "To build this more advanced circuit, we first increased the number of qubits to 5...").
- If web sources were used, mention them.
- Format your response for clarity using Markdown (bolding, lists, etc.).`;


// The main function that orchestrates the agent workflow.
export const getAgentResponse = async (
  allMessages: Message[],
  currentCircuit: PlacedGate[],
  simulationResult: SimulationResult | null,
  numQubits: number,
  onStatusUpdate: (update: AgentStatusUpdate) => void
): Promise<AIResponse> => {
    
    // 1. Determine the user's prompt
    const lastUserMessage = [...allMessages].reverse().find(m => m.type === 'text' && m.sender === 'user');
    let userPromptText = (lastUserMessage?.type === 'text') ? lastUserMessage.text : '';

    if (userPromptText === ANALYZE_PROMPT) {
        if (currentCircuit.length === 0) {
            return { displayText: "The circuit is empty. Add some gates and I'll be happy to analyze it for you!", actions: [] };
        }
        const circuitDescription = currentCircuit.map(g => `${gateMap.get(g.gateId)?.name || g.gateId} on q[${g.qubit}]${g.controlQubit !== undefined ? ` controlled by q[${g.controlQubit}]` : ''}`).join('; ');
        userPromptText = `The user wants to analyze the current circuit. Circuit description: [${circuitDescription}]. User's request: ${ANALYZE_PROMPT}`;
    }
    
    // 2. Manager Agent: Creates the plan
    onStatusUpdate({ agent: 'Manager', status: 'running', message: 'Creating project plan...' });
    const managerResponse = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: userPromptText }] }],
        config: { systemInstruction: managerSystemInstruction(numQubits), responseMimeType: 'application/json', responseSchema: managerSchema }
    });
    const plan = JSON.parse(managerResponse.text).plan;
    onStatusUpdate({ agent: 'Manager', status: 'completed', message: 'Plan created.' });

    // 3. Execute the plan
    let executionContext = {
        userPrompt: userPromptText,
        researchFindings: '',
        criticReasoning: '',
        designPrompt: '',
        designActions: [] as AIAction[],
        sources: undefined as Source[] | undefined,
    };

    for (const step of plan) {
        switch (step.agent_to_call) {
            case 'Research':
                onStatusUpdate({ agent: 'Research', status: 'running', message: step.reasoning });
                const researchResponse = await ai.models.generateContent({
                    model,
                    contents: [{ role: 'user', parts: [{ text: step.prompt }] }],
                    config: { tools: [{ googleSearch: {} }] }
                });
                executionContext.researchFindings = researchResponse.text;
                const groundingMetadata = researchResponse.candidates?.[0]?.groundingMetadata;
                if (groundingMetadata?.groundingChunks) {
                    executionContext.sources = groundingMetadata.groundingChunks
                        .map(chunk => ({ uri: chunk.web?.uri || '', title: chunk.web?.title || 'Untitled' }))
                        .filter(source => source.uri);
                }
                onStatusUpdate({ agent: 'Research', status: 'completed', message: 'Research complete.' });
                break;

            case 'Critic':
                onStatusUpdate({ agent: 'Critic', status: 'running', message: step.reasoning });
                const criticPrompt = `User's original request: "${executionContext.userPrompt}"\n\nResearch Agent's findings: "${executionContext.researchFindings}"`;
                const criticResponse = await ai.models.generateContent({
                    model,
                    contents: [{ role: 'user', parts: [{ text: criticPrompt }] }],
                    config: { systemInstruction: criticSystemInstruction, responseMimeType: 'application/json', responseSchema: criticSchema }
                });
                const criticDecision = JSON.parse(criticResponse.text);
                
                if (!criticDecision.is_approved) {
                    onStatusUpdate({ agent: 'Critic', status: 'completed', message: 'Plan rejected.' });
                    return { displayText: `I reconsidered the initial approach. Here's why: ${criticDecision.reasoning}\n\nPlease try rephrasing your request.`, actions: [] };
                }
                executionContext.criticReasoning = criticDecision.reasoning;
                executionContext.designPrompt = criticDecision.refined_prompt; 
                onStatusUpdate({ agent: 'Critic', status: 'completed', message: 'Plan approved.' });
                break;

            case 'Design':
                onStatusUpdate({ agent: 'Design', status: 'running', message: step.reasoning });
                const designPrompt = executionContext.designPrompt || step.prompt;
                
                // This part handles the function calling for the design agent
                const designResponse = await ai.models.generateContent({
                    model,
                    contents: [{ role: 'user', parts: [{ text: designPrompt }] }],
                    config: { tools: [{ functionDeclarations: designTools }], systemInstruction: designAgentSystemInstruction(numQubits) },
                });
                
                if (designResponse.functionCalls && designResponse.functionCalls.length > 0) {
                    for (const funcCall of designResponse.functionCalls) {
                        switch(funcCall.name) {
                            case 'add_gate':
                                executionContext.designActions.push({ type: 'add_gate', payload: funcCall.args as AddGatePayload });
                                break;
                            case 'replace_circuit':
                                executionContext.designActions.push({ type: 'replace_circuit', payload: (funcCall.args as any).gates });
                                break;
                            case 'set_qubit_count':
                                executionContext.designActions.push({ type: 'set_qubit_count', payload: { count: (funcCall.args as any).qubit_count }});
                                break;
                            case 'get_simulation_results':
                                // This tool is just for the agent to get info, no action needed on the canvas
                                break;
                        }
                    }
                }
                onStatusUpdate({ agent: 'Design', status: 'completed', message: 'Circuit constructed.' });
                break;
        }
    }

    // 4. Explanation Agent
    onStatusUpdate({ agent: 'Explanation', status: 'running', message: 'Synthesizing final response...' });
    const explanationContext = `Synthesize the following information into a single, cohesive, user-facing response.
    - User's original prompt: "${executionContext.userPrompt}"
    - Research findings: "${executionContext.researchFindings}"
    - Critic's reasoning for approval: "${executionContext.criticReasoning}"
    - Actions taken by Design agent: ${executionContext.designActions.length > 0 ? executionContext.designActions.map(a => a.type).join(', ') : 'None'}.`;

    const explanationResponse = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: explanationContext }] }],
        config: { systemInstruction: explanationAgentSystemInstruction }
    });
    onStatusUpdate({ agent: 'Explanation', status: 'completed', message: 'Response ready.' });
    
    return { 
        displayText: explanationResponse.text, 
        actions: executionContext.designActions, 
        sources: executionContext.sources 
    };
};


// --- Code Generation ---
const qiskitMethodMap: Record<string, (g: PlacedGate) => string | null> = { 'h': g => `qc.h(${g.qubit})`, 'x': g => `qc.x(${g.qubit})`, 'y': g => `qc.y(${g.qubit})`, 'z': g => `qc.z(${g.qubit})`, 's': g => `qc.s(${g.qubit})`, 'sdg': g => `qc.sdg(${g.qubit})`, 't': g => `qc.t(${g.qubit})`, 'tdg': g => `qc.tdg(${g.qubit})`, 'cnot': g => g.controlQubit !== undefined ? `qc.cx(${g.controlQubit}, ${g.qubit})` : null, 'cz': g => g.controlQubit !== undefined ? `qc.cz(${g.controlQubit}, ${g.qubit})` : null, 'swap': g => g.controlQubit !== undefined ? `qc.swap(${g.qubit}, ${g.controlQubit})` : null, 'measure': g => `qc.measure(${g.qubit}, ${g.qubit})`, };
const methodNames = Object.keys(qiskitMethodMap).join('|').replace('cnot', 'cx');

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
    const methodRegex = new RegExp(`(\\.(?:${methodNames})\\()`, 'g');
    return code
        .replace(/(from|import|as)/g, '<span class="text-purple-400">$&</span>')
        .replace(/(QuantumCircuit)/g, '<span class="text-sky-400">$&</span>')
        .replace(/\b(qc)\b/g, '<span class="text-yellow-400">$&</span>')
        .replace(methodRegex, '<span class="text-cyan-400">$&</span>')
        .replace(/(#.*)/g, '<span class="text-gray-500">$&</span>');
};