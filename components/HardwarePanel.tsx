import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import BackendIcon from './icons/BackendIcon';
import type { JobStatus } from '../types';
import KeyIcon from './icons/KeyIcon';

interface HardwarePanelProps {
  onRunOnHardware: (apiKey: string) => void;
  isRunning: boolean;
  jobId: string | null;
  jobStatus: JobStatus;
}

const mockBackends = [
    { name: 'milimo_quantum_processor_v1', qubits: 5, status: 'online' },
    { name: 'milimo_simulator_sv', qubits: 29, status: 'online' },
    { name: 'legacy_system_v3', qubits: 5, status: 'maintenance' },
];

const statusMessages: Record<JobStatus, string> = {
    idle: 'Awaiting submission.',
    submitted: 'Submitting job to backend...',
    queued: 'Job is in the queue.',
    running: 'Executing on quantum hardware...',
    completed: 'Job completed successfully.',
    error: 'An error occurred.',
};

const HardwarePanel: React.FC<HardwarePanelProps> = ({ onRunOnHardware, isRunning, jobId, jobStatus }) => {
  const [apiKey, setApiKey] = useState('');

  const handleRunClick = () => {
    if (apiKey.trim()) {
      onRunOnHardware(apiKey);
    } else {
      alert("Please enter a mock API key to proceed.");
    }
  };

  return (
    <motion.div
      key="hardware"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 flex flex-col font-['IBM_Plex_Mono'] text-sm"
    >
      <div className="flex-grow">
        <h3 className="text-gray-400 mb-2">Simulated Backends</h3>
        <div className="space-y-2 mb-4">
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

        <div>
            <label htmlFor="api-key" className="text-xs text-gray-400 mb-1 block">Provider API Key (mock)</label>
            <div className="relative">
                <KeyIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input 
                    id="api-key"
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your API key..."
                    disabled={isRunning}
                    className="w-full bg-gray-800/50 border border-gray-600/50 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all disabled:opacity-50"
                />
            </div>
        </div>

      </div>

      <div className="flex-shrink-0 border-t border-gray-700/50 pt-4">
          <AnimatePresence>
            {isRunning && (
                <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-xs text-gray-400 mb-3 overflow-hidden"
                >
                    <div className="flex justify-between mb-1">
                        <span>Job ID:</span>
                        <span className="text-gray-200 truncate">{jobId || '...'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Status:</span>
                        <span className="text-gray-200 capitalize">{jobStatus}</span>
                    </div>
                </motion.div>
            )}
           </AnimatePresence>
           <p className="text-xs text-center text-gray-500 mb-3">{statusMessages[jobStatus]}</p>

           <motion.button
            onClick={handleRunClick}
            disabled={isRunning || !apiKey}
            className="w-full bg-purple-600 text-white rounded-lg py-3 text-base font-semibold hover:bg-purple-500 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            whileTap={{ scale: isRunning || !apiKey ? 1 : 0.98 }}
          >
            {isRunning ? (
                <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Processing...</span>
                </>
            ) : (
                'Run on milimo_quantum_processor_v1'
            )}
          </motion.button>
           <p className="text-center text-xs text-gray-600 mt-3">
             Note: This is a simulation. No real hardware is used.
           </p>
      </div>
    </motion.div>
  );
};

export default HardwarePanel;
