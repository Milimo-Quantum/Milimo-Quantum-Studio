import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AgentStatusUpdate } from '../types';
import OrchestratorAgentIcon from './icons/OrchestratorAgentIcon';
import DesignAgentIcon from './icons/DesignAgentIcon';
import OptimizationAgentIcon from './icons/OptimizationAgentIcon';
import ExplanationAgentIcon from './icons/ExplanationAgentIcon';

interface AgentStatusDisplayProps {
  updates: AgentStatusUpdate[];
}

const agentIcons = {
  Orchestrator: OrchestratorAgentIcon,
  Design: DesignAgentIcon,
  Optimization: OptimizationAgentIcon,
  Explanation: ExplanationAgentIcon,
};

const AgentStatusDisplay: React.FC<AgentStatusDisplayProps> = ({ updates }) => {
  return (
    <div className="space-y-3 font-['IBM_Plex_Mono'] text-xs">
      <p className="font-semibold text-gray-400 mb-2">Milimo AI is thinking...</p>
      <AnimatePresence>
        {updates.map((update, index) => {
          const Icon = agentIcons[update.agent];
          const isCompleted = update.status === 'completed';

          return (
            <motion.div
              key={index}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="flex items-start gap-2"
            >
              <div className="flex flex-col items-center">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isCompleted ? 'bg-green-500/20' : 'bg-cyan-500/20 animate-pulse'}`}>
                  <Icon className={`w-3.5 h-3.5 ${isCompleted ? 'text-green-400' : 'text-cyan-400'}`} />
                </div>
                {index < updates.length - 1 && (
                    <div className="w-px h-4 bg-gray-600 mt-1"></div>
                )}
              </div>
              <div className="pt-0.5">
                <p className={`font-semibold ${isCompleted ? 'text-gray-400' : 'text-gray-200'}`}>{update.agent}</p>
                <p className="text-gray-500">{update.message}</p>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default AgentStatusDisplay;
