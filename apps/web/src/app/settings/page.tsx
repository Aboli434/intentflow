'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  apiGetOrganizations,
  apiGetOrgMembers,
  apiInviteMember,
} from '@/lib/api-client';
import { Organization, OrganizationMember } from '@intentflow/types';

export default function SettingsPage() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<(Organization & { role: string })[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [members, setMembers] = useState<OrganizationMember[]>([]);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'developer' | 'client'>('developer');
  const [inviting, setInviting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    apiGetOrganizations()
      .then((orgs) => {
        setOrganizations(orgs);
        if (orgs.length > 0) {
          setSelectedOrgId(orgs[0].id);
        }
      })
      .catch(() => router.push('/login'));
  }, [router]);

  useEffect(() => {
    if (selectedOrgId) {
      apiGetOrgMembers(selectedOrgId)
        .then(setMembers)
        .catch((err) => setErrorMsg(err instanceof Error ? err.message : 'Failed to load members'));
    }
  }, [selectedOrgId]);

  const currentOrg = organizations.find((o) => o.id === selectedOrgId);
  const isAdmin = currentOrg?.role === 'admin';

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId) return;
    setInviting(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const inv = await apiInviteMember(selectedOrgId, { email: inviteEmail, role: inviteRole });
      setSuccessMsg(`Invitation created for ${inv.email}! Share token: ${inv.token}`);
      setInviteEmail('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Invitation failed');
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-xs text-sky-400 hover:underline">
              ← Dashboard
            </Link>
            <h1 className="text-xl font-bold text-white">Organization Settings</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-6 space-y-8">
        {/* Selector */}
        {organizations.length > 0 && (
          <div className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <span className="text-xs font-medium text-slate-300">Select Organization:</span>
            <select
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name} ({org.role})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Invite Member Section (Admin Only) */}
        {isAdmin && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">Invite Team Member</h2>
            <p className="text-xs text-slate-400">Send an organization invitation by email</p>

            {successMsg && (
              <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300 font-mono">
                {successMsg}
              </div>
            )}
            {errorMsg && (
              <div className="rounded-md border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-400 font-mono">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleInvite} className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1">
                <label className="block text-xs text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                >
                  <option value="developer">Developer</option>
                  <option value="client">Client</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={inviting}
                className="rounded-lg bg-sky-600 hover:bg-sky-500 px-4 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-50"
              >
                {inviting ? 'Sending...' : 'Send Invitation'}
              </button>
            </form>
          </div>
        )}

        {/* Organization Members List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Organization Members</h2>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden divide-y divide-slate-800">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-4">
                <div>
                  <div className="text-sm font-semibold text-slate-100">{m.user?.name}</div>
                  <div className="text-xs text-slate-400 font-mono">{m.user?.email}</div>
                </div>
                <span className="uppercase text-[10px] font-mono px-2.5 py-1 rounded bg-slate-800 text-sky-400 font-semibold">
                  {m.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
