
import React, { useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PlacedItem, CustomGateDefinition } from '../types';
import { generateQiskitCode, generateCirqCode } from '../services/geminiService';
import LogoIcon from './icons/LogoIcon';
import CopyIcon from './icons/CopyIcon';

interface CodePanelProps {
  placedItems: PlacedItem[];
  customGateDefs: CustomGateDefinition[];
  numQubits: number;
  depolarizingError: number;
  phaseDampingError: number;
}
type CodeType = 'ideal' | 'noisy';
type SDK = 'qiskit' | 'cirq';

const CodePanel: React.FC<CodePanelProps> = ({ placedItems, customGateDefs, numQubits, depolarizingError, phaseDampingError }) => {
  const [hasCopied, setHasCopied] = useState(false);
  const [codeType, setCodeType] = useState<CodeType>('ideal');
  const [sdk, setSdk] = useState<SDK>('qiskit');

  const codeGenOptions = useMemo(() => {
    if (codeType === 'noisy' && (depolarizingError > 0 || phaseDampingError > 0)) {
        return { 
            noiseModel: {
                depolarizing: depolarizingError,
                phaseDamping: phaseDampingError,
            }
        };
    }
    return {};
  }, [codeType, depolarizingError, phaseDampingError]);
  
  const rawCode = useMemo(() => {
      if (sdk === 'cirq') {
          return generateCirqCode(placedItems, customGateDefs, numQubits, { ...codeGenOptions, highlight: false });
      }
      return generateQiskitCode(placedItems, customGateDefs, numQubits, { ...codeGenOptions, highlight: false });
  }, [placedItems, customGateDefs, numQubits, codeGenOptions, sdk]);

  const highlightedCode = useMemo(() => {
      if (sdk === 'cirq') {
          return generateCirqCode(placedItems, customGateDefs, numQubits, { ...codeGenOptions, highlight: true });
      }
      return generateQiskitCode(placedItems, customGateDefs, numQubits, { ...codeGenOptions, highlight: true });
  }, [placedItems, customGateDefs, numQubits, codeGenOptions, sdk]);

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 text-xs text-gray-400 border-b border-gray-500/20 mb-2 bg-gray-900/30 backdrop-blur-md">
        <div className="flex items-center gap-2">
             <div className="flex items-center bg-gray-800 rounded-lg p-0.5 border border-gray-600/50">
                 <button 
                    onClick={() => setSdk('qiskit')}
                    className={`px-3 py-1 rounded-md transition-all ${sdk === 'qiskit' ? 'bg-blue-600/30 text-blue-300 shadow-inner' : 'text-gray-400 hover:text-gray-200'}`}
                 >
                    Qiskit
                </button>
                <button 
                    onClick={() => setSdk('cirq')}
                    className={`px-3 py-1 rounded-md transition-all ${sdk === 'cirq' ? 'bg-green-600/30 text-green-300 shadow-inner' : 'text-gray-400 hover:text-gray-200'}`}
                 >
                    Cirq
                </button>
            </div>
            <div className="w-px h-4 bg-gray-600/50 mx-1"></div>
            <div className="flex items-center gap-1 bg-gray-800/50 p-0.5 rounded-md">
                <button 
                    onClick={() => setCodeType('ideal')}
                    className={`px-2 py-0.5 rounded ${codeType === 'ideal' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                    Ideal
                </button>
                <button 
                    onClick={() => setCodeType('noisy')}
                    className={`px-2 py-0.5 rounded ${codeType === 'noisy' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                    Noisy
                </button>
            </div>
        </div>

        {placedItems.length > 0 && (
          <button 
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-gray-400 hover:text-white px-2 py-1.5 rounded-md hover:bg-gray-700/50 transition-colors border border-transparent hover:border-gray-600"
          >
            <CopyIcon className="w-3 h-3" />
            {hasCopied ? 'Copied!' : 'Copy'}
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
        <pre className="text-sm overflow-y-auto p-2 custom-scrollbar">
          <code dangerouslySetInnerHTML={{ __html: highlightedCode }} />
        </pre>
      )}

    </motion.div>
  );
};

export default CodePanel;
