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
    <div className="flex min-h-screen items-center justify-center p-4 bg-slate-950 text-slate-100">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-slate-800 bg-slate-900/60 p-8 shadow-2xl backdrop-blur-sm">
        <div>
          <span className="inline-block px-2.5 py-1 text-xs font-mono font-medium rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20 mb-2">
            IntentFlow Phase 2
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white">Reset Password</h1>
          <p className="text-sm text-slate-400 mt-1">Enter your registered email to receive reset instructions</p>
        </div>

        {submitted ? (
          <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-4 text-xs text-emerald-300 space-y-2">
            <p className="font-semibold">Reset link sent!</p>
            <p>If an account exists for <span className="font-mono">{email}</span>, you will receive password reset instructions shortly.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-sky-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-sky-600 hover:bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
            >
              Send Reset Link
            </button>
          </form>
        )}

        <div className="border-t border-slate-800 pt-4 text-center text-xs text-slate-400">
          Remembered your password?{' '}
          <Link href="/login" className="text-sky-400 font-semibold hover:underline">
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
