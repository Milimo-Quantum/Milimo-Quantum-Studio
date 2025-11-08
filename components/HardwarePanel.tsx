import React from 'react';
import { motion } from 'framer-motion';
import BackendIcon from './icons/BackendIcon';

interface HardwarePanelProps {
  onRunOnHardware: () => void;
  isRunning: boolean;
}

const mockBackends = [
    { name: 'milimo_quantum_processor_v1', qubits: 5, status: 'online' },
    { name: 'milimo_simulator_sv', qubits: 29, status: 'online' },
    { name: 'legacy_system_v3', qubits: 5, status: 'maintenance' },
];

const HardwarePanel: React.FC<HardwarePanelProps> = ({ onRunOnHardware, isRunning }) => {
  return (
    <motion.div
      key="hardware"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 flex flex-col font-['IBM_Plex_Mono'] text-sm"
    >
      <h3 className="text-gray-400 mb-3">Simulated Backends</h3>
      <p className="text-xs text-gray-500 mb-4">
        Run your circuit on a simulated noisy quantum backend to compare ideal results with a more realistic outcome.
      </p>

      <div className="space-y-2 mb-6">
        {mockBackends.map((backend, index) => (
            <motion.div
                key={backend.name}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.1 * index }}
                className={`flex items-center justify-between p-3 rounded-lg border ${index === 0 ? 'bg-gray-700/50 border-cyan-500/30' : 'bg-gray-800/30 border-gray-700/50'}`}
            >
                <div className="flex items-center gap-3">
                    <BackendIcon className={`w-5 h-5 ${index === 0 ? 'text-cyan-400' : 'text-gray-500'}`} />
                    <div>
                        <p className={`font-semibold ${index === 0 ? 'text-white' : 'text-gray-400'}`}>{backend.name}</p>
                        <p className="text-xs text-gray-500">{backend.qubits} Qubits</p>
                    </div>
                </div>
                 <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${backend.status === 'online' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                    <span className="text-xs text-gray-400 capitalize">{backend.status}</span>
                </div>
            </motion.div>
        ))}
      </div>

       <motion.button
        onClick={onRunOnHardware}
        disabled={isRunning}
        className="w-full bg-purple-600 text-white rounded-lg py-3 text-base font-semibold hover:bg-purple-500 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        whileTap={{ scale: 0.98 }}
      >
        {isRunning ? (
            <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Running...</span>
            </>
        ) : (
            'Run on milimo_quantum_processor_v1'
        )}
      </motion.button>
       <p className="text-center text-xs text-gray-600 mt-3">
         Note: This is a simulation. No real hardware is used.
       </p>
    </motion.div>
  );
};

export default HardwarePanel;