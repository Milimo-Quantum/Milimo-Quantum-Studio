
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Message } from '../types';
import LogoIcon from './icons/LogoIcon';
import AgentStatusDisplay from './AgentStatusDisplay';
import ExternalLinkIcon from './icons/ExternalLinkIcon';

interface CopilotChatProps {
  messages: Message[];
  isLoading: boolean;
  onSend: (prompt: string) => void;
}


const formatLine = (line: string): React.ReactNode => {
  const parts = line.split(/(\*\*.*?\*\*|`.*?`)/g).filter(Boolean);
  return parts.map((part, partIndex) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={partIndex}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={partIndex} className="bg-gray-900 font-mono text-xs rounded px-1.5 py-1 text-cyan-300">{part.slice(1, -1)}</code>;
    }
    return part;
  });
};

const renderFormattedText = (text: string) => {
  // Replace triple backticks for code blocks first
  const codeBlocksProcessed = text.split(/```(.*?)```/gs).map((part, index) => {
    if (index % 2 === 1) {
      // This is a code block
      return <pre key={index} className="bg-gray-900 p-3 rounded-lg text-xs font-mono my-2 overflow-x-auto"><code className="text-cyan-300">{part}</code></pre>;
    }
    return part;
  });

  const nodes = codeBlocksProcessed.flat().map((block, blockIndex) => {
    if (typeof block !== 'string') return block; // It's already a React node (our code block)

    const paragraphs = block.trim().split('\n\n');
    return paragraphs.map((para, paraIndex) => {
      if (para.match(/^(\s*[-*]\s+.*)/)) {
        const items = para.split('\n').map(item => item.trim().replace(/^[-*]\s+/, ''));
        return (
          <ul key={`${blockIndex}-${paraIndex}`} className="list-disc list-inside space-y-1 my-2 pl-2">
            {items.map((item, itemIndex) => <li key={itemIndex}>{formatLine(item)}</li>)}
          </ul>
        );
      }
      return <p key={`${blockIndex}-${paraIndex}`} className="my-1">{formatLine(para.replace(/\n/g, ' '))}</p>;
    });
  });

  return <>{nodes}</>;
};



const CopilotChat: React.FC<CopilotChatProps> = ({ messages, isLoading, onSend }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      // Reset height to auto to allow shrinking
      textareaRef.current.style.height = 'auto';
      // Set height to scrollHeight to fit content, capped at 150px
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSend(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderMessageContent = (msg: Message) => {
    switch (msg.type) {
      case 'text':
        return renderFormattedText(msg.text);
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
      className="absolute inset-0 flex flex-col"
    >
      <div className="flex-grow min-h-0 overflow-y-auto p-2 custom-scrollbar">
        <AnimatePresence>
          {messages.map((msg, index) => (
            <motion.div
              key={index}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
                <div className={`flex items-start gap-3 mb-2 ${msg.type === 'text' && msg.sender === 'user' ? 'justify-end' : ''}`}>
                { (msg.type === 'text' && msg.sender === 'ai' || msg.type === 'agent_status') && (
                    <div className="w-7 h-7 flex-shrink-0 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-full flex items-center justify-center mt-1">
                    <LogoIcon className="w-4 h-4 text-white" />
                    </div>
                )}
                <div className="flex-1 min-w-0"> {/* This container allows the bubble to shrink */}
                    <div
                    className={`max-w-[85%] inline-block p-3 rounded-xl text-sm ${
                        msg.type === 'text' && msg.sender === 'user'
                        ? 'bg-cyan-500/20 text-cyan-200 rounded-br-none float-right'
                        : 'bg-gray-700/50 text-gray-300 rounded-bl-none'
                    }`}
                    >
                    {renderMessageContent(msg)}
                    </div>
                </div>
                </div>
                
                {msg.type === 'text' && msg.sources && msg.sources.length > 0 && (
                    <div className="flex justify-start">
                        <div className="w-7 flex-shrink-0"></div>
                        <div className="flex-1 min-w-0 pl-3">
                             <div className="text-xs text-gray-400 font-mono mb-2">Sources:</div>
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-md">
                                {msg.sources.map((source, i) => (
                                    <a key={i} href={source.uri} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-300 bg-cyan-900/40 p-2 rounded-md hover:bg-cyan-900/60 transition-colors flex items-start gap-2 truncate">
                                        <ExternalLinkIcon className="w-3 h-3 mt-0.5 flex-shrink-0"/>
                                        <span className="truncate" title={source.title}>{source.title}</span>
                                    </a>
                                ))}
                            </div>
                        </div>
                   </div>
                )}

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
      <div className="flex-shrink-0 mt-4 flex items-end gap-2 border-t border-gray-500/20 pt-4">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Milimo AI... (Shift+Enter for new line)"
          rows={1}
          className="flex-grow bg-gray-800/50 border border-gray-600/50 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all resize-none custom-scrollbar leading-relaxed"
          disabled={isLoading}
          style={{ minHeight: '40px' }}
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          className="bg-cyan-500 text-black rounded-lg w-9 h-9 flex items-center justify-center flex-shrink-0 hover:bg-cyan-400 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed mb-0.5"
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
