import { GoogleGenAI, FunctionDeclaration, Type, Content, Part, Chat } from "@google/genai";
import type { AIResponse, AgentStatusUpdate, PlacedGate, AIAction, Message, SimulationResult, Source, AddGatePayload, PlacedItem, CustomGateDefinition } from "../types";
import { gateMap, gates } from "../data/gates";
import { unrollCircuit } from "./quantumSimulator";

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

export const managerSystemInstruction = () => `You are the Manager of Milimo AI, a team of specialized quantum AI agents. Your job is to create a robust, multi-step plan to fulfill the user's request based on the provided context.

**Your Input:** You will receive the user's latest request along with the current state of the quantum circuit canvas.

**Gate Library:**
${gateLibrary}

${sotaConceptsLibrary}

**Core Directives:**
1.  **Analyze User Intent & Context:**
    - **Complex Build/Research:** If the user asks to build, create, or show an abstract concept (e.g., "teleportation", "error correction"), formulate a research-critic-design plan.
    - **Simple Command:** If the user gives a direct, simple command like "add a Hadamard to qubit 0", create a single-step "Design" agent plan. The prompt for the Design agent should be the user's exact command for fast, conversational building.
    - **Analyze/Debug/Optimize:** If the user asks to "analyze", "debug", or "optimize" the current circuit, create a single-step plan for the corresponding agent.
2.  **Formulate the Plan:** Your output MUST be a single JSON object inside a markdown code block. The JSON object must contain a "plan" array. Do not output any other text.

**Example: Simple Command**
*User Prompt provides context for a 3-qubit circuit and asks "add a hadamard to qubit 1 at 50%"*
*Your Output:*
\`\`\`json
{
  "plan": [
    {
      "agent_to_call": "Design",
      "reasoning": "User issued a direct command to add a gate. I will pass this to the Design agent for immediate execution.",
      "prompt": "add a hadamard to qubit 1 at 50%"
    }
  ]
}
\`\`\`

**Example: Complex Request**
*User Prompt provides context for an empty canvas and asks "Show me quantum error correction"*
*Your Output:*
\`\`\`json
{
  "plan": [
    { "agent_to_call": "Research", "reasoning": "...", "prompt": "..." },
    { "agent_to_call": "Critic", "reasoning": "...", "prompt": "..." },
    { "agent_to_call": "Design", "reasoning": "...", "prompt": "..." }
  ]
}
\`\`\`
`;

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
    - If you reject, it must contain \`is_approved: false\`, \`reasoning\`, and a \`rejection_prompt\` that tells the Research agent what to look for instead (e.g., "Find the circuit for the 5-qubit perfect error-correcting code.").`;

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

const debuggerAgentSystemInstruction = (circuitDescription: string) => `You are the Debugger Agent for Milimo AI, a quantum circuit expert. Your job is to analyze a user's potentially faulty circuit, identify logical errors, and provide a corrected version.

**Current Circuit State:**
${circuitDescription}

**Common Quantum Circuit Errors:**
- **Incorrect Bell State:** A Bell state requires a Hadamard gate on one qubit, followed by a CNOT. A common error is missing the Hadamard or using a different gate.
- **GHZ State Malformation:** A GHZ state starts with a Hadamard on one qubit, followed by a chain of CNOTs. Errors include incorrect CNOT direction or missing the initial Hadamard.
- **Incomplete Teleportation:** The teleportation protocol has a specific structure (Bell pair creation, CNOT, H, measurement, classical correction). Missing any of these steps will cause it to fail.
- **Misplaced Measurement:** Measuring a qubit too early can collapse the superposition needed for subsequent gates to work correctly.

**Your Task:**
1.  **Analyze:** Carefully examine the provided circuit state.
2.  **Diagnose:** Compare it against known algorithms and principles. If you find a logical error, state clearly what the error is and why it's a problem.
3.  **Correct:** Use the \`replace_circuit\` tool to provide the full, corrected circuit. If the circuit is not a known algorithm or has no obvious errors, state that you can't find a specific flaw.
4.  **Explain:** After calling the tool, provide a brief, user-facing explanation of the fix.
`;

