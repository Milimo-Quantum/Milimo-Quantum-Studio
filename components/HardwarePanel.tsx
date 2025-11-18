
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import BackendIcon from './icons/BackendIcon';
import type { JobStatus } from '../types';
import KeyIcon from './icons/KeyIcon';

export interface Backend {
    name: string;
    provider: 'ibm' | 'google';
    qubits: number;
    status: 'online' | 'maintenance' | 'offline';
}

interface HardwarePanelProps {
  onRunOnHardware: (apiKey: string, backend: Backend) => void;
  isRunning: boolean;
  jobId: string | null;
  jobStatus: JobStatus;
}

const backends: Backend[] = [
    { name: 'ibm_brisbane', provider: 'ibm', qubits: 127, status: 'online' },
    { name: 'ibm_kyoto', provider: 'ibm', qubits: 127, status: 'maintenance' },
    { name: 'google_sycamore', provider: 'google', qubits: 53, status: 'online' },
    { name: 'google_weber', provider: 'google', qubits: 53, status: 'online' },
];

const statusMessages: Record<JobStatus, string> = {
    idle: 'Awaiting submission.',
    submitted: 'Submitting job to backend...',
    queued: 'Job is in the queue.',
    running: 'Executing on quantum hardware...',
    completed: 'Job completed successfully.',
    error: 'An error occurred during the job.',
};

const HardwarePanel: React.FC<HardwarePanelProps> = ({ onRunOnHardware, isRunning, jobId, jobStatus }) => {
  const [apiKey, setApiKey] = useState('');
  const [selectedBackendName, setSelectedBackendName] = useState<string>(backends[0].name);
  
  const selectedBackend = backends.find(b => b.name === selectedBackendName) || backends[0];

  const handleRunClick = () => {
    if (apiKey.trim()) {
      onRunOnHardware(apiKey, selectedBackend);
    } else {
      alert("An API Key from a provider is required to run on hardware.");
    }
  };
  
  const getProviderColor = (provider: 'ibm' | 'google') => {
      return provider === 'google' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
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
      <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar">
        <h3 className="text-gray-400 mb-2 sticky top-0 bg-[#0a0a10] z-10 py-1">Available Backends</h3>
        <div className="space-y-2 mb-4">
          {backends.map((backend, index) => (
              <motion.button
                  key={backend.name}
                  onClick={() => backend.status === 'online' && setSelectedBackendName(backend.name)}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 * index }}
                  disabled={backend.status !== 'online' || isRunning}
                  className={`w-full flex flex-col gap-2 p-3 rounded-lg border transition-all ${selectedBackendName === backend.name ? 'bg-gray-700/50 border-cyan-500/30 ring-1 ring-cyan-500/30' : 'bg-gray-800/30 border-gray-700/50'} ${backend.status === 'online' ? 'cursor-pointer hover:border-cyan-500/50' : 'cursor-not-allowed opacity-60'}`}
              >
                  <div className="w-full flex items-center justify-between">
                      <div className="flex items-center gap-3 text-left">
                          <BackendIcon className={`w-5 h-5 ${selectedBackendName === backend.name ? 'text-cyan-400' : 'text-gray-500'}`} />
                          <div>
                              <div className="flex items-center gap-2">
                                  <p className={`font-semibold ${selectedBackendName === backend.name ? 'text-white' : 'text-gray-400'}`}>{backend.name}</p>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getProviderColor(backend.provider)} uppercase tracking-wider`}>
                                    {backend.provider === 'ibm' ? 'IBM' : 'Google'}
                                  </span>
                              </div>
                              <p className="text-xs text-gray-500">{backend.qubits} Qubits</p>
                          </div>
                      </div>
                       <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${backend.status === 'online' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                      </div>
                  </div>
              </motion.button>
          ))}
        </div>

        <div>
            <label htmlFor="api-key" className="text-xs text-gray-400 mb-1 block">
                {selectedBackend.provider === 'google' ? 'Google Cloud Project ID / API Key' : 'IBM Quantum API Token'}
            </label>
            <div className="relative">
                <KeyIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input 
                    id="api-key"
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={selectedBackend.provider === 'google' ? "Enter Google credential..." : "Enter IBM Quantum token..."}
                    disabled={isRunning}
                    className="w-full bg-gray-800/50 border border-gray-600/50 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all disabled:opacity-50"
                />
            </div>
             <p className="text-[10px] text-gray-500 mt-1">
                {selectedBackend.provider === 'google' 
                    ? "Generates Cirq code. Simulates submission to Google Quantum Engine." 
                    : "Generates Qiskit code. Simulates submission to IBM Quantum Runtime."}
            </p>
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
            className={`w-full text-white rounded-lg py-3 text-base font-semibold transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-3 ${selectedBackend.provider === 'google' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-purple-600 hover:bg-purple-500'}`}
            whileTap={{ scale: isRunning || !apiKey ? 1 : 0.98 }}
          >
            {isRunning ? (
                <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Processing...</span>
                </>
            ) : (
                `Run on ${selectedBackend.name}`
            )}
          </motion.button>
           <p className="text-center text-xs text-gray-600 mt-3">
             Connects to a live quantum backend via a secure gateway.
           </p>
      </div>
    </motion.div>
  );
};

export default HardwarePanel;
