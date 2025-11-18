
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { gates } from '../data/gates';

interface QuickAddMenuProps {
  isOpen: boolean;
  position: { top: number; left: string }; // CSS values relative to parent
  onClose: () => void;
  onSelectGate: (gateId: string) => void;
}

const QuickAddMenu: React.FC<QuickAddMenuProps> = ({ isOpen, position, onClose, onSelectGate }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredGates = useMemo(() => {
    if (!query) return gates;
    const lowerQuery = query.toLowerCase();
    return gates.filter(gate => 
      gate.name.toLowerCase().includes(lowerQuery) || 
      gate.id.toLowerCase().includes(lowerQuery) ||
      gate.description.toLowerCase().includes(lowerQuery)
    );
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      // Small timeout to ensure render before focus
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation(); // Prevent global app handlers

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filteredGates.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredGates[selectedIndex]) {
        onSelectGate(filteredGates[selectedIndex].id);
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
        className="absolute z-50 flex flex-col w-64 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden font-sans"
        style={{ top: position.top, left: position.left, marginTop: '40px' }}
    >
      <div className="flex items-center px-3 py-2 border-b border-gray-700 bg-gray-800/50">
        <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          className="w-full bg-transparent border-none focus:ring-0 text-sm text-white placeholder-gray-500"
          placeholder="Type to search gates..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
          onKeyDown={handleKeyDown}
          onBlur={() => {
              // Optional: Close on blur, but sometimes annoying if clicking scrollbar
              // setTimeout(onClose, 200);
          }}
        />
      </div>
      <div className="max-h-60 overflow-y-auto">
        {filteredGates.length === 0 ? (
            <div className="p-3 text-xs text-gray-500 text-center">No gates found</div>
        ) : (
            filteredGates.map((gate, index) => (
            <button
                key={gate.id}
                className={`w-full text-left px-3 py-2 text-xs flex items-center gap-3 transition-colors ${
                index === selectedIndex ? 'bg-cyan-500/20 text-white' : 'text-gray-300 hover:bg-gray-800'
                }`}
                onClick={() => { onSelectGate(gate.id); onClose(); }}
                onMouseEnter={() => setSelectedIndex(index)}
            >
                <div className={`w-6 h-6 rounded flex items-center justify-center border border-gray-600/50 bg-gray-800 ${gate.color}`}>
                    <gate.icon className="w-4 h-4" />
                </div>
                <div>
                    <div className="font-medium">{gate.name}</div>
                    <div className="text-[10px] text-gray-500 truncate max-w-[140px]">{gate.description}</div>
                </div>
            </button>
            ))
        )}
      </div>
      <div className="px-2 py-1 bg-gray-800/50 border-t border-gray-700 text-[10px] text-gray-500 flex justify-between">
          <span>Arguments: {filteredGates[selectedIndex]?.params ? filteredGates[selectedIndex].params?.join(', ') : 'None'}</span>
          <span className="font-mono">↵ to add</span>
      </div>
    </div>
  );
};

export default QuickAddMenu;
