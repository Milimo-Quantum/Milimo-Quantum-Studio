import React, { useRef, useState, useCallback, useEffect } from 'react';
import Header from './components/Header';
import LeftPanel from './components/LeftPanel';
import CircuitCanvas from './components/CircuitCanvas';
import RightPanel from './components/RightPanel';
import type { PlacedGate, QuantumGate, Message, AIAction, AgentStatusUpdate, SimulationResult, AddGatePayload, CircuitState } from './types';
import { AnimatePresence, motion } from 'framer-motion';
import QuantumGateComponent from './components/QuantumGate';
import { getAgentResponse, getTutorResponse } from './services/geminiService';
import { simulate } from './services/quantumSimulator';
import { gateMap } from './data/gates';
import { useHistory } from './hooks/useHistory';
import TutorNotification from './components/TutorNotification';

const INITIAL_STATE: CircuitState = {
  numQubits: 3,
  placedGates: [],
};

const encodeCircuit = (data: CircuitState): string => {
  try {
    const jsonString = JSON.stringify(data);
    return btoa(jsonString).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  } catch (e) {
    console.error("Failed to encode circuit", e);
    return "";
  }
};

const decodeCircuit = (encoded: string): CircuitState | null => {
  try {
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const jsonString = atob(base64);
    return JSON.parse(jsonString);
  } catch (e) {
    console.error("Failed to decode circuit", e);
    return null;
  }
};