const optimizerAgentSystemInstruction = (circuitDescription: string) => `You are the Optimizer Agent for Milimo AI, a quantum circuit optimization specialist. Your job is to analyze a user's circuit for inefficiencies and apply simplifications to reduce gate count and depth.

**Current Circuit State:**
${circuitDescription}

**Common Quantum Circuit Optimizations:**
- **Gate Cancellation:** Two identical self-inverse gates in a row (e.g., H-H, X-X, CNOT-CNOT) on the same qubit(s) cancel each other out and can be removed.
- **Identity Removal:** An identity gate (which does nothing) can be removed.
- **Redundant Rotations:** Combining consecutive rotation gates (e.g., two Z-rotations) into a single rotation. (Note: The current gate set has fixed rotations, so focus on cancellations).

**Your Task:**
1.  **Analyze:** Carefully examine the provided circuit state for any of the optimization opportunities listed above, primarily focusing on gate cancellations.
2.  **Optimize:** If you find an optimization, use the \`replace_circuit\` tool to provide the full, simplified circuit. Remove the unnecessary gates entirely.
3.  **Explain:** After calling the tool, provide a brief, user-facing explanation of the optimization you performed (e.g., "I removed a pair of consecutive Hadamard gates on qubit 0 as they cancel each other out."). If no optimizations can be found, state that the circuit is already efficient.
`;


const explanationAgentSystemInstruction = `You are the Explanation Agent for Milimo AI. Your job is to provide a final, user-facing response that synthesizes the entire problem-solving journey using a strict analytical process.

**Your Input:** A JSON object containing the user's request, research, critic reasoning, the final circuit state, and potentially hardware simulation results.

**Core Directives & Process:**
1.  **Step 1: Step-by-Step Analysis (Internal Monologue):** First, you MUST perform a step-by-step analysis of the gates in the provided \`final_canvas_state\`. Describe the effect of each gate in sequence on the qubits.
2.  **Step 2: Identify Purpose & Gaps (Internal Monologue):** Based ONLY on your analysis from Step 1, you must then explicitly state the circuit's purpose. If the circuit is an incomplete version of a known algorithm, you MUST state what is missing. For example: *'This circuit creates redundancy by copying the state of q0 to q1 and q2. It is the core of a bit-flip encoding circuit but is missing the initial Hadamard gate required to encode a superposition state.'*
3.  **Step 3: Hardware Comparison (Internal Monologue, if applicable):** If the input contains \`hardware_simulation_results\`, you MUST compare them to the \`ideal_simulation_results\`.
    - Note the differences in measurement probabilities (e.g., "The ideal result for state |11⟩ is 50%, but the hardware result is only 45.2%").
    - State that this difference is expected and is caused by quantum noise on the simulated hardware, which leads to errors and decoherence.
4.  **Step 4: Synthesize Final Response (User-Facing Output):** Finally, combine your rigorous analysis with the user's intent and the critic's reasoning to generate the user-facing text.
    - Your description of the circuit on the canvas MUST be based *exclusively* on your analysis of the provided \`final_canvas_state\` object. DO NOT HALLUCINATE GATES that aren't there.
    - Explain WHAT was built on the canvas, being precise and accurate.
    - Explain WHY it was built, referencing the user's intent and the critic's decision-making process.
    - If your analysis included a hardware comparison (Step 3), you MUST include a section in your final response explaining the impact of noise.
    - If the request was to analyze an existing circuit, your entire response is the analysis from steps 1, 2, and 3.
    - Format your response for clarity using Markdown (bolding, lists, etc.).`;

