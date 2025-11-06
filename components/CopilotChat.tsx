import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Message } from '../types';
import LogoIcon from './icons/LogoIcon';
import AgentStatusDisplay from './AgentStatusDisplay';

interface CopilotChatProps {
  messages: Message[];
  isLoading: boolean;
  onSend: (prompt: string) => void;
}

const CopilotChat: React.FC<CopilotChatProps> = ({ messages, isLoading, onSend }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = () => {
    onSend(input);
    setInput('');
  };

  const renderMessageContent = (msg: Message) => {
    switch (msg.type) {
      case 'text':
        return <p className="break-words">{msg.text}</p>;
      case 'agent_status':
        return <AgentStatusDisplay updates={msg.updates} />;
      default:
        return null;
    }
  };

  return (
    <motion.div
      key="copilot"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col h-full"
    >
      <div className="flex-grow overflow-y-auto p-2 space-y-4">
        <AnimatePresence>
          {messages.map((msg, index) => (
            <motion.div
              key={index}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className={`flex items-start gap-3 ${msg.type === 'text' && msg.sender === 'user' ? 'justify-end' : ''}`}
            >
              { (msg.type === 'text' && msg.sender === 'ai' || msg.type === 'agent_status') && (
                <div className="w-7 h-7 flex-shrink-0 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-full flex items-center justify-center mt-1">
                  <LogoIcon className="w-4 h-4 text-white" />
                </div>
              )}
              <div className="flex-1 min-w-0"> {/* This container allows the bubble to shrink */}
                <div
                  className={`max-w-[80%] inline-block p-3 rounded-xl text-sm ${
                    msg.type === 'text' && msg.sender === 'user'
                      ? 'bg-cyan-500/20 text-cyan-200 rounded-br-none float-right'
                      : 'bg-gray-700/50 text-gray-300 rounded-bl-none'
                  }`}
                >
                  {renderMessageContent(msg)}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {isLoading && messages[messages.length-1]?.type !== 'agent_status' && (
           <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-3 items-center"
            >
              <div className="w-7 h-7 flex-shrink-0 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-full flex items-center justify-center">
                <LogoIcon className="w-4 h-4 text-white" />
              </div>
              <div className="p-3 bg-gray-700/50 rounded-xl rounded-bl-none">
                 <div className="flex gap-1.5">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.3s]"></span>
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.15s]"></span>
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse"></span>
                  </div>
              </div>
            </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="mt-4 flex items-center gap-2 border-t border-gray-500/20 pt-4">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask Milimo AI..."
          className="flex-grow bg-gray-800/50 border border-gray-600/50 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
          disabled={isLoading}
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          className="bg-cyan-500 text-black rounded-lg w-9 h-9 flex items-center justify-center flex-shrink-0 hover:bg-cyan-400 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
          </svg>
        </button>
      </div>
    </motion.div>
  );
};

export default CopilotChat;