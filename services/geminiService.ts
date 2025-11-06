import { GoogleGenAI, FunctionDeclaration, Type, Content, Part } from "@google/genai";
import type { AIResponse, AgentStatusUpdate, PlacedGate, AIAction, Message, SimulationResult, Source, AddGatePayload } from "../types";
import { gateMap, gates } from "../data/gates";

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

const sotaConceptsLibrary = `
**SOTA Circuit Concepts Library:**
- **5-Qubit Error Correcting Code:** The smallest perfect code that can protect against any single-qubit error (X, Y, or Z). A true SOTA example for error correction. Requires 5 qubits.
- **Quantum Teleportation:** A protocol to transmit a quantum state from one location to another using a pre-shared Bell pair and classical communication. Requires 3 qubits.
- **Deutsch-Jozsa Algorithm:** A simple but powerful demonstration of quantum parallelism, determining if a function is constant or balanced in a single evaluation. Requires N+1 qubits for an N-bit function.
`;

const managerSystemInstruction = (numQubits: number, circuitDescription: string) => `You are the Manager of Milimo AI, a team of specialized quantum AI agents. Your job is to create a robust, multi-step plan to fulfill the user's request with the highest quality.

**Canvas State:**
- The canvas currently has ${numQubits} qubits (0 to ${numQubits - 1}). This can be changed to any value between 2 and 5 using the 'set_qubit_count' tool.
- **Current Circuit on Canvas:** ${circuitDescription}

**Gate Library:**
${gateLibrary}

${sotaConceptsLibrary}

**Core Directives:**
1.  **Prioritize the Ideal Solution:** First, determine the best, most advanced, and most appropriate circuit for the user's request, referencing the SOTA library. THEN, formulate a plan to either build it directly if it fits, or adapt the canvas first if necessary.
2.  **Analyze Intent & Complexity:** Infer the user's true goal. If they use words like "advanced," "SOTA," or "robust," you MUST formulate a plan that delivers a sophisticated result. A request for "advanced spacecraft communication" MUST NOT result in a basic GHZ state or 3-qubit bit-flip code.
3.  **Handle Analysis Requests:** If the user asks to "analyze the current circuit", your output plan MUST be an empty array: \`[]\`. The Explanation agent will automatically handle the analysis based on the current circuit state.
4.  **Mandatory Quality Assurance:** For any abstract or complex request that requires research to build a new circuit, your plan MUST include a 'Critic' step immediately after the 'Research' step. The Critic's job is to prevent "lazy" solutions.
5.  **Formulate the Plan:** Your output MUST be a single JSON object containing a "plan" array.

**Example: Advanced Request**
*User Prompt:* "build a circuit for the 5-qubit error correcting code"
*Your JSON Output:*
{
  "plan": [
    {
      "agent_to_call": "Research",
      "reasoning": "The user has requested a specific, advanced algorithm from the SOTA library. I need to get its precise gate layout.",
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
                    agent_to_call: { type: Type.STRING, enum: ['Research', 'Critic', 'Design', 'Explanation'] },
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

${sotaConceptsLibrary}

**Core Directives:**
1.  **Assess Alignment & Advancement:** Does the research finding truly address the user's request, especially regarding specified complexity? If the user asks for a 'more complex' or 'advanced' solution, you MUST REJECT any proposal for a standard, foundational circuit like a GHZ state or the 3-qubit bit-flip code. Your reasoning must state that the solution is too basic.
2.  **Evaluate Implementation Elegance:** When creating the \`refined_prompt\`, you MUST consider if there is a more direct or elegant way to build the circuit using the full range of available gates. For example, instead of a complex combination of CNOTs and Hadamards to create a Controlled-Z, you MUST instruct the agent to use the 'cz' gate directly.
3.  **Manage Canvas Resources:** If the best-researched option requires a different number of qubits, your 'refined_prompt' for the Design Agent MUST begin with the instruction to change the qubit count using the 'set_qubit_count' tool.
4.  **Provide Actionable Feedback:** Your output MUST be a JSON object.
    - If you approve, it must contain \`is_approved: true\`, \`reasoning\`, and a \`refined_prompt\` for the Design Agent.
    - If you reject, it must contain \`is_approved: false\`, \`reasoning\`, and a \`rejection_prompt\` that tells the Research agent what to look for instead (e.g., "Find the circuit for the 5-qubit perfect error-correcting code.").

**Example: Rejection**
*User Request:* "show me a more advanced circuit"
*Research Finding:* "The 3-qubit bit-flip code..."
*Your JSON Output:*
{
  "is_approved": false,
  "reasoning": "The user requested a more advanced circuit. The 3-qubit bit-flip code is a foundational concept, not a significant step up in complexity. Rejecting this lazy solution.",
  "rejection_prompt": "Research the 5-qubit perfect error-correcting code, which is a true SOTA example and fits within the canvas limits."
}`;

