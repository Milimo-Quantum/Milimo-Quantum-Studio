import React, { useRef, useState, useCallback, useEffect } from 'react';
import Header from './components/Header';
import LeftPanel from './components/LeftPanel';
import CircuitCanvas from './components/CircuitCanvas';
import RightPanel from './components/RightPanel';
import type { PlacedGate, QuantumGate, Message, AIAction, AgentStatusUpdate, SimulationResult, AddGatePayload, CircuitState, PlacedItem, CustomGateDefinition, RightPanelTab, JobStatus, ReplaceCircuitPayload } from './types';
import { AnimatePresence, motion } from 'framer-motion';
import QuantumGateComponent from './components/QuantumGate';
import { getAgentResponse, getTutorResponse, generateQiskitCode, managerSystemInstruction } from './services/geminiService';
import { simulate } from './services/quantumSimulator';
import { gateMap } from './data/gates';
import { useHistory } from './hooks/useHistory';
import TutorNotification from './components/TutorNotification';
import { Chat, GoogleGenAI } from '@google/genai';

const INITIAL_STATE: CircuitState = {
  numQubits: 3,
  placedItems: [],
  customGateDefinitions: [],
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

const countsToSimulationResult = (counts: { [state: string]: number }, numQubits: number): SimulationResult => {
    const totalShots = Object.values(counts).reduce((sum, val) => sum + val, 0);
    if (totalShots === 0) {
        return { probabilities: [], qubitStates: [], trace: 0 };
    }

    const probabilities = Object.entries(counts).map(([state, count]) => ({
        state: `|${state.padStart(numQubits, '0')}⟩`,
        value: count / totalShots,
    }));
    
    // We cannot determine Bloch sphere coordinates from measurement counts
    const qubitStates = Array.from({ length: numQubits }, () => ({
        blochSphereCoords: { x: 0, y: 0, z: 0 },
        purity: 0, // Purity is unknown from hardware results
    }));

    return { probabilities, qubitStates, trace: 1.0 }; // Trace is assumed to be 1 for counts
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

  const { numQubits, placedItems, customGateDefinitions } = state;
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [draggingComponent, setDraggingComponent] = useState<{component: QuantumGate | CustomGateDefinition, point: {x: number, y: number}} | null>(null);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [activeTab, setActiveTab] = useState<RightPanelTab>('copilot');
  const [visualizedQubit, setVisualizedQubit] = useState<number>(0);
  const [simulationStep, setSimulationStep] = useState<number | null>(null);
  
  const [messages, setMessages] = useState<Message[]>([
    { type: 'text', sender: 'ai', text: "Hello! I'm Milimo AI. You can give me complex challenges like 'build a quantum teleportation circuit' or give me step-by-step instructions like 'add a Hadamard to qubit 0'." },
  ]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  // --- Conversational AI State ---
  const [aiChatSession, setAiChatSession] = useState<Chat | null>(null);

  // --- Tutor Mode State ---
  const [isTutorModeActive, setIsTutorModeActive] = useState(false);
  const [tutorMessage, setTutorMessage] = useState<string | null>(null);
  const [isTutorLoading, setIsTutorLoading] = useState(false);
  const tutorTimerRef = useRef<number | null>(null);

  // --- Noise Model State ---
  const [depolarizingError, setDepolarizingError] = useState(0);
  const [phaseDampingError, setPhaseDampingError] = useState(0);
  
  // --- Hardware Run State ---
  const [hardwareResult, setHardwareResult] = useState<SimulationResult | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus>('idle');
  const pollingIntervalRef = useRef<number | null>(null);


  const canvasRef = useRef<HTMLDivElement>(null);
  const dragInfoRef = useRef<{ component: QuantumGate | CustomGateDefinition | null }>({ component: null });

  // --- Initialize AI Chat Session ---
  useEffect(() => {
    const initializeChat = async () => {
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
            const chatSession = ai.chats.create({
                model: 'gemini-2.5-pro',
                config: {
                    systemInstruction: managerSystemInstruction(),
                },
            });
            setAiChatSession(chatSession);
        } catch (error) {
            console.error("Failed to initialize AI chat session:", error);
            // You might want to display an error message to the user here.
        }
    };
    initializeChat();
  }, []);

  // --- Load from URL on mount ---
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const circuitData = urlParams.get('circuit');
    if (circuitData) {
      const decodedState = decodeCircuit(circuitData);
      if (decodedState) {
        if (typeof decodedState.numQubits === 'number' && Array.isArray(decodedState.placedItems)) {
          setState(decodedState, true); // Overwrite history
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    }
  }, []); // Empty array ensures this runs only once on mount

  // --- Live & Stepped Simulation Engine ---
  useEffect(() => {
    let itemsForSimulation = placedItems;
    if (simulationStep !== null) {
      const sortedItems = [...placedItems].sort((a, b) => a.left - b.left);
      itemsForSimulation = sortedItems.slice(0, simulationStep);
    }
    const result = simulate(itemsForSimulation, numQubits, customGateDefinitions, {
        depolarizing: depolarizingError,
        phaseDamping: phaseDampingError,
    });
    setSimulationResult(result);
  }, [placedItems, numQubits, simulationStep, customGateDefinitions, depolarizingError, phaseDampingError]);

  // --- Live AI Tutor ---
  useEffect(() => {
    if (!isTutorModeActive || placedItems.length === 0) {
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
        const circuitDescription = JSON.stringify(placedItems.map(g => ('gateId' in g ? { gate: g.gateId, qubit: g.qubit, control: g.controlQubit } : { customGate: g.customGateId, qubit: g.qubit })).slice(-3));
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
  }, [placedItems, numQubits, isTutorModeActive]);


  // --- Item Selection & Deletion ---
  const handleSelectItem = (instanceId: string, isShiftPressed: boolean) => {
    setSelectedItemIds(prevIds => {
      if (isShiftPressed) {
        // Toggle selection
        return prevIds.includes(instanceId) ? prevIds.filter(id => id !== instanceId) : [...prevIds, instanceId];
      }
      // Single selection
      return prevIds.includes(instanceId) && prevIds.length === 1 ? [] : [instanceId];
    });
  };
  
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.key === 'Backspace' || event.key === 'Delete') && selectedItemIds.length > 0) {
        setState({
          ...state,
          placedItems: state.placedItems.filter(item => !selectedItemIds.includes(item.instanceId))
        });
        setSelectedItemIds([]);
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
  }, [selectedItemIds, state, setState, undo, redo]);

  const handleNumQubitsChange = useCallback((newNumQubits: number) => {
    if (newNumQubits >= 2 && newNumQubits <= 5) {
      setState({
        ...state,
        numQubits: newNumQubits,
        placedItems: [] // Clear circuit on qubit change
      });
      setSelectedItemIds([]);
      if (visualizedQubit >= newNumQubits) {
        setVisualizedQubit(0);
      }
    }
  }, [visualizedQubit, setState, state]);


  const executeActions = useCallback((actions: AIAction[]) => {
    // 1. Determine the final number of qubits. This is the ground truth for all subsequent validation.
    const setQubitAction = actions.find((a): a is { type: 'set_qubit_count'; payload: { count: number } } => a.type === 'set_qubit_count');
    const finalNumQubits = setQubitAction ? setQubitAction.payload.count : numQubits;

    if (finalNumQubits < 2 || finalNumQubits > 5) {
        console.error("AI requested an invalid number of qubits:", finalNumQubits);
        return; // Abort if qubit count is out of bounds.
    }

    // 2. Establish the baseline circuit state before applying additive changes.
    let baseItems: PlacedItem[] = [...placedItems]; // Start with current state by default.
    
    const replaceAction = actions.find((a): a is { type: 'replace_circuit'; payload: ReplaceCircuitPayload } => a.type === 'replace_circuit');
    const clearAction = actions.find(a => a.type === 'clear_circuit');

    if (replaceAction) {
        // A replace action is definitive and ignores the current state. All items will be PlacedGate.
        baseItems = replaceAction.payload.map((g, i) => ({
            ...g,
            instanceId: `temp-replace-${i}`
        }));
    } else if (setQubitAction || clearAction) {
        // A qubit change or explicit clear results in an empty canvas.
        baseItems = [];
    }
    
    // 3. Apply any additive actions on top of the baseline. These are also PlacedGate.
    const addActions = actions.filter((a): a is { type: 'add_gate'; payload: AddGatePayload } => a.type === 'add_gate');
    
    const addedItems: PlacedGate[] = addActions.map((a, i) => ({
        ...a.payload,
        instanceId: `temp-add-${i}`
    }));

    const finalItemsRaw = [...baseItems, ...addedItems];
    
    const isValidItem = (item: PlacedItem, qCount: number): boolean => {
        // For custom gates, we just check the top qubit. The definition handles the span.
        if ('customGateId' in item) {
            return item.qubit >= 0 && item.qubit < qCount;
        }
        // For standard gates, check all involved qubits.
        if ('gateId' in item) {
            const targetQubitValid = item.qubit >= 0 && item.qubit < qCount;
            const controlQubitValid = item.controlQubit === undefined || (item.controlQubit >= 0 && item.controlQubit < qCount);
            return targetQubitValid && controlQubitValid;
        }
        return false;
    };

    // 4. Validate all items against the final qubit count and assign unique, final IDs.
    const validatedPlacedItems: PlacedItem[] = finalItemsRaw
        .filter(item => isValidItem(item, finalNumQubits))
        .map((item, i) => {
            const baseId = 'gateId' in item ? item.gateId : item.customGateId;
            return { ...item, instanceId: `${baseId}-${Date.now()}-${i}` };
        });

    if (validatedPlacedItems.length < finalItemsRaw.length) {
        console.warn("Some items were discarded by the validator as they were invalid for the final qubit count.");
    }
    
    // 5. Atomically apply the final state to React history.
    setState({
        ...state,
        numQubits: finalNumQubits,
        placedItems: validatedPlacedItems,
    });
    setSelectedItemIds([]);

    // Update visualizedQubit if it's now out of bounds.
    if (visualizedQubit >= finalNumQubits) {
        setVisualizedQubit(0);
    }
    
    // Switch to code tab if requested
    if (actions.some(a => a.type === 'generate_code')) {
        setActiveTab('code');
    }

  }, [numQubits, placedItems, visualizedQubit, setVisualizedQubit, setActiveTab, setState, state]);


  const handleSend = useCallback(async (prompt: string) => {
    if (prompt.trim() === '' || isAiLoading || !aiChatSession) return;
    setSelectedItemIds([]);
    setSimulationStep(null); // Exit step-through mode when interacting with AI

    const userMessage: Message = { type: 'text', sender: 'user', text: prompt };
    setMessages(prev => [...prev, userMessage]);
    
    const agentStatusMessage: Message = { type: 'agent_status', updates: [] };
    setMessages(prev => [...prev, agentStatusMessage]);
    setIsAiLoading(true);
    setActiveTab('copilot');

    const placedGates = placedItems.filter((i): i is PlacedGate => 'gateId' in i);

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
      const aiResponse = await getAgentResponse(aiChatSession, prompt, placedGates, simulationResult, numQubits, hardwareResult, onStatusUpdate);
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
  }, [isAiLoading, placedItems, executeActions, simulationResult, numQubits, hardwareResult, aiChatSession]);

  const handleAnalyzeCircuit = useCallback(() => {
    handleSend("Analyze my current circuit. Identify its purpose if it's a known algorithm or state, explain the principles behind it, and propose potential next steps or interesting modifications. If there are hardware results available, compare them to the ideal simulation and explain any differences.");
  }, [handleSend]);
  
  const handleDebugCircuit = useCallback(() => {
      handleSend("Debug my current circuit. Identify any logical errors or common mistakes for known algorithms. Explain the issue and, if possible, provide a corrected version of the circuit.");
  }, [handleSend]);

  const handleOptimizeCircuit = useCallback(() => {
      handleSend("Optimize my current circuit. Look for gate simplifications or ways to reduce the circuit depth and apply the changes.");
  }, [handleSend]);

  const handleClearCircuit = useCallback(() => {
    setState({ ...state, placedItems: [] });
    setSelectedItemIds([]);
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

  const handleComponentDrop = (componentId: string, point: { x: number; y: number }) => {
    if (!canvasRef.current) return;
    setSelectedItemIds([]);

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
      
      let newItem: PlacedItem;
      const gateInfo = gateMap.get(componentId);

      if (gateInfo) {
          const newGate: PlacedGate = {
              instanceId: `${componentId}-${Date.now()}`,
              gateId: componentId,
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
          newItem = newGate;
      } else {
          // It's a custom gate
          newItem = {
              instanceId: `${componentId}-${Date.now()}`,
              customGateId: componentId,
              qubit: qubitIndex,
              left: leftPercent,
          }
      }

      setState({ ...state, placedItems: [...state.placedItems, newItem] });
    }
  };
  
  const handlePointerMove = useCallback((event: PointerEvent) => {
    setDraggingComponent(g => g ? { ...g, point: { x: event.clientX, y: event.clientY } } : null);
  }, []);

  const handlePointerUp = useCallback((event: PointerEvent) => {
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    if (dragInfoRef.current.component) {
      handleComponentDrop(dragInfoRef.current.component.id, { x: event.clientX, y: event.clientY });
    }
    setIsDragging(false);
    setDraggingComponent(null);
    dragInfoRef.current.component = null;
  }, [handlePointerMove, handleComponentDrop]);

  const handleDragInitiate = (component: QuantumGate | CustomGateDefinition, event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
    setDraggingComponent({ component, point: { x: event.clientX, y: event.clientY } });
    dragInfoRef.current.component = component;
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };
  
  const handleSave = useCallback(() => {
    localStorage.setItem('milimo_quantum_circuit', JSON.stringify(state));
  }, [state]);

  const handleLoad = useCallback(() => {
    const savedState = localStorage.getItem('milimo_quantum_circuit');
    if (savedState) {
        try {
            const parsedState = JSON.parse(savedState);
            // Basic validation
            if (typeof parsedState.numQubits === 'number' && Array.isArray(parsedState.placedItems)) {
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

  const handleGroupSelection = useCallback(() => {
    const selectedGates = placedItems.filter(
      (item): item is PlacedGate => selectedItemIds.includes(item.instanceId) && 'gateId' in item
    );

    if (selectedGates.length <= 1) return;

    const name = prompt("Enter a name for your custom gate:");
    if (!name) return;

    const minLeft = Math.min(...selectedGates.map(g => g.left));
    const maxLeft = Math.max(...selectedGates.map(g => g.left));
    const width = maxLeft - minLeft;
    const minQubit = Math.min(...selectedGates.map(g => g.controlQubit ?? g.qubit), ...selectedGates.map(g => g.qubit));

    const relativeGates = selectedGates.map(gate => ({
      ...gate,
      qubit: gate.qubit - minQubit,
      controlQubit: gate.controlQubit !== undefined ? gate.controlQubit - minQubit : undefined,
      left: width > 0 ? ((gate.left - minLeft) / width) * 100 : 50,
    }));
    
    const newCustomGateDef: CustomGateDefinition = {
        id: `custom-${name.replace(/\s/g, '-')}-${Date.now()}`,
        name,
        color: 'text-orange-400', // Or a random color
        gates: relativeGates,
    };

    const newPlacedCustomGate = {
        instanceId: `${newCustomGateDef.id}-${Date.now()}`,
        customGateId: newCustomGateDef.id,
        qubit: minQubit,
        left: minLeft,
    };
    
    const newPlacedItems = placedItems.filter(item => !selectedItemIds.includes(item.instanceId));
    newPlacedItems.push(newPlacedCustomGate);

    setState({
        ...state,
        placedItems: newPlacedItems,
        customGateDefinitions: [...customGateDefinitions, newCustomGateDef],
    });
    setSelectedItemIds([]);

  }, [placedItems, selectedItemIds, state, customGateDefinitions, setState]);

  // --- Asynchronous Hardware Job Submission ---
  const handleRunOnHardware = useCallback(async (apiKey: string, backendName: string) => {
    // FIX: Refactored the condition to be more explicit and avoid potential linter errors.
    if (jobStatus === 'submitted' || jobStatus === 'queued' || jobStatus === 'running') return;
    
    setJobStatus('submitted');
    setJobId(null);
    setHardwareResult(null);
    setActiveTab('visualization');

    try {
        const rawCode = generateQiskitCode(placedItems, customGateDefinitions, numQubits, { highlight: false });
        
        // In a real application, you would uncomment the following block to call your backend.
        /*
        const response = await fetch('/api/submit-job', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                qiskitCode: rawCode,
                apiToken: apiKey,
                backendName: backendName,
            }),
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.statusText}`);
        }
        const { jobId: newJobId } = await response.json();
        */

        // --- SIMULATION FOR DEMO ---
        // Since the backend is not implemented, we'll simulate a successful submission.
        await new Promise(resolve => setTimeout(resolve, 1500));
        const newJobId = `mqs-job-${Date.now()}`;
        // --- END SIMULATION ---

        setJobId(newJobId);
        setJobStatus('queued'); // This kicks off the polling useEffect

    } catch (error) {
        console.error("Failed to submit job:", error);
        setJobStatus('error');
    }
  }, [jobStatus, placedItems, customGateDefinitions, numQubits]);


  // --- Asynchronous Hardware Job Polling & Result Fetching ---
  useEffect(() => {
    const clearPolling = () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
    
    const fetchJobResult = async (id: string) => {
      try {
        // In a real application, you would uncomment the following block.
        /*
        const response = await fetch(`/api/job-result/${id}`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        const result = countsToSimulationResult(data.counts, numQubits);
        */
        
        // --- SIMULATION FOR DEMO ---
        // Since the backend is not implemented, we'll simulate a noisy result.
        const hardwareNoiseModel = { depolarizing: 0.01, phaseDamping: 0.02 };
        const simResult = simulate(placedItems, numQubits, customGateDefinitions, hardwareNoiseModel);
        const shots = 1024;
        const counts = simResult.probabilities.reduce((acc, p) => {
            const state = p.state.replace(/[|⟩]/g, '');
            acc[state] = Math.round(p.value * shots);
            return acc;
        }, {} as {[key: string]: number});
        const result = countsToSimulationResult(counts, numQubits);
        // --- END SIMULATION ---
        
        setHardwareResult(result);
      } catch (error) {
        console.error('Error fetching job result:', error);
        setJobStatus('error');
      }
    };

    // FIX: This condition was potentially causing a TypeScript/linter error due to how type narrowing
    // was being inferred. Refactoring to a separate boolean variable clarifies the intent.
    const isTerminalStatus = jobStatus === 'idle' || jobStatus === 'completed' || jobStatus === 'error';
    if (!jobId || isTerminalStatus) {
      clearPolling();
      return;
    }

    if (!pollingIntervalRef.current) {
      pollingIntervalRef.current = window.setInterval(async () => {
        try {
            // In a real application, you would uncomment this block to poll your backend.
            /*
            const response = await fetch(`/api/job-status/${jobId}`);
            if (!response.ok) throw new Error('Status check failed');
            const { status } = await response.json();
            const serverStatus = status as JobStatus;
            setJobStatus(serverStatus);

            if (serverStatus === 'completed' || serverStatus === 'error') {
              clearPolling();
              if (serverStatus === 'completed') {
                await fetchJobResult(jobId);
              }
            }
            */
            
            // --- SIMULATION FOR DEMO ---
            // This simulates the backend returning a new status on each poll.
            setJobStatus(currentStatus => {
                let nextStatus: JobStatus = currentStatus;
                if (currentStatus === 'queued') {
                    nextStatus = 'running';
                } else if (currentStatus === 'running') {
                    nextStatus = 'completed';
                }

                // Logic to fetch results must be tied to the status change.
                if (nextStatus === 'completed') {
                    fetchJobResult(jobId);
                    clearPolling();
                } else if (nextStatus === 'error') {
                    clearPolling();
                }

                return nextStatus;
            });
            // --- END SIMULATION ---
        } catch (error) {
            console.error('Error polling job status:', error);
            setJobStatus('error');
            clearPolling();
        }
      }, 4000);
    }

    return clearPolling;
  }, [jobId, jobStatus, placedItems, numQubits, customGateDefinitions]);


  const isHardwareRunning = jobStatus === 'submitted' || jobStatus === 'queued' || jobStatus === 'running';

  return (
    <div className="bg-[#0a0a10] text-gray-200 min-h-screen flex flex-col font-sans relative" onClick={() => setSelectedItemIds([])}>
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
          <LeftPanel 
            onDragInitiate={handleDragInitiate} 
            draggingComponentId={draggingComponent?.component.id} 
            customGates={customGateDefinitions}
          />
          <div className="flex-grow flex flex-col gap-4">
            <CircuitCanvas 
              ref={canvasRef}
              numQubits={numQubits}
              onNumQubitsChange={handleNumQubitsChange}
              placedItems={placedItems}
              customGateDefs={customGateDefinitions}
              isDragging={isDragging} 
              onAnalyzeCircuit={handleAnalyzeCircuit}
              onDebugCircuit={handleDebugCircuit}
              onOptimizeCircuit={handleOptimizeCircuit}
              onClear={handleClearCircuit}
              onExplainGate={handleExplainGate}
              onGroupSelection={handleGroupSelection}
              selectedItemIds={selectedItemIds}
              onSelectItem={handleSelectItem}
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
            placedItems={placedItems}
            customGateDefs={customGateDefinitions}
            visualizedQubit={visualizedQubit}
            numQubits={numQubits}
            depolarizingError={depolarizingError}
            setDepolarizingError={setDepolarizingError}
            phaseDampingError={phaseDampingError}
            setPhaseDampingError={setPhaseDampingError}
            hardwareResult={hardwareResult}
            isHardwareRunning={isHardwareRunning}
            onRunOnHardware={handleRunOnHardware}
            jobId={jobId}
            jobStatus={jobStatus}
          />
        </main>
      </div>

      <AnimatePresence>
        {draggingComponent && (
          <motion.div
            className="absolute top-0 left-0"
            style={{ translateX: draggingComponent.point.x, translateY: draggingComponent.point.y, x: '-50%', y: '-50%', zIndex: 9999, pointerEvents: 'none' }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1.1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.1 }}
          >
            <QuantumGateComponent gate={draggingComponent.component} />
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