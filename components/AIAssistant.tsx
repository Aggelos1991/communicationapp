import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, X, Bot, Copy, Check } from 'lucide-react';
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

// Format message text with basic styling for professional display
const FormatMessage: React.FC<{ text: string; onCopyEmail?: (email: string) => void }> = ({ text, onCopyEmail }) => {
  const lines = text.split('\n');

  // Check if this is an email (contains [EMAIL] marker or Subject: line)
  const isEmail = text.includes('[EMAIL]') || text.toLowerCase().includes('subject:');
  const emailContent = text.replace('[EMAIL]', '').trim();

  return (
    <div className="space-y-0.5">
      {isEmail && onCopyEmail && (
        <button
          onClick={() => onCopyEmail(emailContent)}
          className="mb-3 w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold py-2 px-4 rounded-lg transition-all"
        >
          <Copy size={14} />
          Copy Email to Clipboard
        </button>
      )}
      {lines.map((line, i) => {
        // Skip [EMAIL] marker
        if (line.trim() === '[EMAIL]') return null;

        // Bold text between **
        const formatBold = (str: string) => {
          const parts = str.split(/\*\*(.*?)\*\*/g);
          return parts.map((part, idx) =>
            idx % 2 === 1 ? <strong key={idx} className="font-bold text-white">{part}</strong> : part
          );
        };

        // Headers (lines with === or lines that are all caps with :)
        if (line.includes('===')) {
          const cleanLine = line.replace(/=/g, '').trim();
          if (!cleanLine) return null;
          return (
            <div key={i} className="text-brand-400 font-bold text-[10px] uppercase tracking-wider mt-3 mb-1 border-b border-slate-700 pb-1">
              {cleanLine}
            </div>
          );
        }

        // Subject line for emails
        if (line.toLowerCase().startsWith('subject:') || line.toLowerCase().startsWith('asunto:')) {
          return (
            <div key={i} className="bg-brand-900/30 px-3 py-2 rounded-lg text-brand-300 font-semibold text-xs mt-2 mb-2 border border-brand-800/50">
              📧 {line}
            </div>
          );
        }

        // Bullet points with •
        if (line.trim().startsWith('•')) {
          return (
            <div key={i} className="pl-1 py-0.5 flex items-start gap-2">
              <span className="text-brand-400 mt-0.5">•</span>
              <span>{formatBold(line.trim().substring(1).trim())}</span>
            </div>
          );
        }

        // Bullet points with -
        if (line.trim().startsWith('-') && line.trim().length > 1) {
          return (
            <div key={i} className="pl-3 py-0.5 flex items-start gap-2 text-slate-300">
              <span className="text-slate-500">–</span>
              <span>{formatBold(line.trim().substring(1).trim())}</span>
            </div>
          );
        }

        // Numbered items
        if (/^\d+\./.test(line.trim())) {
          return (
            <div key={i} className="pl-1 py-0.5 flex items-start gap-2">
              <span className="text-brand-400 font-bold min-w-[20px]">{line.trim().match(/^\d+\./)?.[0]}</span>
              <span>{formatBold(line.trim().replace(/^\d+\./, '').trim())}</span>
            </div>
          );
        }

        // Empty lines
        if (line.trim() === '') {
          return <div key={i} className="h-1.5" />;
        }

        // Regular text
        return <div key={i} className="py-0.5">{formatBold(line)}</div>;
      })}
    </div>
  );
};

export const AIAssistant: React.FC<AIAssistantProps> = ({ invoices }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copied, setCopied] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', text: "Hello! I'm your **Finance Data Analyst**.\n\n**What I can do:**\n• Analyze specific invoices, vendors, or entities\n• Generate reports and summaries\n• Write professional emails in **English** or **Spanish**\n\n**Try asking:**\n• \"Tell me about invoice INV123\"\n• \"Show IPP invoices only\"\n• \"Write an email requesting invoice copy\"\n• \"Escribe un correo en español\"" }
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleCopyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

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
    <div className="fixed bottom-6 right-6 w-[420px] h-[650px] bg-slate-900 border border-slate-700 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] flex flex-col z-40 overflow-hidden ring-1 ring-white/10 animate-in zoom-in-95 duration-200">
      <div className="p-5 bg-gradient-to-r from-brand-600 to-brand-700 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-3 text-white">
          <div className="bg-white/20 p-2 rounded-xl">
            <Bot size={22} className="text-white" />
          </div>
          <div>
            <span className="block text-sm font-black uppercase tracking-widest leading-none">FinComms AI</span>
            <span className="text-[10px] font-bold text-brand-200 uppercase tracking-tight opacity-80">Data Analyst & Email Writer</span>
          </div>
        </div>
        <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-xl" aria-label="Close">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950">
        {messages.map((m, i) => (
          <div key={i} className={clsx("flex flex-col", m.role === 'user' ? "items-end" : "items-start")}>
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 px-2">
              {m.role === 'user' ? 'Your Query' : 'AI Response'}
            </span>
            <div className={clsx(
              "max-w-[95%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm",
              m.role === 'user'
                ? "bg-brand-600 text-white rounded-br-none font-medium"
                : "bg-slate-900 text-slate-200 rounded-bl-none border border-slate-800"
            )}>
              {m.role === 'assistant' ? <FormatMessage text={m.text} onCopyEmail={handleCopyEmail} /> : m.text}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex flex-col items-start">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 px-2">Analyzing...</span>
            <div className="bg-slate-900 p-4 rounded-2xl rounded-bl-none border border-slate-800 flex gap-1.5">
              <span className="w-2 h-2 bg-brand-500 rounded-full animate-bounce"></span>
              <span className="w-2 h-2 bg-brand-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
              <span className="w-2 h-2 bg-brand-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-slate-800 bg-slate-900">
        <div className="relative">
          <input
            className="w-full bg-slate-950 text-white text-sm rounded-2xl pl-5 pr-12 py-4 border border-slate-800 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-inner transition-all placeholder-slate-500"
            placeholder="Ask about data or request an email..."
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
        <div className="flex items-center justify-center gap-4 mt-3">
          <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">📊 Reports</span>
          <span className="text-slate-700">•</span>
          <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">📧 Emails EN/ES</span>
          <span className="text-slate-700">•</span>
          <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">📈 Analysis</span>
        </div>
      </div>
    </div>
  );
};
