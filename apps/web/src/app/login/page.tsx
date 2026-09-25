'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiLogin } from '@/lib/api-client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await apiLogin({ email, password });
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-slate-950 text-slate-100">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-slate-800 bg-slate-900/60 p-8 shadow-2xl backdrop-blur-sm">
        <div>
          <span className="inline-block px-2.5 py-1 text-xs font-mono font-medium rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20 mb-2">
            IntentFlow Phase 2
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white">Sign In</h1>
          <p className="text-sm text-slate-400 mt-1">Access your organizations and projects</p>
        </div>

        {error && (
          <div className="rounded-md border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-400 font-mono">
            {error}
          </div>
        )}

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

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-medium text-slate-300">Password</label>
              <Link href="/forgot-password" className="text-xs text-sky-400 hover:underline">
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-sky-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-sky-600 hover:bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div className="border-t border-slate-800 pt-4 text-center text-xs text-slate-400">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-sky-400 font-semibold hover:underline">
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
}
