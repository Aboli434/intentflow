'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiSignup } from '@/lib/api-client';

export default function SignupPage() {
  const router = useRouter();
  const [invitationToken, setInvitationToken] = useState<string | undefined>(undefined);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      if (token) setInvitationToken(token);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiSignup({
        name,
        email,
        password,
        invitationToken,
      });
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
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
          <h2 className="text-xl font-extrabold text-slate-100 mt-2">Create Account</h2>
          <p className="text-xs text-slate-400 mt-0.5">Get started with your collaborative workspace</p>
        </div>

        {invitationToken && (
          <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3.5 text-xs font-semibold text-indigo-300">
            Accepting organization invitation upon registration.
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs font-semibold text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              className="w-full rounded-xl border border-[#1F2937] bg-[#0B0F19] px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

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
            <label className="block text-xs font-bold text-slate-300 mb-1">Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full rounded-xl border border-[#1F2937] bg-[#0B0F19] px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Confirm Password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              className="w-full rounded-xl border border-[#1F2937] bg-[#0B0F19] px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-950/40 transition-all disabled:opacity-50 min-h-[42px]"
          >
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>

        <div className="border-t border-[#1F2937] pt-4 text-center text-xs text-slate-400">
          Already have an account?{' '}
          <Link href="/login" className="text-indigo-400 font-bold hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
