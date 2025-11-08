import React from 'react';
import { motion } from 'framer-motion';
import type { QuantumGate, CustomGateDefinition } from '../types';
import QuantumGateComponent from './QuantumGate';
import { gates } from '../data/gates';

interface LeftPanelProps {
    onDragInitiate: (gate: QuantumGate | CustomGateDefinition, event: React.PointerEvent) => void;
    draggingComponentId?: string;
    customGates: CustomGateDefinition[];
}

const DraggableComponent: React.FC<{
    component: QuantumGate | CustomGateDefinition,
    onDragInitiate: LeftPanelProps['onDragInitiate'],
    draggingComponentId?: string,
    animationDelay: number
}> = ({ component, onDragInitiate, draggingComponentId, animationDelay }) => {
    const isBeingDragged = component.id === draggingComponentId;

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: animationDelay }}
            className={isBeingDragged ? 'opacity-40' : ''}
            style={{ cursor: 'grab', touchAction: 'none' }}
            onPointerDown={(e) => onDragInitiate(component, e)}
        >
            <QuantumGateComponent gate={component} />
        </motion.div>
    )
}


const LeftPanel: React.FC<LeftPanelProps> = ({ onDragInitiate, draggingComponentId, customGates }) => {
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
          <DraggableComponent
            key={gate.id}
            component={gate}
            onDragInitiate={onDragInitiate}
            draggingComponentId={draggingComponentId}
            animationDelay={0.4 + index * 0.05}
          />
        ))}

        {customGates.length > 0 && (
            <>
                <div className="h-px bg-gray-700/50 my-2"></div>
                <p className="text-xs text-gray-500 font-['IBM_Plex_Mono'] uppercase tracking-wider mb-2">Custom Gates</p>
                {customGates.map((gate, index) => (
                    <DraggableComponent
                        key={gate.id}
                        component={gate}
                        onDragInitiate={onDragInitiate}
                        draggingComponentId={draggingComponentId}
                        animationDelay={0.4 + (gates.length + index) * 0.05}
                    />
                ))}
            </>
        )}
      </div>
    </motion.aside>
  );
};

export default LeftPanel;
