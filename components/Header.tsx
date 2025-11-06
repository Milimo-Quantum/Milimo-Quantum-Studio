import React from 'react';
import { motion } from 'framer-motion';
import LogoIcon from './icons/LogoIcon';
import PlayIcon from './icons/PlayIcon';

interface HeaderProps {
  onRunSimulation: () => void;
}

const Header: React.FC<HeaderProps> = ({ onRunSimulation }) => {
  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="flex items-center justify-between p-3 border-b border-gray-500/20 bg-black/30 backdrop-blur-lg z-20"
    >
      <div className="flex items-center gap-3">
        <LogoIcon className="w-8 h-8 text-cyan-400" />
        <h1 className="text-xl font-bold font-['Space_Grotesk'] tracking-wider">
          Milimo <span className="text-cyan-400">Quantum Studio</span>
        </h1>
      </div>
      <div className="flex-grow flex justify-end items-center gap-2 text-sm">
        <button 
          onClick={onRunSimulation}
          className="group flex items-center gap-2 px-4 py-1.5 bg-cyan-500/10 text-cyan-300 rounded-md border border-cyan-500/20 hover:bg-cyan-500/20 transition-all"
        >
          <PlayIcon className="w-4 h-4" />
          Run Simulation
        </button>
      </div>
    </motion.header>
  );
};

export default Header;