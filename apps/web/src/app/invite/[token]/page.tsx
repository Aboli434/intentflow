'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiGetInvitation, apiAcceptInvitation, apiGetMe } from '@/lib/api-client';

export default function InviteAcceptancePage() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token as string;

  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [invitation, setInvitation] = useState<{
    id: string;
    email?: string;
    phone?: string;
    invitationMethod: string;
    role: string;
    organizationId: string;
    organizationName: string;
    isExpired: boolean;
    isAccepted: boolean;
  } | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    const init = async () => {
      setLoading(true);
      try {
        const inv = await apiGetInvitation(token);
        setInvitation(inv);

        // Check auth status
        try {
          await apiGetMe();
          setIsAuthenticated(true);
        } catch {
          setIsAuthenticated(false);
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Invalid or expired invitation token');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    setAccepting(true);
    setErrorMsg(null);

    try {
      const res = await apiAcceptInvitation(token);
      setSuccessMsg(`Welcome to ${invitation?.organizationName}! Redirecting to dashboard...`);
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to accept invitation');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-slate-600">
          <svg className="animate-spin h-5 w-5 text-indigo-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="text-sm font-semibold">Loading invitation details...</span>
        </div>
      </div>
    );
  }

  if (errorMsg && !invitation) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-xl space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600 border border-rose-100">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-900">Invalid Invitation</h2>
          <p className="text-xs text-slate-600">{errorMsg}</p>
          <div className="pt-2">
            <Link href="/dashboard" className="inline-block rounded-xl bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition-all">
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const contactText = invitation?.email || invitation?.phone || 'Team Member';

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 selection:bg-indigo-500 selection:text-white">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 font-extrabold text-xl mb-1">
            IF
          </div>
          <h1 className="text-xl font-extrabold text-slate-900">Workspace Invitation</h1>
          <p className="text-xs text-slate-500">
            You have been invited to join <span className="font-bold text-slate-800">{invitation?.organizationName}</span>
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500 font-medium">Invited Contact:</span>
            <span className="font-bold text-slate-800 font-mono">{contactText}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500 font-medium">Assigned Role:</span>
            <span className="uppercase text-[10px] font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
              {invitation?.role}
            </span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500 font-medium">Invitation Method:</span>
            <span className="uppercase text-[10px] font-bold text-slate-600 font-mono">
              {invitation?.invitationMethod}
            </span>
          </div>
        </div>

        {invitation?.isAccepted && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center text-xs text-emerald-800 font-bold">
            This invitation has already been accepted.
          </div>
        )}

        {invitation?.isExpired && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center text-xs text-amber-800 font-bold">
            This invitation has expired. Please ask an admin for a new invite.
          </div>
        )}

        {successMsg && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center text-xs text-emerald-800 font-bold">
            {successMsg}
          </div>
        )}

        {errorMsg && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-center text-xs text-rose-800 font-bold">
            {errorMsg}
          </div>
        )}

        {!invitation?.isAccepted && !invitation?.isExpired && !successMsg && (
          <div>
            {isAuthenticated ? (
              <button
                onClick={handleAccept}
                disabled={accepting}
                className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-3 text-xs font-bold text-white shadow-md transition-all disabled:opacity-50"
              >
                {accepting ? 'Accepting Invitation...' : `Accept & Join ${invitation?.organizationName}`}
              </button>
            ) : (
              <div className="space-y-3 text-center">
                <p className="text-xs text-slate-600 font-medium">
                  Create your IntentFlow account or sign in to accept this invitation.
                </p>
                <div className="flex gap-3">
                  <Link
                    href={`/signup?token=${token}`}
                    className="flex-1 text-center rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all"
                  >
                    Create Account
                  </Link>
                  <Link
                    href={`/login?token=${token}`}
                    className="flex-1 text-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 text-xs font-bold transition-all"
                  >
                    Sign In
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