// The main function that orchestrates the agent workflow.
export const getAgentResponse = async (
  chatSession: Chat,
  userPromptText: string,
  currentCircuit: PlacedGate[],
  simulationResult: SimulationResult | null,
  numQubits: number,
  hardwareResult: SimulationResult | null,
  onStatusUpdate: (update: AgentStatusUpdate) => void
): Promise<AIResponse> => {
    
    const circuitDescriptionForManager = currentCircuit.length > 0
        ? JSON.stringify(currentCircuit.map(g => ({ gate: g.gateId, qubit: g.qubit, control: g.controlQubit, position: g.left })))
        : 'The circuit is currently empty.';
    
    onStatusUpdate({ agent: 'Manager', status: 'running', message: 'Creating project plan...' });

    const managerPrompt = `
**Canvas State:**
- The canvas currently has ${numQubits} qubits (0 to ${numQubits - 1}). This can be changed to any value between 2 and 5 using the 'set_qubit_count' tool.
- **Current Circuit on Canvas:** ${circuitDescriptionForManager}

**Latest User Request:**
${userPromptText}
`;
    
    const managerResponse = await chatSession.sendMessage(managerPrompt);
    
    let plan: any[] = [];
    try {
        const jsonText = managerResponse.text.match(/```json\n([\s\S]*?)\n```/)?.[1];
        if (!jsonText) {
            throw new Error("Manager did not return a valid JSON plan.");
        }
        plan = JSON.parse(jsonText).plan;
    } catch (e) {
        console.error("Failed to parse manager plan:", e);
        return { displayText: "I had trouble formulating a plan. Could you please rephrase your request?", actions: [] };
    }
    onStatusUpdate({ agent: 'Manager', status: 'completed', message: 'Plan created.' });

    let executionContext = {
        userPrompt: userPromptText,
        researchFindings: '',
        criticReasoning: '',
        designPrompt: '',
        designActions: [] as AIAction[],
        sources: undefined as Source[] | undefined,
        explanationText: '',
    };
    
    const optimizerStep = plan.find((step: any) => step.agent_to_call === 'Optimizer');
    if (optimizerStep) {
        onStatusUpdate({ agent: 'Optimizer', status: 'running', message: optimizerStep.reasoning });
        const optimizerResponse = await ai.models.generateContent({
            model,
            contents: [{ role: 'user', parts: [{ text: `User wants to optimize this circuit. Please analyze and respond.` }] }],
            config: { tools: [{ functionDeclarations: [replaceCircuitTool] }], systemInstruction: optimizerAgentSystemInstruction(circuitDescriptionForManager) },
        });

        if (optimizerResponse.functionCalls && optimizerResponse.functionCalls.length > 0) {
            const replaceCall = optimizerResponse.functionCalls.find(fc => fc.name === 'replace_circuit');
            if (replaceCall) {
                executionContext.designActions.push({ type: 'replace_circuit', payload: (replaceCall.args as any).gates });
            }
        }
        executionContext.explanationText = optimizerResponse.text; // The optimizer's explanation is the final text
        onStatusUpdate({ agent: 'Optimizer', status: 'completed', message: 'Optimization analysis complete.' });
        return { 
            displayText: executionContext.explanationText, 
            actions: executionContext.designActions,
            sources: executionContext.sources 
        };
    }
    
    const debuggerStep = plan.find((step: any) => step.agent_to_call === 'Debugger');
    if (debuggerStep) {
        onStatusUpdate({ agent: 'Debugger', status: 'running', message: debuggerStep.reasoning });
        const debuggerResponse = await ai.models.generateContent({
            model,
            contents: [{ role: 'user', parts: [{ text: `User wants to debug this circuit. Please analyze and respond.` }] }],
            config: { tools: [{ functionDeclarations: [replaceCircuitTool] }], systemInstruction: debuggerAgentSystemInstruction(circuitDescriptionForManager) },
        });

        if (debuggerResponse.functionCalls && debuggerResponse.functionCalls.length > 0) {
            const replaceCall = debuggerResponse.functionCalls.find(fc => fc.name === 'replace_circuit');
            if (replaceCall) {
                executionContext.designActions.push({ type: 'replace_circuit', payload: (replaceCall.args as any).gates });
            }
        }
        executionContext.explanationText = debuggerResponse.text; // The debugger's explanation is the final text
        onStatusUpdate({ agent: 'Debugger', status: 'completed', message: 'Debug analysis complete.' });
        return { 
            displayText: executionContext.explanationText, 
            actions: executionContext.designActions,
            sources: executionContext.sources 
        };
    }


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
    let finalNumQubits = numQubits;
    let finalGates: Omit<PlacedGate, 'instanceId' | 'isSelected'>[] = currentCircuit.map(({ instanceId, isSelected, ...rest }) => rest);

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
        } else if (setQubitAction) {
            const addActions = executionContext.designActions.filter((a): a is { type: 'add_gate'; payload: AddGatePayload } => a.type === 'add_gate');
            tempGatesState = addActions.map(a => a.payload);
        } else {
             const addActions = executionContext.designActions.filter((a): a is { type: 'add_gate'; payload: AddGatePayload } => a.type === 'add_gate');
             tempGatesState = [...finalGates, ...addActions.map(a => a.payload)];
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

    // If it was a simple design-only plan, no need for a complex explanation.
    if (plan.length === 1 && plan[0].agent_to_call === 'Design') {
        return {
            displayText: `Done. I've updated the circuit as you requested.`,
            actions: executionContext.designActions,
            sources: executionContext.sources,
        };
    }

    // Explanation Agent
    onStatusUpdate({ agent: 'Explanation', status: 'running', message: 'Synthesizing final response...' });
    const explanationContextObject = {
        user_prompt: executionContext.userPrompt,
        research_findings: executionContext.researchFindings,
        critic_reasoning: executionContext.criticReasoning,
        final_canvas_state: finalCanvasState,
        ideal_simulation_results: simulationResult,
        hardware_simulation_results: hardwareResult,
    };
    const explanationContext = `Synthesize the following information into a single, cohesive, user-facing response.\n\n${JSON.stringify(explanationContextObject, null, 2)}`;

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

// --- Tutor Mode ---
export const tutorSystemInstruction = `You are an AI Quantum Tutor for Milimo Quantum Studio. Your role is to provide proactive, Socratic, and educational guidance as a user builds a quantum circuit.

**Core Directives:**
1.  **Be Socratic:** DO NOT give direct answers. Instead, ask guiding questions to stimulate the user's thinking.
2.  **Be Concise:** Your responses must be short and to the point, ideally one or two sentences.
3.  **Be Contextual:** Base your guidance on the *last action* or the *current state* of the circuit provided.
4.  **Be Encouraging:** Maintain a positive and helpful tone.

**Examples:**
- If user adds a Hadamard: "Great! You've put a qubit into superposition. What do you think will happen if you measure it now?"
- If user creates a Bell State: "You've just created an entangled Bell state! Notice how the individual qubit states are no longer independent. What could this be useful for?"
- If user adds a second Hadamard to the same qubit: "Interesting, a second Hadamard gate. What does applying the same gate twice in a row often do?"
- If the circuit is empty or just one gate: "Keep going! What's the next step you have in mind for your algorithm?"

Analyze the provided circuit and give a brief, Socratic tip.`;

export const getTutorResponse = async (
  circuitDescription: string,
  numQubits: number
): Promise<string> => {
  const prompt = `The user is building a ${numQubits}-qubit circuit. Its current state is: ${circuitDescription}. Provide a Socratic tip based on this.`;
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash', // Use a faster model for tutoring
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { systemInstruction: tutorSystemInstruction }
  });

  return response.text;
};


