'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface HealthStatus {
  status: 'ok';
  service: string;
  timestamp: string;
  database: 'connected' | 'disconnected';
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function checkHealth(): Promise<HealthStatus> {
  const res = await fetch(`${API_BASE}/health`, { cache: 'no-store' });
  const json = await res.json();
  if (!res.ok || !json.status) throw new Error('API unavailable');
  return json as HealthStatus;
}

const FEATURES = [
  {
    icon: '💬',
    title: 'Intent Intelligence',
    description:
      'AI parses every client message into structured work requirements — no more lost-in-translation moments.',
  },
  {
    icon: '✅',
    title: 'Deliverable Reviews',
    description:
      'Clients approve or request changes with one click. Developers get precise revision feedback, not vague comments.',
  },
  {
    icon: '🔄',
    title: 'Human-in-the-Loop',
    description:
      'Every AI suggestion requires developer verification before becoming a work item. Accuracy over automation.',
  },
  {
    icon: '📊',
    title: 'Transparent Milestones',
    description:
      'Real-time project health: progress, blockers, and handoffs visible to all stakeholders at any moment.',
  },
];

const PERSONAS = [
  { role: 'client', label: 'Michael Vance', badge: 'Client', color: 'emerald', desc: 'Review, approve, track' },
  { role: 'developer', label: 'Sarah Chen', badge: 'Developer', color: 'amber', desc: 'Build, verify, ship' },
  { role: 'admin', label: 'Alex Rivera', badge: 'Admin', color: 'indigo', desc: 'Manage, invite, monitor' },
];

