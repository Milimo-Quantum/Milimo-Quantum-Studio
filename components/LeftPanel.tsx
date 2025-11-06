import React from 'react';
import { motion } from 'framer-motion';
import type { QuantumGate } from '../types';
import QuantumGateComponent from './QuantumGate';
import { gates } from '../data/gates';

interface LeftPanelProps {
    onDragInitiate: (gate: QuantumGate, event: React.PointerEvent) => void;
    draggingGateId?: string;
}

const DraggableGate: React.FC<{
    gate: QuantumGate,
    onDragInitiate: LeftPanelProps['onDragInitiate'],
    draggingGateId?: string,
    animationDelay: number
}> = ({ gate, onDragInitiate, draggingGateId, animationDelay }) => {
    const isBeingDragged = gate.id === draggingGateId;

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: animationDelay }}
            className={isBeingDragged ? 'opacity-40' : ''}
            style={{ cursor: 'grab', touchAction: 'none' }}
            onPointerDown={(e) => onDragInitiate(gate, e)}
        >
            <QuantumGateComponent gate={gate} />
        </motion.div>
    )
}


const LeftPanel: React.FC<LeftPanelProps> = ({ onDragInitiate, draggingGateId }) => {
  return (
    <motion.aside
      initial={{ x: -300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.2, ease: 'easeOut' }}
      className="w-64 flex-shrink-0 bg-black/30 backdrop-blur-lg rounded-xl border border-gray-500/20 p-4 flex flex-col gap-4"
    >
      <h2 className="text-lg font-['Space_Grotesk'] font-semibold text-gray-300">Components</h2>
      <div className="flex flex-col gap-2 overflow-y-auto overflow-x-hidden">
        <p className="text-xs text-gray-500 font-['IBM_Plex_Mono'] uppercase tracking-wider mb-2">Quantum Gates</p>
        {gates.map((gate, index) => (
          <DraggableGate
            key={gate.id}
            gate={gate}
            onDragInitiate={onDragInitiate}
            draggingGateId={draggingGateId}
            animationDelay={0.4 + index * 0.05}
          />
        ))}
      </div>
    </motion.aside>
  );
};

export default LeftPanel;