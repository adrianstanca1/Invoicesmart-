import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { checkLLMConnection } from '../services/aiService';

type Status = 'checking' | 'online' | 'offline';

const REFRESH_MS = 60_000;

const LLMStatus: React.FC = () => {
  const [status, setStatus] = useState<Status>('checking');
  const [message, setMessage] = useState<string>('Checking local LLM…');

  const probe = async () => {
    setStatus('checking');
    try {
      const result = await checkLLMConnection();
      setStatus(result.ok ? 'online' : 'offline');
      setMessage(result.message);
    } catch (e: any) {
      setStatus('offline');
      setMessage(e?.message || 'unknown error');
    }
  };

  useEffect(() => {
    probe();
    const id = window.setInterval(probe, REFRESH_MS);
    const onFocus = () => probe();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const dotClass =
    status === 'online'
      ? 'bg-emerald-400'
      : status === 'offline'
        ? 'bg-rose-400'
        : 'bg-amber-300 animate-pulse';
  const label =
    status === 'online' ? 'LLM online' : status === 'offline' ? 'LLM offline' : 'Checking LLM…';

  return (
    <Link
      to="/settings"
      title={message}
      className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/60 hover:bg-slate-800 text-xs text-slate-200 transition-colors"
      aria-label={`Local LLM status: ${label}. Click to open Settings.`}
    >
      <span className={`w-2 h-2 rounded-full ${dotClass}`} aria-hidden />
      <span className="whitespace-nowrap">{label}</span>
    </Link>
  );
};

export default LLMStatus;