export default function Home() {
  const [healthState, setHealthState] = useState<{
    status: 'loading' | 'connected' | 'unavailable';
    data?: HealthStatus;
    error?: string;
  }>({ status: 'loading' });

  const checkConnectivity = async () => {
    setHealthState({ status: 'loading' });
    try {
      const data = await checkHealth();
      setHealthState({ status: 'connected', data });
    } catch (err) {
      setHealthState({
        status: 'unavailable',
        error: err instanceof Error ? err.message : 'API unavailable',
      });
    }
  };

  useEffect(() => {
    checkConnectivity();
  }, []);

  return (
    <main className="min-h-screen bg-[#0B0F19] text-[#F8FAFC] overflow-x-hidden">
      {/* Background pattern */}
      <div className="fixed inset-0 bg-grid-pattern opacity-60 pointer-events-none" />
      {/* Radial glow behind hero */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full bg-indigo-600/8 blur-[100px] pointer-events-none" />

      {/* ===== NAV ===== */}
      <nav className="sticky top-0 z-50 glass-strong border-b border-white/5 px-4 sm:px-6 py-3.5">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-2 font-extrabold text-lg tracking-tight">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/60 animate-pulse-slow" />
            <span className="bg-gradient-to-r from-white to-indigo-300 bg-clip-text text-transparent">
              IntentFlow
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden sm:block px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800/70 transition-all border border-transparent hover:border-slate-700"
            >
              Sign In
            </Link>
            <Link
              href="/demo"
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-lg shadow-indigo-900/40 transition-all active:scale-95 border border-indigo-500/50"
            >
              Try Demo
            </Link>
          </div>
        </div>
      </nav>

      {/* ===== HERO ===== */}
      <section className="relative px-4 sm:px-6 pt-20 pb-24 sm:pt-28 sm:pb-32 text-center">
        <div className="mx-auto max-w-4xl space-y-6 animate-fade-in">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 text-xs font-bold tracking-wide">
            <span className="pulse-dot w-1.5 h-1.5" />
            Portfolio Demo — B2B SaaS Platform
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
            <span className="text-white">Turn messy client chats</span>
            <br />
            <span className="text-gradient-brand">into structured work</span>
          </h1>

          {/* Sub-headline */}
          <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed font-medium">
            IntentFlow is a full-stack B2B SaaS product that uses AI to extract, verify, and execute
            client intent — bridging the gap between what clients say and what developers build.
          </p>

          {/* CTA Row */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/demo"
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-bold text-white shadow-xl shadow-indigo-900/40 transition-all active:scale-[0.98] border border-indigo-500/50 flex items-center justify-center gap-2"
            >
              <span>Explore Demo</span>
              <span className="text-indigo-200">→</span>
            </Link>
            <Link
              href="/dashboard"
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-[#111827] hover:bg-[#1E293B] border border-slate-700/80 hover:border-slate-600 text-sm font-bold text-slate-200 hover:text-white transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <span>Open Workspace</span>
            </Link>
          </div>

          {/* Live API Status */}
          <div className="pt-2 flex items-center justify-center gap-2 text-xs font-mono">
            <span className="text-slate-500">API Status:</span>
            {healthState.status === 'loading' && (
              <span className="text-amber-400 animate-pulse">Connecting...</span>
            )}
            {healthState.status === 'connected' && (
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block shadow-sm shadow-emerald-400/60" />
                Connected · PostgreSQL Live
              </span>
            )}
            {healthState.status === 'unavailable' && (
              <span className="text-rose-400">⚠ API Offline</span>
            )}
          </div>
        </div>
      </section>

      {/* ===== FEATURE GRID ===== */}
      <section className="px-4 sm:px-6 pb-24">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-12 space-y-2 animate-fade-in delay-100">
            <p className="text-xs font-mono font-bold text-indigo-400 uppercase tracking-widest">Core Product</p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Built for the gap between client & developer</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className="rounded-2xl border border-slate-800 bg-[#111827]/80 p-6 space-y-3 hover:border-indigo-500/40 card-glow-hover transition-all group animate-fade-in"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="text-3xl group-hover:scale-110 transition-transform duration-300">{f.icon}</div>
                <h3 className="text-sm font-bold text-slate-100">{f.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== DEMO PERSONAS ===== */}
      <section className="px-4 sm:px-6 pb-24">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-2xl border border-slate-800 bg-[#111827]/60 p-8 sm:p-10 space-y-8 animate-fade-in delay-200">
            <div className="text-center space-y-2">
              <p className="text-xs font-mono font-bold text-indigo-400 uppercase tracking-widest">Interactive Demo</p>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white">Experience three unique journeys</h2>
              <p className="text-sm text-slate-400 max-w-lg mx-auto">
                Choose a demo persona to explore the exact workflows each role experiences in a real project.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {PERSONAS.map((p) => (
                <div
                  key={p.role}
                  className="rounded-xl border border-slate-800 bg-[#0B0F19]/80 p-5 text-center space-y-2 hover:border-slate-600 transition-all"
                >
                  <div className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase bg-${p.color}-500/15 text-${p.color}-300 border border-${p.color}-500/30`}>
                    {p.badge}
                  </div>
                  <p className="text-sm font-bold text-slate-100">{p.label}</p>
                  <p className="text-xs text-slate-400">{p.desc}</p>
                </div>
              ))}
            </div>

            <div className="text-center">
              <Link
                href="/demo"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-bold text-white shadow-xl shadow-indigo-900/40 transition-all active:scale-[0.98] border border-indigo-500/50"
              >
                Start Interactive Demo →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===== TECH STACK ===== */}
      <section className="px-4 sm:px-6 pb-24">
        <div className="mx-auto max-w-4xl text-center space-y-6 animate-fade-in delay-300">
          <p className="text-xs font-mono font-bold text-slate-500 uppercase tracking-widest">Tech Stack</p>
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-mono font-bold">
            {['Next.js 15', 'Fastify API', 'PostgreSQL', 'Prisma ORM', 'TypeScript', 'AI Intent Engine', 'JWT Auth', 'Real-time SSE'].map((tech) => (
              <span
                key={tech}
                className="px-3 py-1.5 rounded-full bg-slate-800/80 text-slate-300 border border-slate-700/60"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-slate-800 px-4 sm:px-6 py-6 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="font-bold text-slate-400 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block" />
            IntentFlow
          </span>
          <span>Portfolio project · Full-stack B2B SaaS · Built to demonstrate real-world product engineering</span>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-semibold">Sign In</Link>
            <Link href="/signup" className="text-indigo-400 hover:text-indigo-300 font-semibold">Register</Link>
            <Link href="/demo" className="text-indigo-400 hover:text-indigo-300 font-semibold">Demo</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
