import type { AIResponse, AgentStatusUpdate, PlacedGate, AIAction } from "../types";

// Helper to simulate async agent work
const agentWork = (delay: number) => new Promise(resolve => setTimeout(resolve, delay));

/**
 * Simulates a multi-agent workflow to get a response from the Milimo AI.
 * @param prompt The user's input prompt.
 * @param currentCircuit The current state of the quantum circuit.
 * @param onStatusUpdate A callback to stream agent status updates to the UI.
 * @returns A promise that resolves to an AIResponse object with actions and text.
 */
export const getAgentResponse = async (
  prompt: string,
  currentCircuit: PlacedGate[],
  onStatusUpdate: (update: AgentStatusUpdate) => void
): Promise<AIResponse> => {
  console.log('Initiating multi-agent workflow for prompt:', prompt);

  const lowerCasePrompt = prompt.toLowerCase();

  // --- Bell State Creation Workflow ---
  if (lowerCasePrompt.includes('bell state') || lowerCasePrompt.includes('entangled')) {
    onStatusUpdate({ agent: 'Orchestrator', status: 'running', message: 'Analyzing request for "Bell State". Creating a plan...' });
    await agentWork(400);
    onStatusUpdate({ agent: 'Orchestrator', status: 'completed', message: 'Plan created. Delegating to Design Agent.' });
    
    onStatusUpdate({ agent: 'Design', status: 'running', message: 'Designing Bell State circuit...' });
    await agentWork(800);
    const actions: AIAction[] = [
      { type: 'clear_circuit', payload: null },
      { type: 'add_gate', payload: { gateId: 'h', qubit: 0, left: 20 } },
      { type: 'add_gate', payload: { gateId: 'cnot', qubit: 1, controlQubit: 0, left: 40 } },
    ];
    onStatusUpdate({ agent: 'Design', status: 'completed', message: 'Circuit design complete.' });

    onStatusUpdate({ agent: 'Explanation', status: 'running', message: 'Generating explanation...' });
    await agentWork(500);
    onStatusUpdate({ agent: 'Explanation', status: 'completed', message: 'Explanation ready.' });

    return {
      displayText: "I've constructed a Bell state for you. It begins with a Hadamard gate on the first qubit to create superposition, followed by a CNOT gate to entangle it with the second qubit.",
      actions: actions
    };
  }

  // --- Circuit Optimization Workflow ---
  if (lowerCasePrompt.includes('optimize')) {
    onStatusUpdate({ agent: 'Orchestrator', status: 'running', message: 'Initiating circuit optimization plan...' });
    await agentWork(300);
    onStatusUpdate({ agent: 'Orchestrator', status: 'completed', message: 'Plan ready. Engaging Optimization Agent.' });

    onStatusUpdate({ agent: 'Optimization', status: 'running', message: `Analyzing ${currentCircuit.length} gates for redundancy...` });
    await agentWork(1200);
    
    // Simple optimization: remove consecutive identical gates on the same qubit (e.g., H-H, X-X)
    const optimizedCircuit: PlacedGate[] = [];
    const gateMap = new Map<number, string>(); // qubit -> last gate instanceId
    const toRemove = new Set<string>();

    for(const gate of currentCircuit) {
        if(gate.controlQubit !== undefined) { // Don't optimize CNOTs for now
            optimizedCircuit.push(gate);
            continue;
        }

        const lastGateId = gateMap.get(gate.qubit);
        if(lastGateId) {
            const lastGate = optimizedCircuit.find(g => g.instanceId === lastGateId);
            if(lastGate && lastGate.gateId === gate.gateId) {
                toRemove.add(lastGate.instanceId);
                gateMap.delete(gate.qubit); // remove the last gate, so the next one isn't compared to it
            } else {
                optimizedCircuit.push(gate);
                gateMap.set(gate.qubit, gate.instanceId);
            }
        } else {
             optimizedCircuit.push(gate);
             gateMap.set(gate.qubit, gate.instanceId);
        }
    }
    const finalCircuit = optimizedCircuit.filter(g => !toRemove.has(g.instanceId));
    const gatesRemoved = currentCircuit.length - finalCircuit.length;

    onStatusUpdate({ agent: 'Optimization', status: 'completed', message: `Optimization complete. Removed ${gatesRemoved} redundant gates.` });
    
    onStatusUpdate({ agent: 'Explanation', status: 'running', message: 'Generating summary...' });
    await agentWork(400);
    onStatusUpdate({ agent: 'Explanation', status: 'completed', message: 'Summary ready.' });

    if (gatesRemoved > 0) {
        return {
            displayText: `I've optimized your circuit and removed ${gatesRemoved} redundant gates. The updated circuit is now on the canvas.`,
            actions: [{ type: 'replace_circuit', payload: finalCircuit }]
        };
    } else {
         return {
            displayText: "I analyzed your circuit and found no obvious redundancies to optimize. It's already looking efficient!",
            actions: []
        };
    }
  }

  // --- Default Fallback Workflow ---
    onStatusUpdate({ agent: 'Orchestrator', status: 'running', message: 'Analyzing your request...' });
    await agentWork(300);
    onStatusUpdate({ agent: 'Orchestrator', status: 'completed', message: 'Plan identified. Querying relevant agent.' });
    onStatusUpdate({ agent: 'Explanation', status: 'running', message: 'Formulating a response...' });
    await agentWork(800);
    onStatusUpdate({ agent: 'Explanation', status: 'completed', message: 'Response generated.' });
  
  return {
    displayText: "I've processed your request. While I can't perform that specific action yet, you can try asking me to 'create a Bell state' or 'optimize my circuit'.",
    actions: []
  };
};
