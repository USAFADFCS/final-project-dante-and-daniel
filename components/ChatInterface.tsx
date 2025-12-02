import React, { useRef, useEffect } from 'react';
import { ChatMessage, MessageSender } from '../types';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  isProcessing: boolean;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, isProcessing }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6">
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-gray-500 opacity-60">
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-neon-green to-neon-blue mb-4">
                FITCOACH
            </h1>
            <p className="text-lg">Your agentic fitness companion.</p>
        </div>
      )}

      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex ${msg.sender === MessageSender.USER ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${
              msg.sender === MessageSender.USER
                ? 'bg-neon-blue text-gray-900 rounded-br-none font-medium'
                : 'bg-gray-800 text-gray-100 rounded-bl-none border border-gray-700'
            }`}
          >
            {msg.sender === MessageSender.AI && (
                <div className="text-xs text-neon-green font-bold mb-1 uppercase tracking-wider">
                    Coach AI
                </div>
            )}
            <div className="whitespace-pre-wrap leading-relaxed">
              {msg.content}
            </div>
          </div>
        </div>
      ))}

      {isProcessing && (
        <div className="flex justify-start">
          <div className="bg-gray-800 rounded-2xl rounded-bl-none p-4 border border-gray-700 flex items-center space-x-2">
            <div className="w-2 h-2 bg-neon-green rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-neon-green rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-neon-green rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
};

export default ChatInterface;