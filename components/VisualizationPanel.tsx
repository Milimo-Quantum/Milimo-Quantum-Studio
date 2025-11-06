import React from 'react';
import { motion } from 'framer-motion';
import type { SimulationResult } from '../types';
import LogoIcon from './icons/LogoIcon';

interface VisualizationPanelProps {
  result: SimulationResult | null;
}

const VisualizationPanel: React.FC<VisualizationPanelProps> = ({ result }) => {
  const hasResult = result && result.probabilities.length > 0;

  return (
    <motion.div
      key="visualization"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col h-full gap-6 text-sm text-gray-300 font-['IBM_Plex_Mono']"
    >
      {!hasResult ? (
        <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
            <LogoIcon className="w-16 h-16 text-gray-700 mb-4" />
            <h3 className="text-lg font-semibold text-gray-400 font-['Space_Grotesk']">No Simulation Data</h3>
            <p className="max-w-xs mt-1">Build a circuit on the canvas and click "Run Simulation" in the header to see the results.</p>
        </div>
      ) : (
        <>
            <div>
                <h3 className="text-gray-400 mb-3">Measurement Probabilities</h3>
                <div className="space-y-2">
                {result.probabilities.map(p => (
                    <div key={p.state} className="flex items-center gap-3">
                    <span className="w-20 text-right text-gray-500">{p.state}</span>
                    <div className="flex-grow bg-gray-700/50 rounded-full h-4 overflow-hidden">
                        <motion.div
                        className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${p.value * 100}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                        />
                    </div>
                    <span className="w-12 text-left">{`${(p.value * 100).toFixed(1)}%`}</span>
                    </div>
                ))}
                </div>
            </div>
            
            <div>
                <h3 className="text-gray-400 mb-3">Bloch Sphere (q[0])</h3>
                <div className="w-full aspect-square bg-gray-800/50 border border-gray-600/50 rounded-lg flex items-center justify-center">
                    <div className="w-48 h-48 rounded-full border-2 border-dashed border-gray-600 relative flex items-center justify-center">
                        <span className="absolute top-1 text-xs text-gray-500">|0⟩</span>
                        <span className="absolute bottom-1 text-xs text-gray-500">|1⟩</span>
                        <div className="w-1 h-32 bg-gray-700 absolute"></div>
                        {/* State vector */}
                        <div className="absolute w-1 h-24 bg-purple-400 origin-bottom" style={{ transform: 'rotate(45deg) translateY(-24px)' }}>
                        <div className="w-2 h-2 bg-purple-300 rounded-full absolute -top-1 -left-0.5"></div>
                        </div>
                    </div>
                </div>
                <p className="text-center text-xs text-gray-500 mt-2">Interactive visualization placeholder</p>
            </div>
        </>
      )}
    </motion.div>
  );
};

export default VisualizationPanel;