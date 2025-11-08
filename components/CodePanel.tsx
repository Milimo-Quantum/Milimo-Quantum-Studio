import React, { useMemo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { PlacedItem, CustomGateDefinition } from '../types';
import { generateQiskitCode } from '../services/geminiService';
import LogoIcon from './icons/LogoIcon';
import CopyIcon from './icons/CopyIcon';

interface CodePanelProps {
  placedItems: PlacedItem[];
  customGateDefs: CustomGateDefinition[];
  numQubits: number;
}

const CodePanel: React.FC<CodePanelProps> = ({ placedItems, customGateDefs, numQubits }) => {
  const [hasCopied, setHasCopied] = useState(false);
  
  const rawCode = useMemo(() => generateQiskitCode(placedItems, customGateDefs, numQubits).replace(/<span.*?>|<\/span>/g, ''), [placedItems, customGateDefs, numQubits]);
  const highlightedCode = useMemo(() => generateQiskitCode(placedItems, customGateDefs, numQubits), [placedItems, customGateDefs, numQubits]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(rawCode);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  }, [rawCode]);


  return (
    <motion.div
      key="code"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 flex flex-col font-['IBM_Plex_Mono']"
    >
      <div className="flex justify-between items-center p-1 text-xs text-gray-400 border-b border-gray-500/20 mb-2">
        <span>Qiskit (Python)</span>
        {placedItems.length > 0 && (
          <button 
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-gray-400 hover:text-white px-2 py-0.5 rounded-md hover:bg-gray-700/50 transition-colors"
          >
            <CopyIcon className="w-3 h-3" />
            {hasCopied ? 'Copied!' : 'Copy Code'}
          </button>
        )}
      </div>
      {placedItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
            <LogoIcon className="w-16 h-16 text-gray-700 mb-4" />
            <p className="max-w-xs mt-1 text-sm">Your circuit's code will appear here.</p>
            <p className="max-w-xs mt-2 text-xs">Build a circuit on the canvas or ask Milimo AI to create one for you.</p>
        </div>
      ) : (
        <pre className="text-sm overflow-y-auto p-2">
          <code dangerouslySetInnerHTML={{ __html: highlightedCode }} />
        </pre>
      )}

    </motion.div>
  );
};

export default CodePanel;