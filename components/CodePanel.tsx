import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { PlacedGate } from '../types';
import { generateQiskitCode } from '../services/geminiService';
import LogoIcon from './icons/LogoIcon';

interface CodePanelProps {
  placedGates: PlacedGate[];
  numQubits: number;
}

const CodePanel: React.FC<CodePanelProps> = ({ placedGates, numQubits }) => {
  const code = useMemo(() => generateQiskitCode(placedGates, numQubits), [placedGates, numQubits]);

  return (
    <motion.div
      key="code"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 flex flex-col font-['IBM_Plex_Mono']"
    >
      <div className="p-1 text-xs text-gray-400 border-b border-gray-500/20 mb-2">
        Qiskit (Python)
      </div>
      {placedGates.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
            <LogoIcon className="w-16 h-16 text-gray-700 mb-4" />
            <p className="max-w-xs mt-1 text-sm">Your circuit's code will appear here.</p>
            <p className="max-w-xs mt-2 text-xs">Ask Milimo AI to "create a bell state" to get started.</p>
        </div>
      ) : (
        <pre className="text-sm overflow-y-auto p-2">
          <code dangerouslySetInnerHTML={{ __html: code }} />
        </pre>
      )}

    </motion.div>
  );
};

export default CodePanel;