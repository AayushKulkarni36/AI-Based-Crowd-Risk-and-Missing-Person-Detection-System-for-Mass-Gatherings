import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, X, Mic, SendHorizontal, Volume2, VolumeX } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'bot';
  text: string;
  timestamp: Date;
  action?: {
    type: string;
    path: string;
    label: string;
    autoExecute?: boolean;
  };
}

type Lang = 'en' | 'hi' | 'mr';

function useSpeechInput(onResult: (text: string) => void, lang: Lang) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const langCodes: Record<Lang, string> = { en: 'en-US', hi: 'hi-IN', mr: 'mr-IN' };
  const isSupported = typeof window !== 'undefined'
    && ('webkitSpeechRecognition' in (window as any) || 'SpeechRecognition' in (window as any));

  const start = () => {
    if (!isSupported) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = langCodes[lang] || 'en-US';
    rec.continuous = false;
    rec.interimResults = false;
    rec.onstart = () => setIsListening(true);
    rec.onend = () => setIsListening(false);
    rec.onerror = () => setIsListening(false);
    rec.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      onResult(text);
      setIsListening(false);
    };
    rec.start();
    recognitionRef.current = rec;
  };

  const stop = () => {
    recognitionRef.current?.stop?.();
    setIsListening(false);
  };

  return { start, stop, isListening, isSupported };
}

export default function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [language, setLanguage] = useState<Lang>('en');
  const [unreadCount, setUnreadCount] = useState(0);
  const [ttsEnabled, setTtsEnabled] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  const welcomeMessage = useMemo(() => ({
    id: 'welcome',
    role: 'bot' as const,
    text: language === 'hi'
      ? 'नमस्ते! मैं CrowdSafe AI हूं। भीड़, लापता व्यक्तियों, या अलर्ट के बारे में पूछें।'
      : language === 'mr'
      ? 'नमस्कार! मी CrowdSafe AI आहे. गर्दी, हरवलेले व्यक्ती, किंवा इशाऱ्यांबद्दल विचारा.'
      : 'Hello! I\'m CrowdSafe AI. Ask me about crowd status, missing persons, or alerts. Type "help" for all commands.',
    timestamp: new Date()
  }), [language]);

  const { start, stop, isListening, isSupported } = useSpeechInput((text) => {
    setInput(text);
  }, language);

  const speak = (text: string, lang: Lang) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = { en: 'en-US', hi: 'hi-IN', mr: 'mr-IN' }[lang];
    utterance.rate = 0.9;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  };

  const toggleListening = () => {
    if (!isSupported) return;
    if (isListening) stop();
    else start();
  };

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([welcomeMessage]);
    }
  }, [welcomeMessage, messages.length]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ message: text, language })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Request failed');

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'bot',
        text: data.text,
        timestamp: new Date(),
        action: data.action
      };
      setMessages(prev => [...prev, botMsg]);

      if (ttsEnabled) speak(data.text, language);
      if (!isOpen) setUnreadCount(prev => prev + 1);
      if (data.action?.autoExecute && data.action?.type === 'navigate') {
        window.setTimeout(() => navigate(data.action.path), 800);
      }
    } catch (_err) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'bot',
        text: 'Sorry, I could not connect to the server. Please check your connection.',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const placeholder = {
    en: 'Ask about crowd status, alerts...',
    hi: 'भीड़, अलर्ट के बारे में पूछें...',
    mr: 'गर्दी, इशाऱ्यांबद्दल विचारा...'
  }[language];

  const micTooltip = language === 'hi' ? 'बोलने के लिए क्लिक करें' : 'Click to speak';

  const onTextareaKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-24 right-0 w-[380px] h-[520px] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="bg-slate-800 border-b border-slate-700 p-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center text-white text-sm">
                  AI
                </div>
                <div className="text-sm font-semibold text-white">CrowdSafe AI</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTtsEnabled(prev => !prev)}
                  className={`p-1.5 rounded-md ${ttsEnabled ? 'text-blue-300' : 'text-slate-400 hover:text-white'}`}
                  title={ttsEnabled ? 'Disable voice' : 'Enable voice'}
                >
                  {ttsEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>
                <div className="flex bg-slate-700 rounded-lg p-1">
                  {(['en', 'hi', 'mr'] as Lang[]).map((l) => (
                    <button
                      key={l}
                      onClick={() => setLanguage(l)}
                      className={`px-2 py-0.5 text-xs rounded-md uppercase ${language === l ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white">
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {messages.map((msg) => (
                <div key={msg.id} className={msg.role === 'user' ? 'ml-auto max-w-[80%]' : 'max-w-[85%]'}>
                  <div
                    className={
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-2xl rounded-br-sm px-4 py-2.5 text-sm'
                        : 'bg-slate-800 text-slate-100 rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm whitespace-pre-line'
                    }
                  >
                    {msg.text}
                  </div>
                  {msg.role === 'bot' && msg.action && !msg.action.autoExecute && (
                    <button
                      onClick={() => navigate(msg.action!.path)}
                      className="mt-1 text-xs text-blue-400 hover:text-blue-300 underline"
                    >
                      → {msg.action.label}
                    </button>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="max-w-[85%] bg-slate-800 text-slate-100 rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-2 h-2 rounded-full bg-slate-400 animate-bounce"
                        style={{ animationDelay: `${i * 0.2}s` }}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            <div className="bg-slate-800 border-t border-slate-700 p-3 shrink-0">
              <div className="flex gap-2 items-end">
                <button
                  onClick={toggleListening}
                  disabled={!isSupported}
                  className={
                    isListening
                      ? 'p-2.5 rounded-xl bg-red-500/20 text-red-400 animate-pulse'
                      : `p-2.5 rounded-xl text-slate-400 hover:text-white ${!isSupported ? 'opacity-30 cursor-not-allowed' : ''}`
                  }
                  title={micTooltip}
                >
                  <Mic size={18} />
                </button>
                <textarea
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onTextareaKeyDown}
                  placeholder={placeholder}
                  className="flex-1 resize-none max-h-24 bg-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-300 outline-none"
                />
                <button
                  onClick={sendMessage}
                  disabled={input.trim() === '' || isLoading}
                  className="bg-blue-600 disabled:opacity-50 rounded-xl p-2.5 text-white"
                >
                  <SendHorizontal size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => {
          const next = !isOpen;
          setIsOpen(next);
          if (next) setUnreadCount(0);
        }}
        className="relative w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-lg"
        aria-label="Toggle chatbot"
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
        {!isOpen && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center animate-bounce">
            {unreadCount}
          </span>
        )}
      </button>
    </div>
  );
}