const criticSchema = {
    type: Type.OBJECT,
    properties: {
        is_approved: { type: Type.BOOLEAN },
        reasoning: { type: Type.STRING },
        refined_prompt: { type: Type.STRING },
        rejection_prompt: { type: Type.STRING },
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

const explanationAgentSystemInstruction = `You are the Explanation Agent for Milimo AI. Your job is to provide a final, user-facing response that synthesizes the entire problem-solving journey using a strict analytical process.

**Your Input:** A JSON object containing the user's request, research, critic reasoning, and a definitive snapshot of the final circuit state.

**Core Directives & Process:**
1.  **Step 1: Step-by-Step Analysis (Internal Monologue):** First, you MUST perform a step-by-step analysis of the gates in the provided \`final_canvas_state\`. Describe the effect of each gate in sequence on the qubits.
2.  **Step 2: Identify Purpose & Gaps (Internal Monologue):** Based ONLY on your analysis from Step 1, you must then explicitly state the circuit's purpose. If the circuit is an incomplete version of a known algorithm, you MUST state what is missing. For example: *'This circuit creates redundancy by copying the state of q0 to q1 and q2. It is the core of a bit-flip encoding circuit but is missing the initial Hadamard gate required to encode a superposition state.'*
3.  **Step 3: Synthesize Final Response (User-Facing Output):** Finally, combine your rigorous analysis with the user's intent and the critic's reasoning to generate the user-facing text.
    - Your description of the circuit on the canvas MUST be based *exclusively* on your analysis of the provided \`final_canvas_state\` object. DO NOT HALLUCINATE GATES that aren't there.
    - Explain WHAT was built on the canvas, being precise and accurate.
    - Explain WHY it was built, referencing the user's intent and the critic's decision-making process.
    - If the request was to analyze an existing circuit, your entire response is the analysis from steps 1 & 2.
    - Format your response for clarity using Markdown (bolding, lists, etc.).`;

// The main function that orchestrates the agent workflow.
export const getAgentResponse = async (
  allMessages: Message[],
  currentCircuit: PlacedGate[],
  simulationResult: SimulationResult | null,
  numQubits: number,
  onStatusUpdate: (update: AgentStatusUpdate) => void
): Promise<AIResponse> => {
    
    const lastUserMessage = [...allMessages].reverse().find(m => m.type === 'text' && m.sender === 'user');
    const userPromptText = (lastUserMessage?.type === 'text') ? lastUserMessage.text : '';

    const circuitDescriptionForManager = currentCircuit.length > 0
        ? JSON.stringify(currentCircuit.map(g => ({ gate: g.gateId, qubit: g.qubit, control: g.controlQubit, position: g.left })))
        : 'The circuit is currently empty.';
    
    onStatusUpdate({ agent: 'Manager', status: 'running', message: 'Creating project plan...' });
    const managerResponse = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: userPromptText }] }],
        config: { systemInstruction: managerSystemInstruction(numQubits, circuitDescriptionForManager), responseMimeType: 'application/json', responseSchema: managerSchema }
    });
    const plan = JSON.parse(managerResponse.text).plan;
    onStatusUpdate({ agent: 'Manager', status: 'completed', message: 'Plan created.' });

    let executionContext = {
        userPrompt: userPromptText,
        researchFindings: '',
        criticReasoning: '',
        designPrompt: '',
        designActions: [] as AIAction[],
        sources: undefined as Source[] | undefined,
    };

    const researchStep = plan.find((step: any) => step.agent_to_call === 'Research');
    if (researchStep) {
        onStatusUpdate({ agent: 'Research', status: 'running', message: researchStep.reasoning });
        const researchResponse = await ai.models.generateContent({
            model,
            contents: [{ role: 'user', parts: [{ text: researchStep.prompt }] }],
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
    }

    const criticStep = plan.find((step: any) => step.agent_to_call === 'Critic');
    if (criticStep) {
        let isApproved = false;
        let attempts = 0;
        const MAX_ATTEMPTS = 2;

        while (!isApproved && attempts < MAX_ATTEMPTS) {
            attempts++;
            onStatusUpdate({ agent: 'Critic', status: 'running', message: criticStep.reasoning });
            const criticPrompt = `User's original request: "${executionContext.userPrompt}"\n\nResearch Agent's findings: "${executionContext.researchFindings}"`;
            const criticResponse = await ai.models.generateContent({
                model,
                contents: [{ role: 'user', parts: [{ text: criticPrompt }] }],
                config: { systemInstruction: criticSystemInstruction, responseMimeType: 'application/json', responseSchema: criticSchema }
            });
            const criticDecision = JSON.parse(criticResponse.text);

            if (criticDecision.is_approved) {
                isApproved = true;
                executionContext.criticReasoning = criticDecision.reasoning;
                executionContext.designPrompt = criticDecision.refined_prompt; 
                onStatusUpdate({ agent: 'Critic', status: 'completed', message: 'Plan approved.' });
            } else {
                onStatusUpdate({ agent: 'Critic', status: 'completed', message: `Plan rejected. ${criticDecision.reasoning}` });
                if (criticDecision.rejection_prompt && attempts < MAX_ATTEMPTS) {
                    onStatusUpdate({ agent: 'Research', status: 'running', message: 'Finding a more advanced alternative...' });
                    const researchResponse = await ai.models.generateContent({
                        model,
                        contents: [{ role: 'user', parts: [{ text: criticDecision.rejection_prompt }] }],
                        config: { tools: [{ googleSearch: {} }] }
                    });
                    executionContext.researchFindings = researchResponse.text;
                     const groundingMetadata = researchResponse.candidates?.[0]?.groundingMetadata;
                    if (groundingMetadata?.groundingChunks) {
                        executionContext.sources = groundingMetadata.groundingChunks
                            .map(chunk => ({ uri: chunk.web?.uri || '', title: chunk.web?.title || 'Untitled' }))
                            .filter(source => source.uri);
                    }
                    onStatusUpdate({ agent: 'Research', status: 'completed', message: 'Found new approach.' });
                } else {
                    return { displayText: `I reconsidered the initial approach: ${criticDecision.reasoning}\n\nI am unable to find a better alternative at this time. Please try rephrasing your request.`, actions: [] };
                }
            }
        }
        if (!isApproved) {
             return { displayText: "I'm having trouble finding a suitable advanced circuit that meets the quality standards. Please try rephrasing your request.", actions: [] };
        }
    }
    
    const designStep = plan.find((step: any) => step.agent_to_call === 'Design');
    if (designStep) {
        onStatusUpdate({ agent: 'Design', status: 'running', message: designStep.reasoning });
        const designPrompt = executionContext.designPrompt || designStep.prompt;
        
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
                        break;
                }
            }
        }
        onStatusUpdate({ agent: 'Design', status: 'completed', message: 'Circuit constructed.' });
    }


    // --- Final State Snapshot Calculation ---
    // This is the critical fix: determine the *actual* final state of the canvas *before* sending to the explanation agent.
    let finalNumQubits = numQubits;
    let finalGates: Omit<PlacedGate, 'instanceId' | 'isSelected'>[] = currentCircuit.map(({ instanceId, isSelected, ...rest }) => rest);

    // Create a temporary state based on the current circuit
    const initialAction: AIAction | null = plan.length > 0 ? { type: 'replace_circuit', payload: [] } : null; // If a plan exists, we assume we start fresh unless adding
    const actionsToSimulate = initialAction ? [initialAction, ...executionContext.designActions] : executionContext.designActions;

    // Simulate actions to get the final state
    if (plan.length > 0) { // Only modify the circuit if there was a plan to do so. Handles "analyze" requests.
        let tempGatesState: Omit<PlacedGate, 'instanceId' | 'isSelected'>[] = [];
        let tempQubitState = numQubits;

        const setQubitAction = executionContext.designActions.find(a => a.type === 'set_qubit_count');
        if (setQubitAction && setQubitAction.type === 'set_qubit_count') {
            tempQubitState = setQubitAction.payload.count;
        }

        const replaceAction = executionContext.designActions.find(a => a.type === 'replace_circuit');
        if (replaceAction && replaceAction.type === 'replace_circuit') {
            tempGatesState = replaceAction.payload;
        } else {
            const addActions = executionContext.designActions.filter((a): a is { type: 'add_gate'; payload: AddGatePayload } => a.type === 'add_gate');
            tempGatesState = addActions.map(a => a.payload);
        }

        finalNumQubits = tempQubitState;
        finalGates = tempGatesState;
    }
    

    const finalCanvasState = {
        qubitCount: finalNumQubits,
        gates: finalGates.map(g => ({
            gate: gateMap.get(g.gateId)?.name || g.gateId,
            qubit: g.qubit,
            controlQubit: g.controlQubit,
            position: g.left,
        })).sort((a,b) => a.position - b.position),
    };


    // 4. Explanation Agent
    onStatusUpdate({ agent: 'Explanation', status: 'running', message: 'Synthesizing final response...' });
    const explanationContext = `Synthesize the following information into a single, cohesive, user-facing response.
    - User's original prompt: "${executionContext.userPrompt}"
    - Research findings: "${executionContext.researchFindings}"
    - Critic's reasoning for approval: "${executionContext.criticReasoning}"
    - Final Canvas State: ${JSON.stringify(finalCanvasState)}`;

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