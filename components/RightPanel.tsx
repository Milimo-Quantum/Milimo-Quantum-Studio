import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CopilotChat from './CopilotChat';
import VisualizationPanel from './VisualizationPanel';
import CodePanel from './CodePanel';
import type { Message, SimulationResult, PlacedGate } from '../types';

type Tab = 'copilot' | 'visualization' | 'code';

interface RightPanelProps {
  messages: Message[];
  isLoading: boolean;
  onSend: (prompt: string) => void;
  simulationResult: SimulationResult | null;
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  placedGates: PlacedGate[];
  visualizedQubit: number;
  numQubits: number;
}

const RightPanel: React.FC<RightPanelProps> = (props) => {
  const { activeTab, setActiveTab, simulationResult, placedGates, visualizedQubit, numQubits } = props;

  const tabs: { id: Tab, label: string }[] = [
    { id: 'copilot', label: 'Milimo AI' },
    { id: 'visualization', label: 'Visualization' },
    { id: 'code', label: 'Code' },
  ];

  return (
    <motion.aside
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.2, ease: 'easeOut' }}
      className="w-96 flex-shrink-0 bg-black/30 backdrop-blur-lg rounded-xl border border-gray-500/20 p-4 flex flex-col"
    >
      <div className="flex border-b border-gray-500/20 mb-4">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`${
              activeTab === tab.id ? 'text-cyan-400' : 'text-gray-400 hover:text-white'
            } relative flex-1 text-sm font-medium py-2 transition-colors`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <motion.div
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400"
                layoutId="underline"
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>
      <div className="relative flex-1 min-h-0">
        <AnimatePresence mode="wait">
          {activeTab === 'copilot' && <CopilotChat {...props} />}
          {activeTab === 'visualization' && <VisualizationPanel result={simulationResult} visualizedQubit={visualizedQubit} numQubits={numQubits} />}
          {activeTab === 'code' && <CodePanel placedGates={placedGates} numQubits={numQubits} />}
        </AnimatePresence>
      </div>
    </motion.aside>
  );
};

export default RightPanel;