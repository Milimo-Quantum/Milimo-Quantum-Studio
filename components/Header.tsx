import React, { useState } from 'react';
import { motion } from 'framer-motion';
import LogoIcon from './icons/LogoIcon';
import PlayIcon from './icons/PlayIcon';
import UndoIcon from './icons/UndoIcon';
import RedoIcon from './icons/RedoIcon';
import SaveIcon from './icons/SaveIcon';
import LoadIcon from './icons/LoadIcon';
import ShareIcon from './icons/ShareIcon';

interface HeaderProps {
  onShowVisualization: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onSave: () => void;
  onLoad: () => void;
  onShare: () => void;
}

const Header: React.FC<HeaderProps> = ({ onShowVisualization, onUndo, onRedo, canUndo, canRedo, onSave, onLoad, onShare }) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleShareClick = () => {
    onShare();
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };
  
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

      <div className="flex items-center gap-2">
         <button onClick={onSave} className="group flex items-center gap-1.5 px-3 py-1.5 text-gray-400 hover:text-white rounded-md hover:bg-gray-700/50 transition-colors" title="Save Circuit (Ctrl+S)">
            <SaveIcon className="w-4 h-4" />
        </button>
        <button onClick={onLoad} className="group flex items-center gap-1.5 px-3 py-1.5 text-gray-400 hover:text-white rounded-md hover:bg-gray-700/50 transition-colors" title="Load Circuit (Ctrl+L)">
            <LoadIcon className="w-4 h-4" />
        </button>
        <button onClick={handleShareClick} className="group flex items-center gap-1.5 px-3 py-1.5 text-gray-400 hover:text-white rounded-md hover:bg-gray-700/50 transition-colors w-28 justify-center" title="Share Circuit (Copy Link)">
            {isCopied ? (
                <span className="text-xs text-cyan-300">Link Copied!</span>
            ) : (
                <ShareIcon className="w-4 h-4" />
            )}
        </button>
        <div className="w-px h-5 bg-gray-600/50 mx-1"></div>
        <button onClick={onUndo} disabled={!canUndo} className="group flex items-center gap-1.5 px-3 py-1.5 text-gray-400 hover:text-white rounded-md hover:bg-gray-700/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Undo (Ctrl+Z)">
            <UndoIcon className="w-4 h-4" />
        </button>
         <button onClick={onRedo} disabled={!canRedo} className="group flex items-center gap-1.5 px-3 py-1.5 text-gray-400 hover:text-white rounded-md hover:bg-gray-700/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Redo (Ctrl+Shift+Z)">
            <RedoIcon className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-grow flex justify-end items-center gap-2 text-sm">
        <button 
          onClick={onShowVisualization}
          className="group flex items-center gap-2 px-4 py-1.5 bg-cyan-500/10 text-cyan-300 rounded-md border border-cyan-500/20 hover:bg-cyan-500/20 transition-all"
        >
          <PlayIcon className="w-4 h-4" />
          Show Visualization
        </button>
      </div>
    </motion.header>
  );
};

export default Header;