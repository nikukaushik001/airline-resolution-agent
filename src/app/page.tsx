'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, ShieldAlert, CheckCircle, Zap, Plane, ChevronDown, Clock, AlertCircle } from 'lucide-react';
import { customers, bookings } from '@/lib/db';

type Message = { id: string; role: 'user' | 'assistant'; content: string };
type AuditLog = { log: string; timestamp: string; isEscalation?: boolean };

const SCENARIO_SCRIPTS: Record<string, { label: string; message: string; isDanger?: boolean }[]> = {
  SK4821X: [
    { label: 'Flight status?', message: "What's the status of my flight SK-204?" },
    { label: 'Request refund', message: "I'd like a full refund for my cancelled flight." },
    { label: 'Rebook me', message: "Can you rebook me on the next available flight to Goa?" },
    { label: 'Demand free upgrade', message: "I'm furious. I want a full refund AND a free business class upgrade on my return flight for the trouble.", isDanger: true },
    { label: 'Legal threat', message: "I'm going to file a formal complaint and get my lawyer involved.", isDanger: true },
  ],
  TR1190B: [
    { label: 'Delay info', message: "How long is my flight SK-118 delayed?" },
    { label: 'Meal voucher', message: "Can I get a meal voucher for this delay?" },
    { label: 'Lounge access', message: "Can I get lounge access while I wait?" },
    { label: 'Hotel request', message: "I need a hotel room since it's been such a long delay.", isDanger: true },
  ],
  WL7742: [
    { label: 'Delay info', message: "What's happening with my flight SK-305?" },
    { label: 'Hotel (delayed hrs)', message: "I need hotel accommodation for the delay." },
    { label: 'Full night hotel', message: "I want a full night's stay at a hotel, not just a few hours.", isDanger: true },
    { label: '₹2000 upgrade', message: "Move me to a different higher-fare flight. I don't mind paying extra — fare diff is ₹2,000.", isDanger: true },
    { label: 'Platinum override', message: "But I'm Platinum tier — doesn't that mean you can approve the ₹2,000 waiver?", isDanger: true },
  ],
};

