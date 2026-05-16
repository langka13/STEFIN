import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, X, Sparkles, Loader2, Minimize2, Maximize2, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAI } from './hooks/useAI';

export default function AIAssistant({ contextData }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('stefin_ai_messages');
    return saved ? JSON.parse(saved) : [
      { role: 'assistant', content: 'Halo! Saya SteFin AI. Ada yang bisa saya bantu dengan keuangan Anda hari ini?' }
    ];
  });
  const [input, setInput] = useState('');
  const { askAI, loading } = useAI();
  const scrollRef = useRef(null);

  useEffect(() => {
    const handleTrigger = () => {
      handleAnalysis();
    };
    window.addEventListener('stefin_ai_analyze', handleTrigger);
    return () => window.removeEventListener('stefin_ai_analyze', handleTrigger);
  }, [contextData]); // Re-bind if context changes

  useEffect(() => {
    localStorage.setItem('stefin_ai_messages', JSON.stringify(messages));
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    const aiResponse = await askAI({
      prompt: input,
      context: contextData,
      type: 'chat'
    });

    if (aiResponse) {
      setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
    } else {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Maaf, saya sedang mengalami gangguan koneksi. Coba lagi nanti ya! 🙏' }]);
    }
  };

  const clearChat = () => {
    if (confirm('Hapus semua percakapan?')) {
      setMessages([{ role: 'assistant', content: 'Halo! Saya SteFin AI. Ada yang bisa saya bantu dengan keuangan Anda hari ini?' }]);
    }
  };

  const handleAnalysis = async () => {
    setIsOpen(true);
    setIsMinimized(false);
    const analysisPrompt = "Tolong berikan analisis keuangan mendalam saya untuk bulan ini. Berikan poin-poin penting dan saran tindakan.";
    
    setMessages(prev => [...prev, { role: 'user', content: 'Analisis Keuangan Saya 📊' }]);
    
    const aiResponse = await askAI({
      prompt: analysisPrompt,
      context: contextData,
      type: 'analysis'
    });

    if (aiResponse) {
      setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
    }
  };

  return (
    <>
      {/* Floating Analysis Trigger for Dashboard */}
      {!isOpen && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-lg shadow-emerald-500/30"
        >
          <Bot className="h-6 w-6" />
        </motion.button>
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.9 }}
            animate={{ 
              opacity: 1, 
              y: 0, 
              scale: 1,
              height: isMinimized ? 'auto' : '550px',
              width: isMinimized ? '280px' : '400px'
            }}
            exit={{ opacity: 0, y: 100, scale: 0.9 }}
            className={`fixed bottom-6 right-6 z-50 overflow-hidden rounded-[32px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl flex flex-col`}
          >
            {/* Header */}
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500 text-white">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-outfit font-bold">SteFin AI</div>
                  <div className="text-[10px] text-emerald-500 font-medium flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Online Assistant
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setIsMinimized(!isMinimized)} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-500">
                  {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
                </button>
                <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-rose-100 dark:hover:bg-rose-900/30 rounded-lg text-slate-500 hover:text-rose-500">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {!isMinimized && (
              <>
                {/* Messages */}
                <div 
                  ref={scrollRef}
                  className="flex-1 overflow-y-auto p-6 space-y-4 scroll-smooth bg-slate-50/50 dark:bg-slate-900/50"
                >
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                        msg.role === 'user' 
                          ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20 rounded-tr-none' 
                          : 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-200 shadow-sm rounded-tl-none'
                      }`}>
                        {msg.content.split('\n').map((line, j) => (
                          <p key={j} className={j > 0 ? 'mt-1' : ''}>{line}</p>
                        ))}
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex justify-start">
                      <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl px-4 py-3 shadow-sm rounded-tl-none">
                        <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Suggestions */}
                {messages.length < 3 && !loading && (
                  <div className="px-6 py-2 flex gap-2 overflow-x-auto no-scrollbar">
                    <button 
                      onClick={handleAnalysis}
                      className="whitespace-nowrap rounded-full border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950 px-3 py-1.5 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition"
                    >
                      📊 Analisis Bulan Ini
                    </button>
                    <button 
                      onClick={() => setInput("Bagaimana cara menabung lebih efektif?")}
                      className="whitespace-nowrap rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition"
                    >
                      💡 Tips Menabung
                    </button>
                  </div>
                )}

                {/* Input */}
                <form onSubmit={handleSend} className="p-4 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <button 
                      type="button" 
                      onClick={clearChat}
                      className="p-2.5 text-slate-400 hover:text-rose-500 transition"
                      title="Hapus Chat"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Tanya SteFin AI..."
                      className="flex-1 bg-slate-100 dark:bg-slate-900 border-none rounded-2xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!input.trim() || loading}
                      className="h-10 w-10 flex items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:shadow-none transition"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </form>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
