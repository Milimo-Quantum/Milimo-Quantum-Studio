import React, { useRef, useState, useCallback, useEffect } from 'react';
import Header from './components/Header';
import LeftPanel from './components/LeftPanel';
import CircuitCanvas from './components/CircuitCanvas';
import RightPanel from './components/RightPanel';
import type { PlacedGate, QuantumGate, Message, AIAction, AgentStatusUpdate, SimulationResult, CircuitTemplate } from './types';
import { AnimatePresence, motion } from 'framer-motion';
import QuantumGateComponent from './components/QuantumGate';
import { getAgentResponse } from './services/geminiService';
import { simulate } from './services/quantumSimulator';
import { gateMap } from './data/gates';

const App: React.FC = () => {
  const [numQubits, setNumQubits] = useState(3);
  const [placedGates, setPlacedGates] = useState<PlacedGate[]>([]);
  const [selectedGateId, setSelectedGateId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggingGate, setDraggingGate] = useState<{gate: QuantumGate, point: {x: number, y: number}} | null>(null);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [activeTab, setActiveTab] = useState<'copilot' | 'visualization' | 'code'>('copilot');
  const [visualizedQubit, setVisualizedQubit] = useState<number>(0);
  
  const [messages, setMessages] = useState<Message[]>([
    { type: 'text', sender: 'ai', text: "Hello! I'm Milimo AI. I can now analyze results and load templates. Try asking 'what is the probability of measuring |000>?' or 'load the bell state'." },
  ]);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const dragInfoRef = useRef<{ gate: QuantumGate | null }>({ gate: null });

  // --- Live Simulation Engine ---
  useEffect(() => {
    const result = simulate(placedGates, numQubits);
    setSimulationResult(result);
  }, [placedGates, numQubits]);

  // --- Gate Selection & Deletion ---
  const handleSelectGate = (instanceId: string) => {
    setSelectedGateId(prevId => prevId === instanceId ? null : instanceId);
  };
  
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.key === 'Backspace' || event.key === 'Delete') && selectedGateId) {
        setPlacedGates(prev => prev.filter(g => g.instanceId !== selectedGateId));
        setSelectedGateId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedGateId]);


  const executeActions = useCallback((actions: AIAction[]) => {
    actions.forEach(action => {
      switch (action.type) {
        case 'clear_circuit':
          setPlacedGates([]);
          break;
        case 'add_gate': {
          const newGate: PlacedGate = {
            ...action.payload,
            instanceId: `${action.payload.gateId}-${Date.now()}`,
          };
          setPlacedGates(prev => [...prev, newGate]);
          break;
        }
        case 'replace_circuit': {
          const gatesWithIds = action.payload.map((g, i) => ({
            ...g,
            instanceId: `${g.gateId}-${Date.now()}-${i}`,
          }));
          setPlacedGates(gatesWithIds);
          break;
        }
        case 'generate_code':
          setActiveTab('code');
          break;
        default:
          console.warn('Unknown AI action:', action);
      }
    });
  }, []);

  const handleSend = useCallback(async (prompt: string) => {
    if (prompt.trim() === '' || isAiLoading) return;
    setSelectedGateId(null);

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
      const aiMessage: Message = { type: 'text', sender: 'ai', text: aiResponse.displayText };
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

  const handleOptimize = useCallback(() => {
    handleSend("Optimize my current circuit");
  }, [handleSend]);
  
  const handleClearCircuit = useCallback(() => {
    setPlacedGates([]);
    setSelectedGateId(null);
  }, []);

  const handleShowVisualization = useCallback(() => {
    setActiveTab('visualization');
  }, []);
  
  const handleLoadTemplate = useCallback((template: CircuitTemplate) => {
    const gatesWithIds = template.gates.map((g, i) => ({
      ...g,
      instanceId: `${g.gateId}-${Date.now()}-${i}`,
    }));
    setPlacedGates(gatesWithIds);
    setSelectedGateId(null);
    setActiveTab('visualization');
  }, []);

  const handleExplainGate = useCallback((gateId: string) => {
    const gate = gateMap.get(gateId);
    if (gate) {
      handleSend(`Explain the ${gate.name} gate in simple terms, including its matrix and its effect on a qubit.`);
    }
  }, [handleSend]);

  const handleNumQubitsChange = (newNumQubits: number) => {
    if (newNumQubits >= 2 && newNumQubits <= 5) {
      setNumQubits(newNumQubits);
      setPlacedGates([]); // Clear circuit to prevent invalid gate placements
      setSelectedGateId(null);
      if (visualizedQubit >= newNumQubits) {
        setVisualizedQubit(0);
      }
    }
  };


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

      setPlacedGates(prev => [...prev, newGate]);
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

  return (
    <div className="bg-[#0a0a10] text-gray-200 min-h-screen flex flex-col font-sans relative" onClick={() => setSelectedGateId(null)}>
      <div className="absolute inset-0 z-0 opacity-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(120,81,250,0.2),_transparent_40%)]"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre-v2.png')] opacity-20"></div>
      </div>
      
      <div className="relative z-10 flex flex-col flex-grow">
        <Header onShowVisualization={handleShowVisualization} />
         <div className="px-4 pt-2">
            <span className="text-xs font-mono bg-gray-700/50 text-gray-400 px-2 py-0.5 rounded">Preview</span>
        </div>
        <main className="flex flex-grow p-4 gap-4">
          <LeftPanel onDragInitiate={handleDragInitiate} draggingGateId={draggingGate?.gate.id} onLoadTemplate={handleLoadTemplate}/>
          <div className="flex-grow flex flex-col gap-4">
            <CircuitCanvas 
              ref={canvasRef}
              numQubits={numQubits}
              onNumQubitsChange={handleNumQubitsChange}
              placedGates={placedGates} 
              isDragging={isDragging} 
              onOptimize={handleOptimize}
              onClear={handleClearCircuit}
              onExplainGate={handleExplainGate}
              selectedGateId={selectedGateId}
              onSelectGate={handleSelectGate}
              visualizedQubit={visualizedQubit}
              setVisualizedQubit={setVisualizedQubit}
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
    </div>
  );
};

export default App;