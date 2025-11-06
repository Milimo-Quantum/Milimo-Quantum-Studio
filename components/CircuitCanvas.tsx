import React, { forwardRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PlacedGate } from '../types';
import { gateMap } from '../data/gates';
import CNOTGateIcon from './icons/CNOTGateIcon';
import OptimizationAgentIcon from './icons/OptimizationAgentIcon';
import TrashIcon from './icons/TrashIcon';
import SwapTargetIcon from './icons/SwapTargetIcon';
import ExplanationAgentIcon from './icons/ExplanationAgentIcon';
import PlusIcon from './icons/PlusIcon';
import MinusIcon from './icons/MinusIcon';

interface CircuitCanvasProps {
  numQubits: number;
  onNumQubitsChange: (newNumQubits: number) => void;
  placedGates: PlacedGate[];
  isDragging: boolean;
  onAnalyzeCircuit: () => void;
  onClear: () => void;
  onExplainGate: (gateId: string) => void;
  selectedGateId: string | null;
  onSelectGate: (instanceId: string) => void;
  visualizedQubit: number;
  setVisualizedQubit: (qubitIndex: number) => void;
}

const QUBIT_LINE_HEIGHT = 64; // h-16
const GATE_WIDTH = 40; // w-10
const GATE_HEIGHT = 40; // h-10