export default function Home() {
  const [pnr, setPnr] = useState('SK4821X');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<'thinking' | 'analyzing' | 'responding' | null>(null);
  const [cooldown, setCooldown] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [showMobileAudit, setShowMobileAudit] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const auditEndRef = useRef<HTMLDivElement>(null);
  const messageCount = messages.length;
  const auditCount = auditLogs.length;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageCount]);

  useEffect(() => {
    auditEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditCount]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading || cooldown) return;
    const userMessage = { id: Date.now().toString(), role: 'user' as const, content: text };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setLoadingStage('thinking');
    setCooldown(true);
    setTimeout(() => setCooldown(false), 1500);

    try {
      setLoadingStage('analyzing');
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pnr, message: text, history }),
      });
      setLoadingStage('responding');
      const data = await response.json();
      if (data.text) {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: data.text }]);
      }
      if (data.auditLogs?.length) {
        setAuditLogs(prev => [...prev, ...data.auditLogs]);
      }
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: "Give me just a moment — I'm handling high traffic. Please resend your message in a few seconds."
      }]);
    } finally {
      setLoading(false);
      setLoadingStage(null);
    }
  };

  const handlePnrChange = (value: string) => {
    setPnr(value);
    setMessages([]);
    setAuditLogs([]);
    setInput('');
  };

  const customer = customers[pnr];
  const customerBookings = bookings[pnr] || [];
  const disruptedBooking = customerBookings.find(b => b.status === 'CANCELLED' || b.status === 'DELAYED');
  const scripts = SCENARIO_SCRIPTS[pnr] || [];

  const tierGradient = (tier: string) => {
    if (tier === 'Platinum') return 'badge-platinum';
    if (tier === 'Gold') return 'badge-gold';
    return 'badge-silver';
  };

  const statusChip = (status: string) => {
    if (status === 'CANCELLED') return 'status-cancelled';
    if (status === 'DELAYED') return 'status-delayed';
    return 'status-unaffected';
  };

  const stageLabel = {
    thinking: 'Thinking...',
    analyzing: 'Checking policy rules...',
    responding: 'Drafting response...',
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>

      {/* ═══════════════ LEFT PANEL ═══════════════ */}
      <div className={`flex flex-col flex-1 min-w-0 ${showMobileAudit ? 'hidden lg:flex' : 'flex'}`}>

        {/* Top Bar */}
        <div className="shrink-0 px-6 py-4 flex items-center justify-between"
          style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
          
          <div className="flex items-center gap-3">
            {/* Logo */}
            <div className="w-9 h-9 rounded-xl flex items-center justify-center btn-gradient">
              <Plane size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                AIONOS Support Agent
              </h1>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Policy-enforced · Audit-logged · AI-powered
              </p>
            </div>
          </div>

          {/* Scenario Switcher */}
          <div className="relative">
            <select
              value={pnr}
              onChange={e => handlePnrChange(e.target.value)}
              className="appearance-none pr-8 pl-4 py-2 rounded-xl text-xs font-medium cursor-pointer glass glass-hover transition"
              style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}
            >
              <option value="SK4821X" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>Scenario 1 — Priya Nair · Flight Cancelled</option>
              <option value="TR1190B" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>Scenario 2 — Arvind Kulkarni · 4h Delay</option>
              <option value="WL7742" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>Scenario 3 — Meher Kaur · 6h Delay</option>
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-secondary)' }} />
          </div>
          <button
            onClick={() => setShowMobileAudit(true)}
            className="lg:hidden ml-2 px-3 py-1.5 rounded-lg text-xs font-bold glass transition"
            style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}
          >
            Audit Log
          </button>
        </div>

        {/* Booking Info Card */}
        {customer && (
          <div className="shrink-0 mx-5 my-3 p-4 rounded-2xl glass"
            style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full btn-gradient flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {customer.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{customer.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white ${tierGradient(customer.loyaltyTier)}`}>
                      {customer.loyaltyTier}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>PNR: {customer.pnr}</span>
                  </div>
                </div>
              </div>

              {disruptedBooking && (
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {disruptedBooking.flight} · {disruptedBooking.route}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      Dep: {disruptedBooking.scheduledDeparture}
                      {disruptedBooking.newDeparture && ` → Now: ${disruptedBooking.newDeparture}`}
                    </p>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${statusChip(disruptedBooking.status)}`}>
                    {disruptedBooking.status}
                    {disruptedBooking.status === 'DELAYED' && ` +${disruptedBooking.delayHours}h`}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Demo Script Buttons */}
        {scripts.length > 0 && (
          <div className="shrink-0 px-5 pb-2 flex flex-wrap gap-2">
            <span className="text-xs font-semibold self-center mr-1" style={{ color: 'var(--text-secondary)' }}>
              Demo:
            </span>
            {scripts.map((s, i) => (
              <button
                key={i}
                onClick={() => sendMessage(s.message)}
                disabled={loading || cooldown}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition glass glass-hover disabled:opacity-30 disabled:cursor-not-allowed ${
                  s.isDanger
                    ? 'border border-red-500/30 text-red-300 hover:border-red-400/50'
                    : 'border border-indigo-500/30 text-indigo-300 hover:border-indigo-400/50'
                }`}
              >
                {s.isDanger ? '⚠️ ' : ''}{s.label}
              </button>
            ))}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-[60vh] gap-6 msg-animate">
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 bg-indigo-500 rounded-full blur-[40px] opacity-20 animate-pulse"></div>
                <div className="w-20 h-20 rounded-full btn-gradient flex items-center justify-center relative shadow-[0_0_40px_rgba(99,102,241,0.5)] border border-indigo-300/30">
                  <Zap size={32} className="text-white drop-shadow-md" />
                </div>
              </div>
              <div className="text-center space-y-2 relative z-10">
                <h3 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 to-purple-300">
                  Ready to resolve
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Select a scenario and click a demo script<br />or type a message to begin.
                </p>
              </div>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={`msg-animate flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full btn-gradient flex items-center justify-center mr-2.5 mt-1 shrink-0">
                  <Plane size={13} className="text-white" />
                </div>
              )}
              <div className={`max-w-[72%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'text-white rounded-br-none'
                  : 'rounded-bl-none glass'
              }`}
                style={msg.role === 'user'
                  ? { background: 'linear-gradient(135deg, #6366f1, #818cf8)', boxShadow: '0 4px 20px rgba(99,102,241,0.3)' }
                  : { color: 'var(--text-primary)', borderColor: 'var(--border)' }
                }
              >
                {msg.content}
              </div>
            </div>
          ))}

          {loading && loadingStage && (
            <div className="msg-animate flex justify-start">
              <div className="w-7 h-7 rounded-full btn-gradient flex items-center justify-center mr-2.5 mt-1 shrink-0 shimmer">
                <Plane size={13} className="text-white" />
              </div>
              <div className="px-4 py-3 rounded-2xl rounded-bl-none glass flex items-center gap-3"
                style={{ borderColor: 'var(--border)' }}>
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <span key={i} className="typing-dot w-1.5 h-1.5 rounded-full inline-block"
                      style={{ background: 'var(--accent-light)', animationDelay: `${i * 0.2}s` }} />
                  ))}
                </div>
                <span className="text-xs italic" style={{ color: 'var(--text-secondary)' }}>
                  {stageLabel[loadingStage]}
                </span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="shrink-0 px-5 py-4" style={{ borderTop: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
          <div className="flex gap-3 items-center">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
              disabled={loading || cooldown}
              placeholder={loading ? 'Waiting for response...' : cooldown ? 'Ready in a moment...' : 'Type your message...'}
              className="flex-1 px-5 py-3 rounded-2xl text-sm input-glow transition glass"
              style={{
                color: 'var(--text-primary)',
                borderColor: 'var(--border)',
                background: 'rgba(255,255,255,0.04)',
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={loading || cooldown || !input.trim()}
              className="btn-gradient w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0"
            >
              <Send size={17} />
            </button>
          </div>
          {cooldown && !loading && (
            <p className="text-xs mt-2 ml-1 flex items-center gap-1.5" style={{ color: 'var(--warning)' }}>
              <Clock size={11} /> Anti-burst cooldown active...
            </p>
          )}
        </div>
      </div>

      {/* ═══════════════ RIGHT AUDIT PANEL ═══════════════ */}
      <div className={`fixed inset-0 z-50 lg:static lg:z-auto w-full lg:w-[360px] h-full lg:h-auto shrink-0 flex-col lg:border-l ${showMobileAudit ? 'flex' : 'hidden lg:flex'}`}
        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border)' }}>

        {/* Panel Header */}
        <div className="shrink-0 px-5 py-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowMobileAudit(false)}
              className="lg:hidden p-1.5 rounded-md glass text-white"
            >
              ←
            </button>
            <div>
            <h2 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2"
              style={{ color: 'var(--text-secondary)' }}>
              <AlertCircle size={13} />
              System Audit Log
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(148,163,184,0.5)' }}>
              Deterministic rule decisions · Real-time
            </p>
          </div>
          </div>
          {auditLogs.some(l => l.isEscalation) && (
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full text-red-300 escalation-pulse"
              style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
              {auditLogs.filter(l => l.isEscalation).length} Escalation{auditLogs.filter(l => l.isEscalation).length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Log Entries */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {auditLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 opacity-30">
              <CheckCircle size={28} style={{ color: 'var(--text-secondary)' }} />
              <p className="text-xs text-center" style={{ color: 'var(--text-secondary)' }}>
                No events logged yet.<br />Rules engine decisions will appear here.
              </p>
            </div>
          ) : (
            auditLogs.map((log, i) => (
              <div key={i}
                className={`msg-animate p-3.5 rounded-xl text-xs transition glass-hover ${
                  log.isEscalation ? 'escalation-pulse' : ''
                }`}
                style={log.isEscalation
                  ? { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }
                  : { background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }
                }
              >
                <div className="flex items-start gap-2.5">
                  <div className="shrink-0 mt-0.5">
                    {log.isEscalation
                      ? <ShieldAlert size={14} style={{ color: '#f87171' }} />
                      : <CheckCircle size={14} style={{ color: 'var(--success)' }} />
                    }
                  </div>
                  <div className="min-w-0">
                    <span className={`font-bold text-[11px] block mb-1 ${log.isEscalation ? 'text-red-400' : ''}`}
                      style={!log.isEscalation ? { color: 'var(--text-primary)' } : {}}>
                      {log.isEscalation ? '🔴 ESCALATED — Human Agent Required' : '✅ Rule Fired'}
                    </span>
                    <span className="break-words leading-relaxed">{log.log}</span>
                    <div className="mt-1.5 text-[10px]" style={{ color: 'rgba(148,163,184,0.5)' }}>
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={auditEndRef} />
        </div>

        {/* Footer Stats */}
        <div className="shrink-0 px-5 py-3 flex items-center justify-between"
          style={{ borderTop: '1px solid var(--border)', background: 'rgba(255,255,255,0.01)' }}>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {auditLogs.length} event{auditLogs.length !== 1 ? 's' : ''} logged
          </span>
          {auditLogs.length > 0 && (
            <button
              onClick={() => setAuditLogs([])}
              className="text-xs px-3 py-1 rounded-lg transition glass glass-hover"
              style={{ color: 'var(--text-secondary)' }}
            >
              Clear log
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
