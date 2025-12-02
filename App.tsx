import React, { useState, useEffect } from 'react';
import { ChatMessage, MessageSender, WorkoutLog, PERSONAS, PersonaId } from './types';
import * as GeminiService from './services/geminiService';
import * as StorageService from './services/storageService';
import * as AudioService from './services/audioService';
import ChatInterface from './components/ChatInterface';
import LogDashboard from './components/LogDashboard';
import AudioInput from './components/AudioInput';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'chat' | 'logs'>('chat');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // New States for Coach Persona & Audio
  const [currentPersonaId, setCurrentPersonaId] = useState<PersonaId>('standard');
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    // Load logs on mount
    setLogs(StorageService.getWorkoutLogs());
  }, []);

  const addMessage = (content: string, sender: MessageSender) => {
    setMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      sender,
      content,
      timestamp: Date.now()
    }]);
  };

  const handleSend = async (text: string, audioBase64?: string, mimeType?: string) => {
    if ((!text.trim() && !audioBase64) || isProcessing) return;

    setIsProcessing(true);
    setInput('');

    try {
      let processingText = text;

      // 1. Transcribe Audio (if present) before showing message
      if (audioBase64 && !text) {
          // Pass the mimeType to the transcriber to avoid hallucinations
          processingText = await GeminiService.transcribeAudio(audioBase64, mimeType);
      }

      // 2. Display User Message (Text or Transcribed Text)
      if (processingText) {
          addMessage(processingText, MessageSender.USER);
      } else {
          // Fallback if transcription failed or empty
          addMessage("🎤 (Unintelligible Audio)", MessageSender.USER);
          setIsProcessing(false);
          return;
      }

      console.log("Input processed as:", processingText);

      // 3. Front Desk Agent (Classifier)
      const intent = await GeminiService.classifyIntent(processingText);
      console.log("Classified intent:", intent);

      if (intent === 'LOG') {
        // 3a. Workout Logger Agent
        addMessage("Processing your workout data...", MessageSender.SYSTEM);
        
        // We pass the transcribed text to the logger
        const workoutData = await GeminiService.parseWorkoutLog(processingText); 
        
        // Save (Merge logic handled inside service)
        const { updatedLogs, wasMerged } = StorageService.saveWorkoutLog(workoutData);
        setLogs(updatedLogs);
        
        const summary = wasMerged
            ? `Merged new exercises into existing workout for ${workoutData.date || 'today'}.`
            : `Logged: ${workoutData.workout_type} workout with ${workoutData.exercises.length} exercises.`;
        
        addMessage(summary, MessageSender.AI);
        
      } else {
        // 3b. Coach Agent (Advice)
        const currentPersona = PERSONAS[currentPersonaId];
        const advice = await GeminiService.getCoachingAdvice(processingText, logs, currentPersona);
        
        addMessage(advice, MessageSender.AI);

        // 4. Text to Speech (if not muted)
        if (!isMuted) {
             const audioData = await GeminiService.generateSpeech(advice, currentPersona.geminiVoice);
             if (audioData) {
                 await AudioService.playAudioContent(audioData);
             }
        }
      }

    } catch (error) {
      console.error("Pipeline Error:", error);
      const msg = (error as any)?.message || String(error);
      if (msg.includes('No API key configured for GoogleGenAI')) {
        addMessage("AI unavailable: no API key configured. Add `VITE_API_KEY` to your `.env` (or copy from `.env.example`) or use a server-side proxy.", MessageSender.SYSTEM);
      } else {
        addMessage("Sorry, I encountered an error processing your request.", MessageSender.AI);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAudioCaptured = (blob: Blob, base64: string, mimeType: string) => {
      handleSend("", base64, mimeType);
  };

  return (
    <div className="flex flex-col h-full md:flex-row bg-gray-950 text-gray-100 font-sans">
      
      {/* Mobile Tab Switcher */}
      <div className="md:hidden flex border-b border-gray-800 bg-gray-900">
        <button 
          onClick={() => setActiveTab('chat')}
          className={`flex-1 p-4 text-sm font-bold uppercase tracking-wide ${activeTab === 'chat' ? 'text-neon-blue border-b-2 border-neon-blue' : 'text-gray-500'}`}
        >
          Chat
        </button>
        <button 
          onClick={() => setActiveTab('logs')}
          className={`flex-1 p-4 text-sm font-bold uppercase tracking-wide ${activeTab === 'logs' ? 'text-neon-green border-b-2 border-neon-green' : 'text-gray-500'}`}
        >
          Logs
        </button>
      </div>

      {/* Sidebar (Desktop) / Tab Content (Mobile) */}
      <div className={`
        ${activeTab === 'logs' ? 'block' : 'hidden'} 
        md:block md:w-96 md:border-r md:border-gray-800 bg-gray-900 overflow-y-auto
      `}>
        <LogDashboard logs={logs} />
      </div>

      {/* Main Chat Area */}
      <div className={`
        ${activeTab === 'chat' ? 'flex' : 'hidden'} 
        md:flex flex-col flex-1 h-full relative
      `}>
        {/* Header with Persona & Mute Controls */}
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-950/80 backdrop-blur z-10 sticky top-0">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-neon-blue rounded-full shadow-[0_0_10px_#00f3ff]"></div>
            <h1 className="font-bold text-lg tracking-wider hidden sm:block">AGENTIC <span className="text-gray-500 font-light">COACH</span></h1>
          </div>
          
          <div className="flex items-center gap-3">
             {/* Persona Selector */}
             <select 
                value={currentPersonaId}
                onChange={(e) => setCurrentPersonaId(e.target.value as PersonaId)}
                className="bg-gray-800 text-xs text-gray-300 border border-gray-700 rounded-lg px-2 py-1 outline-none focus:border-neon-blue transition-colors appearance-none cursor-pointer hover:bg-gray-700"
                disabled={isProcessing}
             >
                {Object.values(PERSONAS).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                ))}
             </select>

             {/* Mute Toggle */}
             <button
                onClick={() => setIsMuted(!isMuted)}
                className={`p-2 rounded-lg transition-colors ${isMuted ? 'text-gray-500 bg-gray-800' : 'text-neon-green bg-neon-green/10'}`}
                title={isMuted ? "Enable Speech" : "Mute Speech"}
             >
                {isMuted ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" stroke="currentColor" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                )}
             </button>
          </div>
        </div>

        <ChatInterface messages={messages} isProcessing={isProcessing} />

        {/* Input Area */}
        <div className="p-4 bg-gray-950 border-t border-gray-800">
          <div className="flex items-end gap-2 max-w-4xl mx-auto">
             <AudioInput onAudioCaptured={handleAudioCaptured} disabled={isProcessing} />
            
            <div className="flex-1 bg-gray-800 rounded-2xl border border-gray-700 focus-within:border-neon-blue transition-colors flex items-center p-1">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(input);
                  }
                }}
                placeholder="Log a workout or ask for advice..."
                className="w-full bg-transparent border-none text-gray-100 p-3 max-h-32 focus:ring-0 resize-none placeholder-gray-500"
                rows={1}
                disabled={isProcessing}
              />
              <button
                onClick={() => handleSend(input)}
                disabled={!input.trim() || isProcessing}
                className="p-2 mr-1 rounded-xl bg-neon-blue/10 text-neon-blue hover:bg-neon-blue/20 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
              </button>
            </div>
          </div>
          <div className="text-center mt-2">
            <p className="text-[10px] text-gray-600 uppercase tracking-widest">
              AI Agents Active: Front Desk • Logger • Coach ({PERSONAS[currentPersonaId].name})
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;