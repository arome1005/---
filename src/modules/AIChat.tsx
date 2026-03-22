import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Image as ImageIcon, FileText, User, Bot, Globe, AlertCircle, ChevronRight, MessageSquare } from 'lucide-react';
import { aiService } from '../aiService';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, limit } from 'firebase/firestore';
import { ChatMessage } from '../types';
import ReactMarkdown from 'react-markdown';

const SCENARIOS = [
  { id: 'hotel', name: 'Hotel Check-in', icon: '🏨', prompt: 'You are a hotel receptionist. I am a guest checking in.' },
  { id: 'restaurant', name: 'Ordering Food', icon: '🍴', prompt: 'You are a waiter in a restaurant. I am a customer ordering food.' },
  { id: 'airport', name: 'Airport Check-in', icon: '✈️', prompt: 'You are an airline staff at the check-in counter. I am a passenger.' },
  { id: 'interview', name: 'Job Interview', icon: '💼', prompt: 'You are a hiring manager. I am a candidate for a software engineer position.' },
];

const AIChat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, `users/${auth.currentUser.uid}/chats`),
      orderBy('timestamp', 'asc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
      setMessages(msgs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${auth.currentUser?.uid}/chats`);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading || !auth.currentUser) return;

    const userMsg = input.trim();
    setInput('');
    setIsLoading(true);

    try {
      // 1. Save user message to Firestore
      await addDoc(collection(db, `users/${auth.currentUser.uid}/chats`), {
        role: 'user',
        text: userMsg,
        timestamp: serverTimestamp(),
        type: 'text'
      });

      // 2. Get AI response
      const systemInstruction = activeScenario 
        ? SCENARIOS.find(s => s.id === activeScenario)?.prompt 
        : "You are a helpful English learning assistant. Help the user practice English. If they make a grammar mistake, gently point it out and suggest a better way to say it.";

      const response = await aiService.generateContent(userMsg, systemInstruction);

      // 3. Save AI response to Firestore
      await addDoc(collection(db, `users/${auth.currentUser.uid}/chats`), {
        role: 'model',
        text: response,
        timestamp: serverTimestamp(),
        type: 'text'
      });
    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const startScenario = (scenarioId: string) => {
    setActiveScenario(scenarioId);
    const scenario = SCENARIOS.find(s => s.id === scenarioId);
    if (scenario) {
      setInput(`Hello, I'd like to practice the "${scenario.name}" scenario.`);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
      {/* Header / Scenarios */}
      <div className="p-4 border-bottom bg-gray-50 flex items-center gap-3 overflow-x-auto no-scrollbar">
        <button 
          onClick={() => setActiveScenario(null)}
          className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${!activeScenario ? 'bg-blue-500 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
        >
          Free Chat
        </button>
        <div className="h-6 w-px bg-gray-200 mx-1" />
        {SCENARIOS.map(scenario => (
          <button
            key={scenario.id}
            onClick={() => startScenario(scenario.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap flex items-center gap-2 transition-colors ${activeScenario === scenario.id ? 'bg-blue-500 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
          >
            <span>{scenario.icon}</span>
            {scenario.name}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
            <div className="p-4 rounded-full bg-blue-50 text-blue-500">
              <MessageSquare size={48} />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">Start a conversation</p>
              <p className="text-sm text-gray-500">Practice your English with AI in real-time.</p>
            </div>
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex gap-3 max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-white border border-black/5 text-gray-600'}`}>
                  {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                <div className={`p-4 rounded-2xl shadow-sm ${msg.role === 'user' ? 'bg-blue-500 text-white rounded-tr-none' : 'bg-gray-50 text-gray-900 rounded-tl-none border border-black/5'}`}>
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="flex gap-3 flex-row">
              <div className="w-8 h-8 rounded-full bg-white border border-black/5 text-gray-600 flex items-center justify-center shadow-sm">
                <Bot size={16} />
              </div>
              <div className="p-4 rounded-2xl bg-gray-50 border border-black/5 flex gap-1">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 border-t bg-white">
        <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-2xl border border-black/5 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
          <button type="button" className="p-2 text-gray-400 hover:text-blue-500 transition-colors">
            <ImageIcon size={20} />
          </button>
          <button type="button" className="p-2 text-gray-400 hover:text-blue-500 transition-colors">
            <FileText size={20} />
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message in English..."
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className={`p-2 rounded-xl transition-all ${input.trim() && !isLoading ? 'bg-blue-500 text-white shadow-md hover:bg-blue-600' : 'text-gray-300 cursor-not-allowed'}`}
          >
            <Send size={20} />
          </button>
        </div>
      </form>
    </div>
  );
};

export default AIChat;
