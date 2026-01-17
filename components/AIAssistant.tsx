import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, X, Bot } from 'lucide-react';
import { askAssistant } from '../services/openaiService';
import { Invoice } from '../types';
import { clsx } from 'clsx';

interface AIAssistantProps {
  invoices: Invoice[];
}

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({ invoices }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', text: "Hello! I have full visibility into the table. Ask me about specific PO Creators, pending values, or entity summaries." }
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if(isOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const handleAsk = async () => {
    if (!query.trim()) return;
    
    const userMsg = query;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setQuery('');
    setIsTyping(true);

    const answer = await askAssistant(userMsg, invoices);
    
    setIsTyping(false);
    setMessages(prev => [...prev, { role: 'assistant', text: answer || "Sorry, I couldn't process that data analysis." }]);
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        aria-label="Open AI Assistant"
        className="fixed bottom-6 right-6 w-16 h-16 bg-brand-600 hover:bg-brand-500 rounded-full shadow-[0_10px_30px_rgba(79,70,229,0.4)] flex items-center justify-center text-white transition-all hover:scale-110 z-40 group active:scale-95"
      >
        <Sparkles size={28} className="group-hover:rotate-12 transition-transform" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 h-[600px] bg-slate-900 border border-slate-700 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] flex flex-col z-40 overflow-hidden ring-1 ring-white/10 animate-in zoom-in-95 duration-200">
      <div className="p-5 bg-brand-600 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-3 text-white">
          <Bot size={24} className="text-white" />
          <div>
            <span className="block text-sm font-black uppercase tracking-widest leading-none">FinComms AI</span>
            <span className="text-[10px] font-bold text-brand-200 uppercase tracking-tighter opacity-80">Read-Only Analyst</span>
          </div>
        </div>
        <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-xl" aria-label="Close">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-slate-950">
        {messages.map((m, i) => (
          <div key={i} className={clsx("flex flex-col", m.role === 'user' ? "items-end" : "items-start")}>
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 px-2">
              {m.role === 'user' ? 'Direct Input' : 'Analyst Output'}
            </span>
            <div className={clsx(
              "max-w-[90%] p-4 rounded-2xl text-sm font-medium leading-relaxed shadow-sm",
              m.role === 'user' 
                ? "bg-brand-600 text-white rounded-br-none" 
                : "bg-slate-900 text-slate-200 rounded-bl-none border border-slate-800"
            )}>
              {m.text}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex flex-col items-start">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 px-2">Thinking...</span>
            <div className="bg-slate-900 p-4 rounded-2xl rounded-bl-none border border-slate-800 flex gap-1.5">
              <span className="w-2 h-2 bg-brand-500 rounded-full animate-bounce"></span>
              <span className="w-2 h-2 bg-brand-500 rounded-full animate-bounce delay-100"></span>
              <span className="w-2 h-2 bg-brand-500 rounded-full animate-bounce delay-200"></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-slate-800 bg-slate-900">
        <div className="relative">
          <input 
            className="w-full bg-slate-950 text-white text-sm rounded-2xl pl-5 pr-12 py-4 border border-slate-800 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-inner transition-all placeholder-slate-600"
            placeholder="Search analyst database..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
          />
          <button 
            onClick={handleAsk}
            disabled={!query.trim() || isTyping}
            className="absolute right-2 top-2 p-2.5 bg-brand-600 hover:bg-brand-500 rounded-xl text-white disabled:opacity-50 disabled:bg-slate-800 transition-all shadow-lg active:scale-95"
            aria-label="Send query"
          >
            <Send size={18} />
          </button>
        </div>
        <p className="text-[9px] text-slate-500 mt-3 text-center uppercase font-black tracking-widest">Read-Only Session • Non-Destructive Data Access</p>
      </div>
    </div>
  );
};