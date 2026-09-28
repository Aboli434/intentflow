'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiLogin } from '@/lib/api-client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invitationToken, setInvitationToken] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      if (token) setInvitationToken(token);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await apiLogin({ email, password });
      if (invitationToken) {
        router.push(`/invite/${invitationToken}`);
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-[#0B0F19] text-[#F8FAFC] selection:bg-indigo-600 selection:text-white">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-[#1F2937] bg-[#111827] p-8 shadow-2xl">
        <div className="text-center sm:text-left">
          <div className="inline-flex items-center gap-2 font-extrabold text-xl tracking-tight text-indigo-400">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-sm shadow-indigo-500/50" />
            IntentFlow
          </div>
          <h2 className="text-xl font-extrabold text-slate-100 mt-2">Welcome Back</h2>
          <p className="text-xs text-slate-400 mt-0.5">Sign in to your IntentFlow workspace</p>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs font-semibold text-rose-300">
            {error}
          </div>
        )}

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

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-bold text-slate-300">Password</label>
              <Link href="/forgot-password" className="text-xs text-indigo-400 font-semibold hover:underline">
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-[#1F2937] bg-[#0B0F19] px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-950/40 transition-all disabled:opacity-50 min-h-[42px]"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div className="border-t border-[#1F2937] pt-4 text-center text-xs text-slate-400">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-indigo-400 font-bold hover:underline">
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
}
