
import React, { useRef, useState, useCallback, useEffect } from 'react';
import Header from './components/Header';
import LeftPanel from './components/LeftPanel';
import CircuitCanvas from './components/CircuitCanvas';
import RightPanel from './components/RightPanel';
import type { PlacedGate, QuantumGate, Message, AIAction, AgentStatusUpdate, SimulationResult, AddGatePayload, CircuitState, PlacedItem, CustomGateDefinition, RightPanelTab, JobStatus, ReplaceCircuitPayload, Backend, TutorResponse } from './types';
import { AnimatePresence, motion } from 'framer-motion';
import QuantumGateComponent from './components/QuantumGate';
import { getAgentResponse, getTutorResponse, generateQiskitCode, generateCirqCode, managerSystemInstruction } from './services/geminiService';
import { simulate } from './services/quantumSimulator';
import { gateMap } from './data/gates';
import { useHistory } from './hooks/useHistory';
import TutorNotification from './components/TutorNotification';
import ProjectModal from './components/ProjectModal';
import { Chat, GoogleGenAI } from '@google/genai';

const INITIAL_STATE: CircuitState = {
  numQubits: 3,
  placedItems: [],
  customGateDefinitions: [],
};

// Threshold for disabling live browser-based simulation
const MAX_LIVE_SIMULATION_QUBITS = 15; 
const MAX_QUBITS = 127;

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
  
  // --- Keyboard Navigation State ---
  const [cursorPosition, setCursorPosition] = useState<{ qubit: number, gridIndex: number } | null>(null);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  
  // --- UI Feedback State ---
  const [toast, setToast] = useState<{ message: string, type: 'info' | 'warning' | 'error' } | null>(null);


  const [messages, setMessages] = useState<Message[]>([
    { type: 'text', sender: 'ai', text: "Hello! I'm Milimo AI. You can give me complex challenges like 'build a quantum teleportation circuit' or give me step-by-step instructions like 'add a Hadamard to qubit 0'." },
  ]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  // --- Conversational AI State ---
  const [aiChatSession, setAiChatSession] = useState<Chat | null>(null);

  // --- Tutor Mode State ---
  const [isTutorModeActive, setIsTutorModeActive] = useState(false);
  const [tutorResponse, setTutorResponse] = useState<TutorResponse | null>(null);
  const [isTutorLoading, setIsTutorLoading] = useState(false);
  const tutorTimerRef = useRef<number | null>(null);

  // --- Noise Model State ---
  const [depolarizingError, setDepolarizingError] = useState(0);
  const [phaseDampingError, setPhaseDampingError] = useState(0);
  
  // --- Hardware Run State ---
  const [hardwareResult, setHardwareResult] = useState<SimulationResult | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus>('idle');
  const [runningBackend, setRunningBackend] = useState<Backend | null>(null);
  const pollingIntervalRef = useRef<number | null>(null);
  
  // --- Project Manager State ---
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [projectModalMode, setProjectModalMode] = useState<'save' | 'load'>('save');

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
        }
    };
    initializeChat();
  }, []);

  
  // --- Toast Auto-Dismiss ---
  useEffect(() => {
      if (toast) {
          const timer = setTimeout(() => setToast(null), 5000);
          return () => clearTimeout(timer);
      }
  }, [toast]);

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

  // --- Live & Stepped Simulation Engine (Main Thread Async) ---
  useEffect(() => {
    // Throttle simulation for large qubit counts
    if (numQubits > MAX_LIVE_SIMULATION_QUBITS) {
        setSimulationResult(null);
        return;
    }

    // Debounce and execute async to avoid blocking the main thread immediately on render
    const timer = setTimeout(() => {
        let itemsForSimulation = placedItems;
        if (simulationStep !== null) {
            const sortedItems = [...placedItems].sort((a, b) => a.left - b.left);
            itemsForSimulation = sortedItems.slice(0, simulationStep);
        }
        
        const noise = {
            depolarizing: depolarizingError,
            phaseDamping: phaseDampingError,
        };

        try {
             // The simulate function is synchronous CPU work, but wrapping in setTimeout allows UI updates to flush first
             const result = simulate(itemsForSimulation, numQubits, customGateDefinitions, noise);
             setSimulationResult(result);
        } catch (e) {
            console.error("Simulation failed", e);
        }

    }, 10);

    return () => clearTimeout(timer);

  }, [placedItems, numQubits, simulationStep, customGateDefinitions, depolarizingError, phaseDampingError]);

  // --- Live AI Tutor (Tutor 2.0) ---
  useEffect(() => {
    if (!isTutorModeActive || placedItems.length === 0) {
      setTutorResponse(null);
      setIsTutorLoading(false);
      if (tutorTimerRef.current) clearTimeout(tutorTimerRef.current);
      return;
    }
    
    // Disable Tutor physics insight for large circuits
    if (numQubits > MAX_LIVE_SIMULATION_QUBITS) {
        return;
    }

    if (tutorTimerRef.current) {
      clearTimeout(tutorTimerRef.current);
    }

    setIsTutorLoading(true);

    tutorTimerRef.current = window.setTimeout(async () => {
      try {
        // Send recent gates with parameters
        const circuitDescription = JSON.stringify(placedItems.map(g => ('gateId' in g ? { gate: g.gateId, qubit: g.qubit, control: g.controlQubit, params: g.params } : { customGate: g.customGateId, qubit: g.qubit })).slice(-5));
        
        // Compute Physics Snapshot for the Tutor
        const physicsContext = simulationResult ? {
             qubitStates: simulationResult.qubitStates.map((q, i) => ({
                 index: i,
                 purity: q.purity.toFixed(2),
                 bloch: { x: q.blochSphereCoords.x.toFixed(2), y: q.blochSphereCoords.y.toFixed(2), z: q.blochSphereCoords.z.toFixed(2) }
             }))
        } : {};
        
        const response = await getTutorResponse(circuitDescription, numQubits, JSON.stringify(physicsContext));
        setTutorResponse(response);
      } catch (error) {
        console.error("Tutor AI error:", error);
        setTutorResponse({ type: 'syntax', message: "I had trouble analyzing that. Please try a different action." });
      } finally {
        setIsTutorLoading(false);
      }
    }, 2000); // 2-second debounce after last change

    return () => {
      if (tutorTimerRef.current) {
        clearTimeout(tutorTimerRef.current);
      }
    };
  }, [placedItems, numQubits, isTutorModeActive, simulationResult]); 


  // --- Item Selection & Deletion & Keyboard Nav ---
  const handleSelectItem = (instanceId: string, isShiftPressed: boolean) => {
    setCursorPosition(null); // Clear cursor on mouse select
    setSelectedItemIds(prevIds => {
      if (isShiftPressed) {
        // Toggle selection
        return prevIds.includes(instanceId) ? prevIds.filter(id => id !== instanceId) : [...prevIds, instanceId];
      }
      // Single selection
      return prevIds.includes(instanceId) && prevIds.length === 1 ? [] : [instanceId];
    });
  };

  const handleMultiSelect = (instanceIds: string[]) => {
       setSelectedItemIds(instanceIds);
  };
  
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // If Quick Add is open, let it handle keys (except Escape which is handled here too potentially, but usually component handles it)
      if (isQuickAddOpen) return;
      // If Project Modal is open, ignore global keys except Esc handled by modal usually
      if (isProjectModalOpen) return;

      // Deletion
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
      
      // --- Phase 3: Navigation & Manipulation ---
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          // Manipulation Mode (Items selected)
          if (selectedItemIds.length > 0) {
             event.preventDefault(); // Prevent scroll
             const shift = event.shiftKey;
             const deltaLeft = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
             const deltaQubit = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
             
             setState({
                 ...state,
                 placedItems: state.placedItems.map(item => {
                     if (selectedItemIds.includes(item.instanceId)) {
                         let newQubit = item.qubit;
                         if (shift) newQubit = Math.max(0, Math.min(numQubits - 1, newQubit + deltaQubit));
                         
                         let newLeft = item.left;
                         // Updated: Remove clamp at 100 to allow endless expansion
                         if (!shift && deltaLeft !== 0) newLeft = Math.max(0, newLeft + deltaLeft * 2); // Nudge
                         
                         // Basic Control Qubit logic update (simple shift)
                         let newControl = ('gateId' in item && item.controlQubit !== undefined) ? item.controlQubit : undefined;
                         if(shift && newControl !== undefined) newControl = Math.max(0, Math.min(numQubits -1, newControl + deltaQubit));

                         return { ...item, qubit: newQubit, left: newLeft, controlQubit: newControl };
                     }
                     return item;
                 })
             });
             return;
          }
          
          // Navigation Mode (Cursor)
          event.preventDefault();
          setCursorPosition(prev => {
              if (!prev) return { qubit: 0, gridIndex: 0 };
              let newQubit = prev.qubit;
              let newGridIndex = prev.gridIndex;

              if (event.key === 'ArrowUp') newQubit = Math.max(0, newQubit - 1);
              if (event.key === 'ArrowDown') newQubit = Math.min(numQubits - 1, newQubit + 1);
              if (event.key === 'ArrowLeft') newGridIndex = Math.max(0, newGridIndex - 1);
              // Updated: Remove clamp at 9 (10 columns) to allow infinite scrolling
              if (event.key === 'ArrowRight') newGridIndex = newGridIndex + 1; 
              
              return { qubit: newQubit, gridIndex: newGridIndex };
          });
      }

      if (event.key === 'Enter') {
          if (cursorPosition && !isQuickAddOpen) {
              event.preventDefault();
              setIsQuickAddOpen(true);
          } else if (!cursorPosition && selectedItemIds.length === 0) {
              // If nothing selected and no cursor, start at 0,0
               setCursorPosition({ qubit: 0, gridIndex: 0 });
          }
      }

      if (event.key === 'Escape') {
          if (isQuickAddOpen) {
              setIsQuickAddOpen(false);
          } else if (selectedItemIds.length > 0) {
              setSelectedItemIds([]);
          } else if (cursorPosition) {
              setCursorPosition(null);
          }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItemIds, state, setState, undo, redo, isQuickAddOpen, cursorPosition, numQubits, isProjectModalOpen]);

  const handleQuickAddSelect = (gateId: string) => {
      if (!cursorPosition) return;
      
      const gateInfo = gateMap.get(gateId);
      if (!gateInfo) return;

      const left = cursorPosition.gridIndex * 10 + 5; // Center in the 10% cell
      
      const newGate: PlacedGate = {
          instanceId: `${gateId}-${Date.now()}`,
          gateId: gateId,
          qubit: cursorPosition.qubit,
          left: left,
          params: gateInfo.params ? Object.fromEntries(gateInfo.params.map(p => [p, 'pi'])) : undefined
      };

      if (gateInfo.type === 'control') {
           // Smart placement for control gates
           let controlIndex;
           if (cursorPosition.qubit < numQubits - 1) {
               controlIndex = cursorPosition.qubit + 1;
           } else {
               controlIndex = cursorPosition.qubit - 1;
           }
           if(gateInfo.id === 'swap') {
               newGate.controlQubit = controlIndex;
           } else {
               newGate.qubit = controlIndex;
               newGate.controlQubit = cursorPosition.qubit;
           }
      }

      setState({
          ...state,
          placedItems: [...state.placedItems, newGate]
      });
      setIsQuickAddOpen(false);
  };

  const handleNumQubitsChange = useCallback((newNumQubits: number) => {
    if (newNumQubits >= 2 && newNumQubits <= MAX_QUBITS) {
        // Smart Resize: Filter items that are now out of bounds
        const validItems = state.placedItems.filter(item => {
            if ('gateId' in item) {
                const targetValid = item.qubit < newNumQubits;
                const controlValid = item.controlQubit === undefined || item.controlQubit < newNumQubits;
                return targetValid && controlValid;
            } else if ('customGateId' in item) {
                const def = state.customGateDefinitions.find(d => d.id === item.customGateId);
                if (!def) return false;
                const maxRel = Math.max(...def.gates.map(g => Math.max(g.qubit, g.controlQubit ?? 0)));
                return (item.qubit + maxRel) < newNumQubits;
            }
            return false;
        });

      setState({
        ...state,
        numQubits: newNumQubits,
        placedItems: validItems
      });
      
      if (visualizedQubit >= newNumQubits) {
        setVisualizedQubit(0);
      }
    }
  }, [visualizedQubit, setState, state]);
  
  const handleUpdateItem = useCallback((instanceId: string, updates: Partial<PlacedGate>) => {
      setState({
          ...state,
          placedItems: state.placedItems.map(item => 
              item.instanceId === instanceId ? { ...item, ...updates } : item
          )
      });
  }, [state, setState]);


  const executeActions = useCallback((actions: AIAction[]) => {
    // 1. Determine the base qubit count requested by the AI.
    const setQubitAction = actions.find((a): a is { type: 'set_qubit_count'; payload: { count: number } } => a.type === 'set_qubit_count');
    const replaceAction = actions.find((a): a is { type: 'replace_circuit'; payload: ReplaceCircuitPayload } => a.type === 'replace_circuit');
    const clearAction = actions.find(a => a.type === 'clear_circuit');
    const addActions = actions.filter((a): a is { type: 'add_gate'; payload: AddGatePayload } => a.type === 'add_gate');

    // Initial assumption of final qubit count
    let finalNumQubits = setQubitAction ? setQubitAction.payload.count : numQubits;

    // --- Smart Canvas Expansion Logic ---
    // Calculate the maximum qubit index required by ALL pending gates.
    let maxRequiredQubit = -1;

    // Helper to get max qubit from a payload, accounting for batches
    const checkPayloadMaxQubit = (p: AddGatePayload) => {
        if (p.qubits) {
            p.qubits.forEach(q => {
                maxRequiredQubit = Math.max(maxRequiredQubit, q);
            });
        }
        if (p.qubit !== undefined) maxRequiredQubit = Math.max(maxRequiredQubit, p.qubit);
        if (p.controlQubit !== undefined) maxRequiredQubit = Math.max(maxRequiredQubit, p.controlQubit);
    }

    // Check gates from 'replace_circuit'
    if (replaceAction) {
        replaceAction.payload.forEach(g => checkPayloadMaxQubit(g));
    } else if (!setQubitAction && !clearAction) {
        // Preserving existing items, check them too
        placedItems.forEach(item => {
            if ('gateId' in item) {
                maxRequiredQubit = Math.max(maxRequiredQubit, item.qubit);
                if (item.controlQubit !== undefined) maxRequiredQubit = Math.max(maxRequiredQubit, item.controlQubit);
            } else if ('customGateId' in item) {
                 const def = state.customGateDefinitions.find(d => d.id === item.customGateId);
                 if (def) {
                     const maxRel = Math.max(...def.gates.map(g => Math.max(g.qubit, g.controlQubit ?? 0)));
                     maxRequiredQubit = Math.max(maxRequiredQubit, item.qubit + maxRel);
                 } else {
                     maxRequiredQubit = Math.max(maxRequiredQubit, item.qubit);
                 }
            }
        });
    }

    // Check gates from 'add_gate'
    addActions.forEach(a => checkPayloadMaxQubit(a.payload));

    // Apply Expansion
    if (maxRequiredQubit >= finalNumQubits) {
        const required = maxRequiredQubit + 1;
        if (required <= MAX_QUBITS) {
            console.log(`Smart Expansion: Upgrading from ${finalNumQubits} to ${required} qubits to fit circuit.`);
            finalNumQubits = required;
            setToast({ message: `Expanded canvas to ${finalNumQubits} qubits to fit design.`, type: 'info' });
        } else {
            setToast({ message: `Warning: Circuit requires ${required} qubits, exceeding limit of ${MAX_QUBITS}.`, type: 'warning' });
            // We let it clamp at validation step
        }
    }
    
    if (finalNumQubits < 2 || finalNumQubits > MAX_QUBITS) {
        console.error("AI requested an invalid number of qubits:", finalNumQubits);
        return;
    }

    // 2. Establish the baseline circuit state before applying additive changes.
    let baseItems: PlacedItem[] = [...placedItems]; // Start with current state by default.
    
    // Helper to unroll batched gates (qubits array -> multiple items)
    const expandPayload = (payload: AddGatePayload): PlacedGate[] => {
        if (payload.qubits && Array.isArray(payload.qubits) && payload.qubits.length > 0) {
             // Batched gate creation
             return payload.qubits.map((q: number) => ({
                 ...payload,
                 qubit: q,
                 qubits: undefined, // Remove the batch array from the final item
                 instanceId: `temp-batch-${Date.now()}-${Math.random()}`
             }));
        }
        // Standard single gate creation
        return [{ ...payload, instanceId: `temp-${Date.now()}-${Math.random()}` }];
    };

    if (replaceAction) {
        // A replace action is definitive and ignores the current state. All items will be PlacedGate.
        baseItems = [];
        replaceAction.payload.forEach(item => {
             baseItems.push(...expandPayload(item));
        });
    } else if (setQubitAction || clearAction) {
        // A qubit change or explicit clear results in an empty canvas.
        baseItems = [];
    }
    
    // 3. Apply any additive actions on top of the baseline.
    const addedItems: PlacedGate[] = [];
    addActions.forEach(action => {
        addedItems.push(...expandPayload(action.payload));
    });

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
        setToast({ message: "Warning: Some gates were invalid for the current qubit count and were discarded.", type: 'warning' });
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
    if (placedItems.length > 0 && window.confirm("Are you sure you want to clear the circuit? This action cannot be undone easily.")) {
        setState({ ...state, placedItems: [] });
        setSelectedItemIds([]);
        setSimulationStep(null);
        setCursorPosition(null);
    }
  }, [state, setState, placedItems]);

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
    // setSelectedItemIds([]); // Don't clear selection on drop for smoother flow if multi-select
    setCursorPosition(null);

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const scrollTop = canvasRef.current.scrollTop || 0;
    const scrollLeft = canvasRef.current.scrollLeft || 0;

    if (
      point.x >= canvasRect.left && point.x <= canvasRect.right &&
      point.y >= canvasRect.top && point.y <= canvasRect.bottom
    ) {
      const PADDING = 32;
      const QUBIT_LINE_HEIGHT = 64;

      // Add scrollTop to account for vertical scrolling within the canvas
      const relativeY = point.y - canvasRect.top - PADDING + scrollTop;
      let qubitIndex = Math.floor(relativeY / QUBIT_LINE_HEIGHT);
      qubitIndex = Math.max(0, Math.min(numQubits - 1, qubitIndex));

      // Add scrollLeft to account for horizontal scrolling
      const relativeX = point.x - canvasRect.left - PADDING + scrollLeft;
      const canvasContentWidth = canvasRect.width - PADDING * 2;
      
      // Updated: Remove the 100% clamp to allow dropping beyond the initial viewport
      const leftPercent = Math.max(0, (relativeX / canvasContentWidth) * 100);
      
      let newItem: PlacedItem;
      const gateInfo = gateMap.get(componentId);

      if (gateInfo) {
          const newGate: PlacedGate = {
              instanceId: `${componentId}-${Date.now()}`,
              gateId: componentId,
              qubit: qubitIndex,
              left: leftPercent,
              params: gateInfo.params ? Object.fromEntries(gateInfo.params.map(p => [p, 'pi'])) : undefined
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
                  newGate.qubit = controlIndex;
                  newGate.controlQubit = cursorPosition.qubit;
              }
          }
          newItem = newGate;
      } else {
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
    setProjectModalMode('save');
    setIsProjectModalOpen(true);
  }, []);

  const handleLoad = useCallback(() => {
    setProjectModalMode('load');
    setIsProjectModalOpen(true);
  }, []);
  
  const handleProjectLoaded = useCallback((loadedState: CircuitState) => {
      setState(loadedState, true);
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
  const handleRunOnHardware = useCallback(async (apiKey: string, backend: Backend) => {
    if (jobStatus === 'submitted' || jobStatus === 'queued' || jobStatus === 'running') return;
    
    setJobStatus('submitted');
    setJobId(null);
    setHardwareResult(null);
    setRunningBackend(backend);
    setActiveTab('visualization');

    try {
        let rawCode = '';
        if (backend.provider === 'google') {
             rawCode = generateCirqCode(placedItems, customGateDefinitions, numQubits, { highlight: false });
        } else {
             rawCode = generateQiskitCode(placedItems, customGateDefinitions, numQubits, { highlight: false });
        }
        
        console.log(`Submitting job to ${backend.provider} (${backend.name})... payload generated.`); 
        
        // Simulate backend delay
        // Simulators are faster than QPUs
        const delay = backend.type === 'simulator' ? 800 : 2500;
        await new Promise(resolve => setTimeout(resolve, delay));
        const newJobId = `mqs-job-${Date.now()}`;

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
        const isSimulator = runningBackend?.type === 'simulator';
        // If simulator: Run ideal simulation (noise = 0)
        // If QPU: Run noisy simulation (mock hardware noise)
        const noiseConfig = isSimulator 
            ? { depolarizing: 0, phaseDamping: 0 } 
            : { depolarizing: 0.01, phaseDamping: 0.02 };

        // For Hardware mock, we can still use the synchronous simulate for simplicity as it's one-off
        // But we should use the new adaptive simulate
        const simResult = simulate(placedItems, numQubits, customGateDefinitions, noiseConfig);
        const shots = 1024;
        
        // Sample from probabilities to get counts (Shot Noise)
        const counts: {[key: string]: number} = {};
        // Initialize counts
        simResult.probabilities.forEach(p => {
             const state = p.state.replace(/[|⟩]/g, '');
             counts[state] = 0;
        });

        // Monte Carlo sampling for shots
        for (let i = 0; i < shots; i++) {
            let r = Math.random();
            for (const p of simResult.probabilities) {
                r -= p.value;
                if (r <= 0) {
                    const state = p.state.replace(/[|⟩]/g, '');
                    counts[state] = (counts[state] || 0) + 1;
                    break;
                }
            }
        }

        const result = countsToSimulationResult(counts, numQubits);
        setHardwareResult(result);
      } catch (error) {
        console.error('Error fetching job result:', error);
        setJobStatus('error');
      }
    };

    const isTerminalStatus = jobStatus === 'idle' || jobStatus === 'completed' || jobStatus === 'error';
    if (!jobId || isTerminalStatus) {
      clearPolling();
      return;
    }

    if (!pollingIntervalRef.current) {
      // Polling interval faster for local simulator
      const interval = runningBackend?.type === 'simulator' ? 1000 : 4000;
      
      pollingIntervalRef.current = window.setInterval(async () => {
        try {
            setJobStatus(currentStatus => {
                let nextStatus: JobStatus = currentStatus;
                if (currentStatus === 'queued') {
                    nextStatus = 'running';
                } else if (currentStatus === 'running') {
                    nextStatus = 'completed';
                }

                if (nextStatus === 'completed') {
                    fetchJobResult(jobId);
                    clearPolling();
                } else if (nextStatus === 'error') {
                    clearPolling();
                }

                return nextStatus;
            });
        } catch (error) {
            console.error('Error polling job status:', error);
            setJobStatus('error');
            clearPolling();
        }
      }, interval);
    }

    return clearPolling;
  }, [jobId, jobStatus, placedItems, numQubits, customGateDefinitions, runningBackend]);


  const isHardwareRunning = jobStatus === 'submitted' || jobStatus === 'queued' || jobStatus === 'running';

  return (
    <div className="bg-[#0a0a10] text-gray-200 min-h-screen flex flex-col font-sans relative" onClick={() => { /* Let CircuitCanvas handle clicks to clear selection */ }}>
      <div className="absolute inset-0 z-0 opacity-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(120,81,250,0.2),_transparent_40%)]"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre-v2.png')] opacity-20"></div>
      </div>
      
      <div className="relative z-10 flex flex-col flex-grow h-screen"> {/* Ensure h-screen for layout */}
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
         <div className="px-4 pt-2 flex-shrink-0">
            <span className="text-xs font-mono bg-gray-700/50 text-gray-400 px-2 py-0.5 rounded">Preview</span>
        </div>
        <main className="flex flex-grow p-4 gap-4 min-h-0 overflow-hidden"> {/* min-h-0 is key for nested scroll */}
          <LeftPanel 
            onDragInitiate={handleDragInitiate} 
            draggingComponentId={draggingComponent?.component.id} 
            customGates={customGateDefinitions}
          />
          <div className="flex-grow flex flex-col gap-4 relative min-h-0">
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
              onMultiSelect={handleMultiSelect}
              visualizedQubit={visualizedQubit}
              setVisualizedQubit={setVisualizedQubit}
              simulationStep={simulationStep}
              setSimulationStep={setSimulationStep}
              onUpdateItem={handleUpdateItem}
              cursorPosition={cursorPosition}
              isQuickAddOpen={isQuickAddOpen}
              onCloseQuickAdd={() => setIsQuickAddOpen(false)}
              onQuickAddSelect={handleQuickAddSelect}
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
        response={tutorResponse}
        isLoading={isTutorLoading}
        onDismiss={() => setTutorResponse(null)}
      />

      {/* Global Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            transition={{ duration: 0.3 }}
            className={`fixed bottom-20 left-1/2 px-4 py-3 rounded-lg shadow-2xl backdrop-blur-md border z-50 text-sm font-mono flex items-center gap-3 ${
              toast.type === 'warning' 
                ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-200 shadow-[0_0_15px_rgba(234,179,8,0.2)]' 
                : 'bg-cyan-500/20 border-cyan-500/50 text-cyan-200 shadow-[0_0_15px_rgba(34,211,238,0.2)]'
            }`}
          >
             <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${toast.type === 'warning' ? 'bg-yellow-500/30' : 'bg-cyan-500/30'}`}>
                 {toast.type === 'warning' 
                    ? <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-yellow-400"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg> 
                    : <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-cyan-400"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                 }
             </div>
             {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
          {isProjectModalOpen && (
              <ProjectModal 
                  isOpen={isProjectModalOpen}
                  mode={projectModalMode}
                  currentState={state}
                  onClose={() => setIsProjectModalOpen(false)}
                  onLoadProject={handleProjectLoaded}
              />
          )}
      </AnimatePresence>
    </div>
  );
};

export default App;
