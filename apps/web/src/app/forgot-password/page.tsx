'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-[#0B0F19] text-[#F8FAFC] selection:bg-indigo-600 selection:text-white">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-[#1F2937] bg-[#111827] p-8 shadow-2xl">
        <div className="text-center sm:text-left">
          <div className="inline-flex items-center gap-2 font-extrabold text-xl tracking-tight text-indigo-400">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-sm shadow-indigo-500/50" />
            IntentFlow
          </div>
          <h2 className="text-xl font-extrabold text-slate-100 mt-2">Reset Password</h2>
          <p className="text-xs text-slate-400 mt-0.5">Enter your registered email to receive reset instructions</p>
        </div>

        {submitted ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-semibold text-emerald-300 space-y-2">
            <p className="font-extrabold text-emerald-400">Reset link sent!</p>
            <p>If an account exists for <span className="font-mono text-emerald-300 font-bold">{email}</span>, you will receive password reset instructions shortly.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full rounded-xl border border-[#1F2937] bg-[#0B0F19] px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-950/40 transition-all min-h-[42px]"
            >
              Send Reset Link
            </button>
          </form>
        )}

        <div className="border-t border-[#1F2937] pt-4 text-center text-xs text-slate-400">
          Remembered your password?{' '}
          <Link href="/login" className="text-indigo-400 font-bold hover:underline">
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
