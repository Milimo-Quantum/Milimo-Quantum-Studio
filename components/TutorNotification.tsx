import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import LightbulbIcon from './icons/LightbulbIcon';
import NoiseIcon from './icons/NoiseIcon';
import ChipIcon from './icons/ChipIcon';
import type { TutorResponse } from '../types';

interface TutorNotificationProps {
  response: TutorResponse | null;
  isLoading: boolean;
  onDismiss: () => void;
}

const TutorNotification: React.FC<TutorNotificationProps> = ({ response, isLoading, onDismiss }) => {
  
  const getIconAndColor = () => {
      if (!response) return { icon: LightbulbIcon, color: 'text-purple-300', bg: 'bg-purple-500/20', border: 'border-purple-500/30' };
      
      switch (response.type) {
          case 'physics':
              return { icon: NoiseIcon, color: 'text-cyan-300', bg: 'bg-cyan-500/20', border: 'border-cyan-500/30' };
          case 'hardware':
              return { icon: ChipIcon, color: 'text-green-300', bg: 'bg-green-500/20', border: 'border-green-500/30' };
          default:
              return { icon: LightbulbIcon, color: 'text-purple-300', bg: 'bg-purple-500/20', border: 'border-purple-500/30' };
      }
  };

  const { icon: Icon, color, bg, border } = getIconAndColor();

  return (
    <div className="fixed bottom-4 right-4 w-80 z-50">
      <AnimatePresence>
        {(isLoading || response) && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className={`bg-gray-900/90 backdrop-blur-lg border ${border} rounded-lg shadow-2xl p-4 flex items-start gap-3 relative overflow-hidden`}
          >
            {/* Loading Shimmer */}
            {isLoading && (
                 <div className="absolute top-0 left-0 w-full h-1 bg-gray-800 overflow-hidden">
                     <motion.div 
                        className="h-full bg-purple-500"
                        initial={{ x: '-100%' }}
                        animate={{ x: '100%' }}
                        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                     />
                 </div>
            )}

            <div className={`w-6 h-6 flex-shrink-0 ${bg} rounded-full flex items-center justify-center mt-0.5`}>
                <Icon className={`w-3.5 h-3.5 ${color}`} />
            </div>
            <div className="flex-grow text-sm text-gray-300 font-['IBM_Plex_Mono']">
              <h3 className={`font-semibold ${color} mb-1 capitalize`}>
                  {response?.type === 'physics' ? 'Physics Insight' : response?.type === 'hardware' ? 'Hardware Tip' : 'Tutor'}
              </h3>
              {isLoading && !response && (
                 <span className="text-xs text-gray-500">Analyzing circuit physics...</span>
              )}
              {response && <p className="leading-relaxed">{response.message}</p>}
            </div>
             <button onClick={onDismiss} className="text-gray-500 hover:text-white transition-colors flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
             </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TutorNotification;