export const App: React.FC = () => {
  const { 
    state, 
    setState, 
    undo, 
    redo, 
    canUndo, 
    canRedo 
  } = useHistory<CircuitState>(INITIAL_STATE);

  const { numQubits, placedGates } = state;

  const [selectedGateId, setSelectedGateId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggingGate, setDraggingGate] = useState<{gate: QuantumGate, point: {x: number, y: number}} | null>(null);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [activeTab, setActiveTab] = useState<'copilot' | 'visualization' | 'code'>('copilot');
  const [visualizedQubit, setVisualizedQubit] = useState<number>(0);
  const [simulationStep, setSimulationStep] = useState<number | null>(null);
  
  const [messages, setMessages] = useState<Message[]>([
    { type: 'text', sender: 'ai', text: "Hello! I'm Milimo AI. You can give me complex challenges like 'build a quantum teleportation circuit' or give me step-by-step instructions like 'add a Hadamard to qubit 0'." },
  ]);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // --- Tutor Mode State ---
  const [isTutorModeActive, setIsTutorModeActive] = useState(false);
  const [tutorMessage, setTutorMessage] = useState<string | null>(null);
  const [isTutorLoading, setIsTutorLoading] = useState(false);
  const tutorTimerRef = useRef<number | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const dragInfoRef = useRef<{ gate: QuantumGate | null }>({ gate: null });

  // --- Load from URL on mount ---
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const circuitData = urlParams.get('circuit');
    if (circuitData) {
      const decodedState = decodeCircuit(circuitData);
      if (decodedState) {
        if (typeof decodedState.numQubits === 'number' && Array.isArray(decodedState.placedGates)) {
          setState(decodedState, true); // Overwrite history
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    }
  }, []); // Empty array ensures this runs only once on mount

  // --- Live & Stepped Simulation Engine ---
  useEffect(() => {
    let gatesForSimulation = placedGates;
    if (simulationStep !== null) {
      const sortedGates = [...placedGates].sort((a, b) => a.left - b.left);
      gatesForSimulation = sortedGates.slice(0, simulationStep);
    }
    const result = simulate(gatesForSimulation, numQubits);
    setSimulationResult(result);
  }, [placedGates, numQubits, simulationStep]);

  // --- Live AI Tutor ---
  useEffect(() => {
    if (!isTutorModeActive || placedGates.length === 0) {
      setTutorMessage(null);
      setIsTutorLoading(false);
      if (tutorTimerRef.current) clearTimeout(tutorTimerRef.current);
      return;
    }

    if (tutorTimerRef.current) {
      clearTimeout(tutorTimerRef.current);
    }

    setIsTutorLoading(true);

    tutorTimerRef.current = window.setTimeout(async () => {
      try {
        const circuitDescription = JSON.stringify(placedGates.map(g => ({ gate: g.gateId, qubit: g.qubit, control: g.controlQubit })).slice(-3)); // Only send last few gates for context
        const response = await getTutorResponse(circuitDescription, numQubits);
        setTutorMessage(response);
      } catch (error) {
        console.error("Tutor AI error:", error);
        setTutorMessage("I had trouble analyzing that. Please try a different action.");
      } finally {
        setIsTutorLoading(false);
      }
    }, 2000); // 2-second debounce after last change

    return () => {
      if (tutorTimerRef.current) {
        clearTimeout(tutorTimerRef.current);
      }
    };
  }, [placedGates, numQubits, isTutorModeActive]);


  // --- Gate Selection & Deletion ---
  const handleSelectGate = (instanceId: string) => {
    setSelectedGateId(prevId => prevId === instanceId ? null : instanceId);
  };
  
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.key === 'Backspace' || event.key === 'Delete') && selectedGateId) {
        setState({
          ...state,
          placedGates: state.placedGates.filter(g => g.instanceId !== selectedGateId)
        });
        setSelectedGateId(null);
      }
       // Undo/Redo shortcuts
      if ((event.metaKey || event.ctrlKey) && event.key === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
      if ((event.metaKey || event.ctrlKey) && event.key === 'y') {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedGateId, state, setState, undo, redo]);

  const handleNumQubitsChange = useCallback((newNumQubits: number) => {
    if (newNumQubits >= 2 && newNumQubits <= 5) {
      setState({
        numQubits: newNumQubits,
        placedGates: [] // Clear circuit on qubit change
      });
      setSelectedGateId(null);
      if (visualizedQubit >= newNumQubits) {
        setVisualizedQubit(0);
      }
    }
  }, [visualizedQubit, setState]);


  const executeActions = useCallback((actions: AIAction[]) => {
    // 1. Determine the final number of qubits. This is the ground truth for all subsequent validation.
    const setQubitAction = actions.find(a => a.type === 'set_qubit_count');
    const finalNumQubits = setQubitAction && setQubitAction.type === 'set_qubit_count' 
        ? setQubitAction.payload.count 
        : numQubits;
    
    if (finalNumQubits < 2 || finalNumQubits > 5) {
        console.error("AI requested an invalid number of qubits:", finalNumQubits);
        return; // Abort if qubit count is out of bounds.
    }

    let gatePayloads: Omit<PlacedGate, 'instanceId' | 'isSelected'>[] = [];

    // 2. Determine the definitive gate layout. Actions are prioritized to prevent order-of-execution bugs.
    const replaceAction = actions.find(a => a.type === 'replace_circuit');
    const clearAction = actions.find(a => a.type === 'clear_circuit');

    if (replaceAction && replaceAction.type === 'replace_circuit') {
        // If there's a replacement, it's the ONLY source of truth for gates.
        gatePayloads = replaceAction.payload;
    } else if (setQubitAction || clearAction) {
        // A qubit change or explicit clear results in an empty canvas.
        // We only consider add_gate actions after this.
        const addActions = actions.filter((a): a is { type: 'add_gate'; payload: AddGatePayload } => a.type === 'add_gate');
        gatePayloads = addActions.map(a => a.payload);
    } else {
        // Otherwise, start with the current gates and append any new ones.
        const currentGates = placedGates.map(({ instanceId, isSelected, ...rest }) => rest);
        const addedGates = actions
            .filter((a): a is { type: 'add_gate'; payload: AddGatePayload } => a.type === 'add_gate')
            .map(a => a.payload);
        gatePayloads = [...currentGates, ...addedGates];
    }
    
    const isValidGate = (gate: Omit<PlacedGate, 'instanceId' | 'isSelected'>, qCount: number) => {
        const targetQubitValid = gate.qubit >= 0 && gate.qubit < qCount;
        const controlQubitValid = gate.controlQubit === undefined || (gate.controlQubit >= 0 && gate.controlQubit < qCount);
        return targetQubitValid && controlQubitValid;
    };

    // 3. Validate all gates against the final qubit count and assign unique IDs.
    const validatedPlacedGates: PlacedGate[] = gatePayloads
        .filter(g => isValidGate(g, finalNumQubits))
        .map((g, i) => ({
            ...g,
            instanceId: `${g.gateId}-${Date.now()}-${i}`,
        }));

    if (validatedPlacedGates.length < gatePayloads.length) {
        console.warn("Some gates were discarded by the validator as they were invalid for the final qubit count.");
    }
    
    // 4. Atomically apply the final state to React history.
    setState({
        numQubits: finalNumQubits,
        placedGates: validatedPlacedGates,
    });
    setSelectedGateId(null);

    // Update visualizedQubit if it's now out of bounds.
    if (visualizedQubit >= finalNumQubits) {
        setVisualizedQubit(0);
    }
    
    // Switch to code tab if requested
    if (actions.some(a => a.type === 'generate_code')) {
        setActiveTab('code');
    }

  }, [numQubits, placedGates, visualizedQubit, setVisualizedQubit, setActiveTab, setState]);


  const handleSend = useCallback(async (prompt: string) => {
    if (prompt.trim() === '' || isAiLoading) return;
    setSelectedGateId(null);
    setSimulationStep(null); // Exit step-through mode when interacting with AI

    const userMessage: Message = { type: 'text', sender: 'user', text: prompt };
    const allMessages = [...messages, userMessage];
    
    const agentStatusMessage: Message = { type: 'agent_status', updates: [] };
    setMessages([...allMessages, agentStatusMessage]);
    setIsAiLoading(true);
    setActiveTab('copilot');

    const onStatusUpdate = (update: AgentStatusUpdate) => {
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage?.type === 'agent_status') {
          lastMessage.updates.push(update);
        }
        return newMessages;
      });
    };
    
    try {
      const aiResponse = await getAgentResponse(allMessages, placedGates, simulationResult, numQubits, onStatusUpdate);
      if (aiResponse.actions.length > 0) {
        executeActions(aiResponse.actions);
      }
      const aiMessage: Message = { 
        type: 'text', 
        sender: 'ai', 
        text: aiResponse.displayText,
        sources: aiResponse.sources,
      };
      setMessages(prev => {
        const finalMessages = prev.slice(0, -1); // Remove the status message
        return [...finalMessages, aiMessage];
      });

    } catch (error) {
      console.error("Error from AI Service:", error);
      const errorMessage: Message = { type: 'text', sender: 'ai', text: "Sorry, I encountered an error. Please try again." };
      setMessages(prev => {
        const finalMessages = prev.slice(0, -1);
        return [...finalMessages, errorMessage];
      });
    } finally {
      setIsAiLoading(false);
    }
  }, [isAiLoading, placedGates, messages, executeActions, simulationResult, numQubits]);

  const handleAnalyzeCircuit = useCallback(() => {
    handleSend("Analyze my current circuit. Identify its purpose if it's a known algorithm or state, explain the principles behind it, and propose potential next steps or interesting modifications.");
  }, [handleSend]);
  
  const handleDebugCircuit = useCallback(() => {
      handleSend("Debug my current circuit. Identify any logical errors or common mistakes for known algorithms. Explain the issue and, if possible, provide a corrected version of the circuit.");
  }, [handleSend]);

  const handleOptimizeCircuit = useCallback(() => {
      handleSend("Optimize my current circuit. Look for gate simplifications or ways to reduce the circuit depth and apply the changes.");
  }, [handleSend]);

  const handleClearCircuit = useCallback(() => {
    setState({ ...state, placedGates: [] });
    setSelectedGateId(null);
    setSimulationStep(null);
  }, [state, setState]);

  const handleShowVisualization = useCallback(() => {
    setActiveTab('visualization');
  }, []);

  const handleExplainGate = useCallback((gateId: string) => {
    const gate = gateMap.get(gateId);
    if (gate) {
      handleSend(`Explain the ${gate.name} gate in simple terms, including its matrix and its effect on a qubit.`);
    }
  }, [handleSend]);

  const handleGateDrop = (gateId: string, point: { x: number; y: number }) => {
    if (!canvasRef.current) return;
    setSelectedGateId(null);

    const canvasRect = canvasRef.current.getBoundingClientRect();
    if (
      point.x >= canvasRect.left && point.x <= canvasRect.right &&
      point.y >= canvasRect.top && point.y <= canvasRect.bottom
    ) {
      const PADDING = 32;
      const QUBIT_LINE_HEIGHT = 64;

      const relativeY = point.y - canvasRect.top - PADDING;
      let qubitIndex = Math.floor(relativeY / QUBIT_LINE_HEIGHT);
      qubitIndex = Math.max(0, Math.min(numQubits - 1, qubitIndex));

      const relativeX = point.x - canvasRect.left - PADDING;
      const canvasContentWidth = canvasRect.width - PADDING * 2;
      const leftPercent = Math.max(0, Math.min(100, (relativeX / canvasContentWidth) * 100));

      const gateInfo = gateMap.get(gateId);
      const newGate: PlacedGate = {
        instanceId: `${gateId}-${Date.now()}`,
        gateId: gateId,
        qubit: qubitIndex,
        left: leftPercent,
      };

      if (gateInfo?.type === 'control') {
        let controlIndex;
        if (qubitIndex < numQubits - 1) {
          controlIndex = qubitIndex + 1;
        } else {
          controlIndex = qubitIndex - 1;
        }
        
        if(gateInfo.id === 'swap') {
            newGate.controlQubit = controlIndex;
        } else {
            newGate.qubit = controlIndex; // Target is the other line
            newGate.controlQubit = qubitIndex; // Control is the dropped line
        }
      }

      setState({ ...state, placedGates: [...state.placedGates, newGate] });
    }
  };
  
  const handlePointerMove = useCallback((event: PointerEvent) => {
    setDraggingGate(g => g ? { ...g, point: { x: event.clientX, y: event.clientY } } : null);
  }, []);

  const handlePointerUp = useCallback((event: PointerEvent) => {
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    if (dragInfoRef.current.gate) {
      handleGateDrop(dragInfoRef.current.gate.id, { x: event.clientX, y: event.clientY });
    }
    setIsDragging(false);
    setDraggingGate(null);
    dragInfoRef.current.gate = null;
  }, [handlePointerMove, handleGateDrop]);

  const handleDragInitiate = (gate: QuantumGate, event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
    setDraggingGate({ gate, point: { x: event.clientX, y: event.clientY } });
    dragInfoRef.current.gate = gate;
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };
  
  const handleSave = useCallback(() => {
    localStorage.setItem('milimo_quantum_circuit', JSON.stringify(state));
    // Add a visual confirmation if desired
  }, [state]);

  const handleLoad = useCallback(() => {
    const savedState = localStorage.getItem('milimo_quantum_circuit');
    if (savedState) {
        try {
            const parsedState = JSON.parse(savedState);
            // Basic validation
            if (typeof parsedState.numQubits === 'number' && Array.isArray(parsedState.placedGates)) {
                setState(parsedState, true); // true to overwrite history
            }
        } catch (e) {
            console.error("Failed to load circuit from storage", e);
        }
    }
  }, [setState]);

  const handleShare = useCallback(() => {
    const encodedState = encodeCircuit(state);
    if (encodedState) {
      const url = `${window.location.origin}${window.location.pathname}?circuit=${encodedState}`;
      navigator.clipboard.writeText(url);
    }
  }, [state]);
  
  const handleToggleTutorMode = useCallback(() => {
      setIsTutorModeActive(prev => !prev);
  }, []);

  return (
    <div className="bg-[#0a0a10] text-gray-200 min-h-screen flex flex-col font-sans relative" onClick={() => setSelectedGateId(null)}>
      <div className="absolute inset-0 z-0 opacity-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(120,81,250,0.2),_transparent_40%)]"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre-v2.png')] opacity-20"></div>
      </div>
      
      <div className="relative z-10 flex flex-col flex-grow">
        <Header 
            onShowVisualization={handleShowVisualization}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
            onSave={handleSave}
            onLoad={handleLoad}
            onShare={handleShare}
            isTutorModeActive={isTutorModeActive}
            onToggleTutorMode={handleToggleTutorMode}
        />
         <div className="px-4 pt-2">
            <span className="text-xs font-mono bg-gray-700/50 text-gray-400 px-2 py-0.5 rounded">Preview</span>
        </div>
        <main className="flex flex-grow p-4 gap-4">
          <LeftPanel onDragInitiate={handleDragInitiate} draggingGateId={draggingGate?.gate.id} />
          <div className="flex-grow flex flex-col gap-4">
            <CircuitCanvas 
              ref={canvasRef}
              numQubits={numQubits}
              onNumQubitsChange={handleNumQubitsChange}
              placedGates={placedGates} 
              isDragging={isDragging} 
              onAnalyzeCircuit={handleAnalyzeCircuit}
              onDebugCircuit={handleDebugCircuit}
              onOptimizeCircuit={handleOptimizeCircuit}
              onClear={handleClearCircuit}
              onExplainGate={handleExplainGate}
              selectedGateId={selectedGateId}
              onSelectGate={handleSelectGate}
              visualizedQubit={visualizedQubit}
              setVisualizedQubit={setVisualizedQubit}
              simulationStep={simulationStep}
              setSimulationStep={setSimulationStep}
            />
          </div>
          <RightPanel 
            messages={messages}
            isLoading={isAiLoading}
            onSend={handleSend}
            simulationResult={simulationResult}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            placedGates={placedGates}
            visualizedQubit={visualizedQubit}
            numQubits={numQubits}
          />
        </main>
      </div>

      <AnimatePresence>
        {draggingGate && (
          <motion.div
            className="absolute top-0 left-0"
            style={{ translateX: draggingGate.point.x, translateY: draggingGate.point.y, x: '-50%', y: '-50%', zIndex: 9999, pointerEvents: 'none' }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1.1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.1 }}
          >
            <QuantumGateComponent gate={draggingGate.gate} />
          </motion.div>
        )}
      </AnimatePresence>
      
      <TutorNotification
        message={tutorMessage}
        isLoading={isTutorLoading}
        onDismiss={() => setTutorMessage(null)}
      />
    </div>
  );
};

export default App;