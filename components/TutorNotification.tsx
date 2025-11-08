import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import LightbulbIcon from './icons/LightbulbIcon';

interface TutorNotificationProps {
  message: string | null;
  isLoading: boolean;
  onDismiss: () => void;
}

const TutorNotification: React.FC<TutorNotificationProps> = ({ message, isLoading, onDismiss }) => {
  return (
    <div className="fixed bottom-4 right-4 w-80 z-50">
      <AnimatePresence>
        {(isLoading || message) && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="bg-gray-900/80 backdrop-blur-lg border border-purple-500/30 rounded-lg shadow-2xl p-4 flex items-start gap-3"
          >
            <div className="w-6 h-6 flex-shrink-0 bg-purple-500/20 rounded-full flex items-center justify-center mt-0.5">
                <LightbulbIcon className="w-3.5 h-3.5 text-purple-300" />
            </div>
            <div className="flex-grow text-sm text-gray-300 font-['IBM_Plex_Mono']">
              <h3 className="font-semibold text-purple-300 mb-1">Tutor Mode</h3>
              {isLoading && !message && (
                <div className="flex gap-1.5 items-center h-10">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.3s]"></span>
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.15s]"></span>
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse"></span>
                </div>
              )}
              {message && <p>{message}</p>}
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