import React, { forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PlacedGate } from '../types';
import { gateMap } from '../data/gates';
import CNOTGateIcon from './icons/CNOTGateIcon';
import OptimizationAgentIcon from './icons/OptimizationAgentIcon';

interface CircuitCanvasProps {
  placedGates: PlacedGate[];
  isDragging: boolean;
  onOptimize: () => void;
  selectedGateId: string | null;
  onSelectGate: (instanceId: string) => void;
}

const NUM_QUBITS = 3;
const QUBIT_LINE_HEIGHT = 64; // h-16
const GATE_WIDTH = 40; // w-10
const GATE_HEIGHT = 40; // h-10

const CircuitCanvas = forwardRef<HTMLDivElement, CircuitCanvasProps>(({ placedGates, isDragging, onOptimize, selectedGateId, onSelectGate }, ref) => {
  
  const handleGateClick = (e: React.MouseEvent, instanceId: string) => {
    e.stopPropagation();
    onSelectGate(instanceId);
  }

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
      
      <div className="relative w-full h-full flex flex-col justify-start">
        {/* Qubit Lines */}
        {[...Array(NUM_QUBITS)].map((_, i) => (
           <div key={`qubit-${i}`} className="relative flex items-center" style={{ height: `${QUBIT_LINE_HEIGHT}px` }}>
            <span className="absolute -left-10 text-gray-500 font-mono text-sm select-none">{i}]</span>
            <div className="w-full h-px bg-cyan-400/50"></div>
          </div>
        ))}

        {/* Render CNOT lines first */}
        {placedGates.map(placedGate => {
          const gateInfo = gateMap.get(placedGate.gateId);
          if (gateInfo?.type !== 'control' || placedGate.controlQubit === undefined) return null;

          const targetY = (placedGate.qubit * QUBIT_LINE_HEIGHT) + (QUBIT_LINE_HEIGHT / 2);
          const controlY = (placedGate.controlQubit * QUBIT_LINE_HEIGHT) + (QUBIT_LINE_HEIGHT / 2);

          const top = Math.min(targetY, controlY);
          const height = Math.abs(targetY - controlY);

          return (
             <motion.div
                key={`${placedGate.instanceId}-line`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute bg-blue-400"
                style={{
                  left: `calc(${placedGate.left}% - ${GATE_WIDTH / 2}px + ${GATE_WIDTH / 2}px)`,
                  top: `${top}px`,
                  height: `${height}px`,
                  width: '2px',
                  transform: 'translateX(-1px)'
                }}
             />
          );
        })}


        {/* Placed Gates */}
        <AnimatePresence>
        {placedGates.map(placedGate => {
          const gateInfo = gateMap.get(placedGate.gateId);
          if (!gateInfo) return null;

          const Icon = gateInfo.icon;
          const top = (placedGate.qubit * QUBIT_LINE_HEIGHT) + (QUBIT_LINE_HEIGHT / 2);
          const isSelected = placedGate.instanceId === selectedGateId;

          if (gateInfo.type === 'control') {
            const controlY = (placedGate.controlQubit! * QUBIT_LINE_HEIGHT) + (QUBIT_LINE_HEIGHT / 2);
            return (
              <React.Fragment key={placedGate.instanceId}>
                 {/* Clickable area for control gates */}
                <div
                  className="absolute z-20 cursor-pointer"
                  style={{
                    left: `calc(${placedGate.left}% - ${GATE_WIDTH/2}px)`,
                    top: `${Math.min(top, controlY) - GATE_HEIGHT/2}px`,
                    width: `${GATE_WIDTH}px`,
                    height: `${Math.abs(top - controlY) + GATE_HEIGHT}px`,
                  }}
                  onClick={(e) => handleGateClick(e, placedGate.instanceId)}
                />
                {/* Selection Highlight */}
                {isSelected && (
                   <motion.div
                      layoutId="selectionRing"
                      className="absolute rounded-full border-2 border-cyan-400"
                      style={{
                        left: `calc(${placedGate.left}% - 24px)`,
                        top: `${top - 24}px`,
                        width: '48px',
                        height: '48px',
                      }}
                      initial={{ opacity: 0, scale: 1.2 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8}}
                   />
                )}
                {/* Control Dot */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  className="absolute w-3 h-3 bg-blue-400 rounded-full"
                  style={{
                    left: `calc(${placedGate.left}% - 6px)`,
                    top: `${controlY - 6}px`,
                    pointerEvents: 'none',
                  }}
                />
                {/* Target Icon */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  className="absolute flex items-center justify-center w-8 h-8 z-10"
                  style={{
                    left: `calc(${placedGate.left}% - 16px)`,
                    top: `${top - 16}px`,
                    pointerEvents: 'none',
                  }}
                >
                  <CNOTGateIcon className="w-8 h-8 text-blue-400"/>
                </motion.div>
              </React.Fragment>
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
                      initial={{ opacity: 0, scale: 1.2 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8}}
                    />
                )}
              </div>
            </motion.div>
          )
        })}
        </AnimatePresence>
      </div>
      
      <div className="absolute top-2 right-4">
        <button 
          onClick={onOptimize}
          className="group flex items-center gap-2 text-xs font-mono bg-gray-700/50 text-gray-400 px-3 py-1.5 rounded-md hover:bg-cyan-500/20 hover:text-cyan-300 transition-all"
        >
          <OptimizationAgentIcon className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100 transition-opacity" />
          Optimize Circuit
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