// --- Code Generation ---
const qiskitMethodMap: Record<string, (g: PlacedGate) => string | null> = { 'h': g => `qc.h(${g.qubit})`, 'x': g => `qc.x(${g.qubit})`, 'y': g => `qc.y(${g.qubit})`, 'z': g => `qc.z(${g.qubit})`, 's': g => `qc.s(${g.qubit})`, 'sdg': g => `qc.sdg(${g.qubit})`, 't': g => `qc.t(${g.qubit})`, 'tdg': g => `qc.tdg(${g.qubit})`, 'cnot': g => g.controlQubit !== undefined ? `qc.cx(${g.controlQubit}, ${g.qubit})` : null, 'cz': g => g.controlQubit !== undefined ? `qc.cz(${g.controlQubit}, ${g.qubit})` : null, 'swap': g => g.controlQubit !== undefined ? `qc.swap(${g.qubit}, ${g.controlQubit})` : null, 'measure': g => `qc.measure(${g.qubit}, ${g.qubit})`, };
const methodNames = Object.keys(qiskitMethodMap).join('|').replace('cnot', 'cx');

const highlightCode = (code: string): string => {
    const methodRegex = new RegExp(`(\\.(?:${methodNames}|append|run|get_counts)\\()`, 'g');
    return code
        .replace(/(from|import|as|print)/g, '<span class="text-purple-400">$&</span>')
        .replace(/(QuantumCircuit|NoiseModel|AerSimulator|depolarizing_error|phase_damping_error)/g, '<span class="text-sky-400">$&</span>')
        .replace(/\b(qc|noise_model|error_1|error_2|simulator|result|counts)\b/g, '<span class="text-yellow-400">$&</span>')
        .replace(methodRegex, '<span class="text-cyan-400">$&</span>')
        .replace(/(#.*)/g, '<span class="text-gray-500">$&</span>');
};

export const generateQiskitCode = (
    placedItems: PlacedItem[], 
    customGateDefs: CustomGateDefinition[], 
    numQubits: number,
    options: { 
        noiseModel?: { depolarizing: number, phaseDamping: number },
        highlight?: boolean 
    } = {}
): string => {
    const { noiseModel, highlight = true } = options;

    const unrolledGates = unrollCircuit(placedItems, customGateDefs);
    const sortedGates = unrolledGates.sort((a, b) => a.left - b.left);

    let imports = `from qiskit import QuantumCircuit\n`;
    let code = `# Create a quantum circuit with ${numQubits} qubits and ${numQubits} classical bits\n`;
    code += `qc = QuantumCircuit(${numQubits}, ${numQubits})\n\n`;

    if (sortedGates.length > 0) code += `# Add gates to the circuit\n`;
    for (const gate of sortedGates) {
        const generator = qiskitMethodMap[gate.gateId];
        if (generator) {
            const line = generator(gate);
            // Qiskit's measure takes (qubit, classical_bit)
            if (gate.gateId === 'measure') {
                code += `qc.measure(${gate.qubit}, ${gate.qubit})\n`;
            } else if(line) {
                code += line + '\n';
            }
        }
    }
    
    // Add noise model and simulation run if requested
    if (noiseModel && (noiseModel.depolarizing > 0 || noiseModel.phaseDamping > 0)) {
        imports += `from qiskit_aer import AerSimulator\n`;
        imports += `from qiskit.providers.aer.noise import depolarizing_error, phase_damping_error, NoiseModel\n`;

        code += `\n# --- Noise Model Definition ---\n`;
        code += `# Create an empty noise model\n`;
        code += `noise_model = NoiseModel()\n\n`;

        if (noiseModel.depolarizing > 0) {
            code += `# Add depolarizing error to all single-qubit gates\n`;
            code += `p_depolarizing = ${noiseModel.depolarizing.toFixed(4)}\n`;
            code += `error_1 = depolarizing_error(p_depolarizing, 1)\n`;
            code += `noise_model.add_all_qubit_quantum_error(error_1, ['h', 'x', 'y', 'z', 's', 'sdg', 't', 'tdg'])\n\n`;
        }
        if (noiseModel.phaseDamping > 0) {
            code += `# Add phase damping error to all two-qubit gates\n`;
            code += `p_phase_damping = ${noiseModel.phaseDamping.toFixed(4)}\n`;
            code += `error_2 = phase_damping_error(p_phase_damping).tensor(phase_damping_error(p_phase_damping))\n`;
            code += `noise_model.add_all_qubit_quantum_error(error_2, ['cx', 'cz', 'swap'])\n\n`;
        }

        code += `# --- Simulation Execution ---\n`;
        code += `# Create a simulator backend with the noise model\n`;
        code += `simulator = AerSimulator(noise_model=noise_model)\n\n`;
        code += `# Execute the circuit and get the results\n`;
        code += `result = simulator.run(qc, shots=1024).result()\n`;
        code += `counts = result.get_counts(qc)\n`;
        code += `print("Counts:", counts)\n`;

    } else {
         // Ideal simulation
        imports += `from qiskit.primitives import Sampler\n`;
        code += `\n# --- Simulation Execution ---\n`;
        code += `# To run the circuit, you can use a simulator\n`;
        code += `sampler = Sampler()\n`
        code += `job = sampler.run(qc, shots=1024)\n`
        code += `result = job.result()\n`
        code += `dist = result.quasi_dists[0]\n`
        code += `counts = {k: v*1024 for k, v in dist.items()}\n`
        code += `print(f"Counts: {counts}")\n`;
    }

    const fullCode = imports + '\n' + code;
    return highlight ? highlightCode(fullCode) : fullCode;
};
