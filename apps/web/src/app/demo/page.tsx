'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiDemoLogin } from '../../lib/api-client';

interface PersonaCard {
  role: 'admin' | 'developer' | 'client';
  name: string;
  title: string;
  badgeLabel: string;
  badgeColor: string;
  description: string;
  capabilities: string[];
  buttonLabel: string;
  buttonVariant: string;
}

const PERSONAS: PersonaCard[] = [
  {
    role: 'client',
    name: 'Michael Vance',
    title: 'Product Director',
    badgeLabel: 'Client Persona',
    badgeColor: 'emerald',
    description:
      'Experience the client-side of IntentFlow — review project deliverables, approve milestones, request changes, and track project health in real-time.',
    capabilities: [
      'Review & approve deliverables',
      'Request revision with structured feedback',
      'Monitor project milestones',
      'Track team communication',
    ],
    buttonLabel: 'Continue as Client',
    buttonVariant: 'primary',
  },
  {
    role: 'developer',
    name: 'Sarah Chen',
    title: 'Lead Engineer',
    badgeLabel: 'Developer Persona',
    badgeColor: 'amber',
    description:
      'Work through the developer experience — interpret AI intent extractions, verify requirements, manage work items, and submit deliverables for review.',
    capabilities: [
      'Verify AI intent interpretations',
      'Execute work items & track progress',
      'Submit deliverables for review',
      'Respond to revision requests',
    ],
    buttonLabel: 'Continue as Developer',
    buttonVariant: 'secondary',
  },
  {
    role: 'admin',
    name: 'Alex Rivera',
    title: 'Workspace Administrator',
    badgeLabel: 'Admin Persona',
    badgeColor: 'indigo',
    description:
      'Explore the admin workspace — manage team memberships, invite new members, assign project roles, and oversee organization health.',
    capabilities: [
      'Invite clients & developers',
      'Assign team members to projects',
      'Manage roles & permissions',
      'Monitor organization activity',
    ],
    buttonLabel: 'Continue as Admin',
    buttonVariant: 'outline',
  },
];

const BADGE_STYLES: Record<string, string> = {
  emerald: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  amber: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
  indigo: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30',
};

const BUTTON_STYLES: Record<string, string> = {
  primary: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/40 border border-indigo-500/50',
  secondary: 'bg-amber-600/90 hover:bg-amber-500 text-white shadow-lg shadow-amber-900/30 border border-amber-500/50',
  outline: 'bg-[#1E293B] hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600',
};

export default function DemoPage() {
  const router = useRouter();
  const [loadingRole, setLoadingRole] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleDemoLogin = async (role: 'admin' | 'developer' | 'client') => {
    setLoadingRole(role);
    setErrorMsg(null);
    try {
      const res = await apiDemoLogin(role);
      if (res.token) {
        router.push('/dashboard');
      } else {
        setErrorMsg('Failed to initialize demo session. Please try again.');
      }
    } catch (err: any) {
      console.error('Demo authentication error:', err);
      setErrorMsg(err.message || 'Unable to connect to IntentFlow API.');
    } finally {
      setLoadingRole(null);
    }
  };

  const isLoading = loadingRole !== null;

  return (
    <div className="min-h-screen bg-[#090D16] text-[#F1F5F9] selection:bg-indigo-600 selection:text-white overflow-x-hidden">
      {/* Background pattern */}
      <div className="fixed inset-0 bg-dot-pattern opacity-50 pointer-events-none" />
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-indigo-600/6 blur-[120px] pointer-events-none" />

      {/* Nav */}
      <nav className="sticky top-0 z-40 glass-strong border-b border-white/5 px-4 sm:px-6 py-3.5">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-extrabold text-lg tracking-tight">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/60" />
            <span className="bg-gradient-to-r from-white to-indigo-300 bg-clip-text text-transparent">
              IntentFlow
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="text-xs font-bold text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-all"
            >
              Sign In
            </Link>
            <Link
              href="/"
              className="text-xs font-bold text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-all"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-4 sm:px-6 pt-16 pb-12 text-center">
        <div className="mx-auto max-w-2xl space-y-4 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 text-xs font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block animate-pulse" />
            Interactive Demo — Deterministic Seed Data
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            <span className="text-white">Explore </span>
            <span className="text-gradient-brand">IntentFlow</span>
          </h1>
          <p className="text-slate-400 text-base leading-relaxed">
            Select a role to experience the exact workflows each persona uses in a real project inside
            the{' '}
            <strong className="text-slate-300">Nexus Digital Agency</strong> organization.
          </p>
        </div>
      </section>

      {/* Error Banner */}
      {errorMsg && (
        <div className="mx-auto max-w-4xl px-4 sm:px-6 mb-6 animate-fade-in">
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 flex items-center justify-between text-xs font-semibold text-rose-300">
            <span>⚠ {errorMsg}</span>
            <button
              onClick={() => setErrorMsg(null)}
              className="ml-4 font-bold underline hover:text-rose-200"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Persona Cards */}
      <section className="px-4 sm:px-6 pb-16">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PERSONAS.map((persona, i) => (
              <div
                key={persona.role}
                className="rounded-2xl border border-slate-800 bg-[#131B2E] p-6 flex flex-col justify-between space-y-5 hover:border-slate-700 transition-all group animate-fade-in"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="space-y-4">
                  {/* Badge */}
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-md ${BADGE_STYLES[persona.badgeColor]}`}>
                      {persona.badgeLabel}
                    </span>
                  </div>

                  {/* Identity */}
                  <div>
                    <h2 className="text-lg font-bold text-white">{persona.name}</h2>
                    <p className="text-xs text-slate-500 font-mono">{persona.title}</p>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-slate-400 leading-relaxed">{persona.description}</p>

                  {/* Capabilities */}
                  <ul className="space-y-1.5">
                    {persona.capabilities.map((cap) => (
                      <li key={cap} className="flex items-start gap-2 text-xs text-slate-300">
                        <span className="text-indigo-400 mt-0.5 shrink-0">✓</span>
                        <span>{cap}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CTA */}
                <button
                  disabled={isLoading}
                  onClick={() => handleDemoLogin(persona.role)}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] ${BUTTON_STYLES[persona.buttonVariant]}`}
                >
                  {loadingRole === persona.role ? (
                    <>
                      <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Initializing...
                    </>
                  ) : (
                    `${persona.buttonLabel} →`
                  )}
                </button>
              </div>
            ))}
          </div>

          {/* Footer note */}
          <p className="text-center text-xs text-slate-500 font-mono mt-8">
            Seed org:{' '}
            <strong className="text-slate-400">Nexus Digital Agency</strong> · All demo data is
            pre-seeded and deterministic · No persistence across sessions
          </p>
        </div>
      </section>
    </div>
  );
}