const CircuitCanvas = forwardRef<HTMLDivElement, CircuitCanvasProps>(({ numQubits, onNumQubitsChange, placedGates, isDragging, onAnalyzeCircuit, onClear, onExplainGate, selectedGateId, onSelectGate, visualizedQubit, setVisualizedQubit }, ref) => {
  
  const handleGateClick = (e: React.MouseEvent, instanceId: string) => {
    e.stopPropagation();
    onSelectGate(instanceId);
  }
  
  const selectedGate = useMemo(() => {
    return placedGates.find(g => g.instanceId === selectedGateId);
  }, [placedGates, selectedGateId]);


  return (
    <motion.div
      ref={ref}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.3, ease: 'easeOut' }}
      className={`flex-grow bg-black/30 backdrop-blur-sm rounded-xl border border-gray-500/20 p-8 relative overflow-auto transition-all duration-300 ${isDragging ? 'border-cyan-400/50 ring-2 ring-cyan-400/50' : ''}`}
      style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(100, 100, 100, 0.3) 1px, transparent 0)',
        backgroundSize: '20px 20px',
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black/30"></div>
      
      <div className="relative w-full h-full flex flex-col justify-start z-0">
        {/* Qubit Lines */}
        {[...Array(numQubits)].map((_, i) => (
           <div
            key={`qubit-${i}`}
            className="relative flex items-center group cursor-pointer"
            style={{ height: `${QUBIT_LINE_HEIGHT}px` }}
            onClick={() => setVisualizedQubit(i)}
            >
            <span className={`absolute -left-12 font-mono text-sm select-none transition-colors ${visualizedQubit === i ? 'text-cyan-400' : 'text-gray-500'}`}>
                q[{i}]
            </span>
            <div className={`w-full h-px transition-all duration-300 ${visualizedQubit === i ? 'bg-cyan-400 scale-y-150' : 'bg-cyan-400/50 group-hover:bg-cyan-400/80'}`}></div>
            {visualizedQubit === i && (
                <motion.div
                layoutId="qubit-selection"
                className="absolute -inset-x-2 -inset-y-4 bg-cyan-500/10 rounded-lg"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{duration: 0.2}}
                />
            )}
            </div>
        ))}

        {/* Placed Gates */}
        <AnimatePresence>
        {placedGates.map(placedGate => {
          const gateInfo = gateMap.get(placedGate.gateId);
          if (!gateInfo) return null;

          const Icon = gateInfo.icon;
          const top = (placedGate.qubit * QUBIT_LINE_HEIGHT) + (QUBIT_LINE_HEIGHT / 2);
          const isSelected = placedGate.instanceId === selectedGateId;

          if (gateInfo.type === 'control' && placedGate.controlQubit !== undefined) {
            const controlY = (placedGate.controlQubit * QUBIT_LINE_HEIGHT) + (QUBIT_LINE_HEIGHT / 2);
            
            const containerTop = Math.min(top, controlY) - (GATE_HEIGHT / 2);
            const containerHeight = Math.abs(top - controlY) + GATE_HEIGHT;
            
            const isControlTop = controlY < top;

            // Target is on 'qubit', control is on 'controlQubit'
            const targetTop = isControlTop ? (containerHeight - GATE_HEIGHT) : 0;
            const controlTop = isControlTop ? 0 : (containerHeight - GATE_HEIGHT);

            if (placedGate.gateId === 'swap') {
                return (
                     <motion.div
                        key={placedGate.instanceId}
                        layout
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        className="absolute z-10 cursor-pointer"
                        style={{
                            left: `calc(${placedGate.left}% - ${GATE_WIDTH / 2}px)`,
                            top: `${containerTop}px`,
                            width: `${GATE_WIDTH}px`,
                            height: `${containerHeight}px`,
                        }}
                        onClick={(e) => handleGateClick(e, placedGate.instanceId)}
                    >
                         <div className="relative w-full h-full hover:bg-cyan-500/10 rounded-lg transition-colors">
                            <div
                                className="absolute bg-blue-400"
                                style={{
                                    left: `calc(50% - 1px)`,
                                    top: `${GATE_HEIGHT / 2}px`,
                                    height: `${containerHeight - GATE_HEIGHT}px`,
                                    width: '2px',
                                }}
                            />
                             <div className="absolute flex items-center justify-center" style={{ left: `calc(50% - 12px)`, top: targetTop + GATE_HEIGHT/2 - 12, width: '24px', height: '24px'}}>
                                <SwapTargetIcon className="w-5 h-5 text-blue-400"/>
                            </div>
                            <div className="absolute flex items-center justify-center" style={{ left: `calc(50% - 12px)`, top: controlTop + GATE_HEIGHT/2 - 12, width: '24px', height: '24px'}}>
                                <SwapTargetIcon className="w-5 h-5 text-blue-400"/>
                            </div>
                            {isSelected && (
                                <motion.div
                                    className="absolute -inset-1.5 rounded-lg border-2 border-cyan-400"
                                    layoutId="selectionRing"
                                />
                            )}
                        </div>
                    </motion.div>
                )
            }


            return (
                <motion.div
                  key={placedGate.instanceId}
                  layout
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  className="absolute z-10 cursor-pointer"
                  style={{
                    left: `calc(${placedGate.left}% - ${GATE_WIDTH / 2}px)`,
                    top: `${containerTop}px`,
                    width: `${GATE_WIDTH}px`,
                    height: `${containerHeight}px`,
                  }}
                  onClick={(e) => handleGateClick(e, placedGate.instanceId)}
                >
                  <div className="relative w-full h-full hover:bg-cyan-500/10 rounded-lg transition-colors">
                    <div
                      className="absolute bg-blue-400"
                      style={{
                        left: `calc(50% - 1px)`,
                        top: `${GATE_HEIGHT / 2}px`,
                        height: `${containerHeight - GATE_HEIGHT}px`,
                        width: '2px',
                      }}
                    />
                    <div
                      className="absolute w-3 h-3 bg-blue-400 rounded-full"
                      style={{
                        left: `calc(50% - 6px)`,
                        top: controlTop + GATE_HEIGHT/2 - 6
                      }}
                    />
                    <div
                      className="absolute flex items-center justify-center"
                      style={{
                        width: `${GATE_WIDTH}px`,
                        height: `${GATE_HEIGHT}px`,
                        left: 0,
                        top: targetTop,
                      }}
                    >
                      {placedGate.gateId === 'cnot' ? <CNOTGateIcon className="w-8 h-8 text-blue-400"/> : <div className="w-3 h-3 bg-blue-400 rounded-full" />}
                    </div>
                    {isSelected && (
                      <motion.div
                          className="absolute -inset-1.5 rounded-lg border-2 border-cyan-400"
                          layoutId="selectionRing"
                        />
                    )}
                  </div>
                </motion.div>
            )
          }

          return (
            <motion.div
              key={placedGate.instanceId}
              layout
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="absolute z-10 cursor-pointer"
              style={{
                left: `calc(${placedGate.left}% - 20px)`,
                top: `${top - 20}px`,
              }}
              onClick={(e) => handleGateClick(e, placedGate.instanceId)}
            >
              <div className={`relative flex items-center justify-center w-10 h-10 bg-gray-900/80 backdrop-blur-sm border rounded-lg ${gateInfo.color} border-current`}>
                <Icon className="w-6 h-6" />
                {isSelected && (
                   <motion.div
                      className="absolute -inset-1.5 rounded-lg border-2 border-cyan-400"
                      layoutId="selectionRing"
                    />
                )}
              </div>
            </motion.div>
          )
        })}
        {/* FIX: Corrected typo from AnatePresence to AnimatePresence */}
        </AnimatePresence>
      </div>
      
      <div className="absolute top-2 left-4 flex items-center gap-2">
         <div className="flex items-center gap-2 bg-gray-700/50 text-gray-400 px-3 py-1.5 rounded-md">
            <span className="text-xs font-mono">Qubits:</span>
            <button onClick={() => onNumQubitsChange(numQubits - 1)} disabled={numQubits <= 2} className="disabled:opacity-30 enabled:hover:text-white transition-colors">
                <MinusIcon className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono font-semibold text-base text-gray-200 w-4 text-center">{numQubits}</span>
            <button onClick={() => onNumQubitsChange(numQubits + 1)} disabled={numQubits >= 5} className="disabled:opacity-30 enabled:hover:text-white transition-colors">
                 <PlusIcon className="w-3.5 h-3.5" />
            </button>
        </div>
      </div>
      
      <div className="absolute top-2 right-4 flex items-center gap-2">
         <AnimatePresence>
          {selectedGate && (
            <motion.button
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              onClick={() => onExplainGate(selectedGate.gateId)}
              className="group flex items-center gap-2 text-xs font-mono bg-purple-500/20 text-purple-300 px-3 py-1.5 rounded-md hover:bg-purple-500/30 hover:text-purple-200 transition-all overflow-hidden whitespace-nowrap"
            >
              <ExplanationAgentIcon className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              <span className="flex-shrink-0">Explain Gate</span>
            </motion.button>
          )}
        </AnimatePresence>
         <button 
          onClick={onClear}
          className="group flex items-center gap-2 text-xs font-mono bg-gray-700/50 text-gray-400 px-3 py-1.5 rounded-md hover:bg-red-500/20 hover:text-red-300 transition-all"
          title="Clear Circuit"
        >
          <TrashIcon className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100 transition-opacity" />
          Clear
        </button>
        <button 
          onClick={onAnalyzeCircuit}
          className="group flex items-center gap-2 text-xs font-mono bg-gray-700/50 text-gray-400 px-3 py-1.5 rounded-md hover:bg-cyan-500/20 hover:text-cyan-300 transition-all"
        >
          <OptimizationAgentIcon className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100 transition-opacity" />
          Analyze Circuit
        </button>
      </div>

       <div className="absolute bottom-4 right-4 text-xs text-gray-600 font-['IBM_Plex_Mono']">
         Click a gate to select, then press{' '}
         <kbd className="px-1.5 py-0.5 border border-gray-700 rounded-md bg-gray-800">Delete</kbd> to remove.
      </div>
    </motion.div>
  );
});

export default CircuitCanvas;