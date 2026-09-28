'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  apiGetOrganizations,
  apiGetOrgMembers,
  apiGetOrgInvitations,
  apiInviteMember,
  apiCancelInvitation,
  apiResendInvitation,
  apiUpdateOrgMemberRole,
  apiRemoveOrgMember,
} from '@/lib/api-client';
import { Organization, OrganizationMember, OrganizationInvitation, UserRole } from '@intentflow/types';

export default function SettingsPage() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<(Organization & { role: string })[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);

  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [loadingData, setLoadingData] = useState(false);

  // Invitation Form State
  const [inviteMethod, setInviteMethod] = useState<'email' | 'sms'>('email');
  const [inviteEmail, setInviteEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('client');

  const [inviting, setInviting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load user organizations on mount
  useEffect(() => {
    setLoadingOrgs(true);
    apiGetOrganizations()
      .then((orgs) => {
        setOrganizations(orgs);
        if (orgs.length > 0) {
          setSelectedOrgId(orgs[0].id);
        }
      })
      .catch(() => {
        router.push('/login');
      })
      .finally(() => {
        setLoadingOrgs(false);
      });
  }, [router]);

  // Load members and invitations when selectedOrgId changes
  const loadOrgData = useCallback(async (orgId: string) => {
    if (!orgId) return;
    setLoadingData(true);
    try {
      const [membersRes, invsRes] = await Promise.allSettled([
        apiGetOrgMembers(orgId),
        apiGetOrgInvitations(orgId),
      ]);

      if (membersRes.status === 'fulfilled') {
        setMembers(membersRes.value);
      } else {
        setMembers([]);
      }

      if (invsRes.status === 'fulfilled') {
        setInvitations(invsRes.value);
      } else {
        setInvitations([]);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load organization data');
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (selectedOrgId) {
      setSuccessMsg(null);
      setErrorMsg(null);
      loadOrgData(selectedOrgId);
    }
  }, [selectedOrgId, loadOrgData]);

  const currentOrg = organizations.find((o) => o.id === selectedOrgId);
  const isAdmin = currentOrg?.role === 'admin';

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId) return;

    setInviting(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    let payload: any = { method: inviteMethod, role: inviteRole };

    if (inviteMethod === 'email') {
      const trimmedEmail = inviteEmail.trim();
      if (!trimmedEmail || !trimmedEmail.includes('@')) {
        setErrorMsg('Please enter a valid email address.');
        setInviting(false);
        return;
      }
      payload.email = trimmedEmail;
    } else {
      const trimmedPhone = invitePhone.trim().replace(/[\s\-\(\)]/g, '');
      if (!trimmedPhone || trimmedPhone.length < 8) {
        setErrorMsg('Please enter a valid mobile number.');
        setInviting(false);
        return;
      }
      const fullPhone = trimmedPhone.startsWith('+') ? trimmedPhone : `${countryCode}${trimmedPhone}`;
      payload.phone = fullPhone;
    }

    try {
      await apiInviteMember(selectedOrgId, payload);
      setSuccessMsg('Invitation created and queued successfully.');
      setInviteEmail('');
      setInvitePhone('');
      await loadOrgData(selectedOrgId);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send invitation. Please try again.');
    } finally {
      setInviting(false);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');

  const handleCancelInvite = async (invitationId: string) => {
    setActionLoadingId(invitationId);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      await apiCancelInvitation(selectedOrgId, invitationId);
      setSuccessMsg('Invitation cancelled.');
      await loadOrgData(selectedOrgId);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to cancel invitation');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleResendInvite = async (invitationId: string) => {
    setActionLoadingId(invitationId);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      await apiResendInvitation(selectedOrgId, invitationId);
      setSuccessMsg('Invitation queued for re-delivery.');
      await loadOrgData(selectedOrgId);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to resend invitation');
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredMembers = members.filter((m) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (m.user?.name && m.user.name.toLowerCase().includes(q)) ||
      (m.user?.email && m.user.email.toLowerCase().includes(q)) ||
      m.role.toLowerCase().includes(q)
    );
  });

  const filteredInvitations = invitations.filter((inv) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (inv.email && inv.email.toLowerCase().includes(q)) ||
      (inv.phone && inv.phone.toLowerCase().includes(q)) ||
      inv.role.toLowerCase().includes(q) ||
      inv.status.toLowerCase().includes(q)
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/30">✓ Sent</span>;
      case 'delivery_failed':
        return <span className="text-[10px] font-mono font-bold text-rose-400 bg-rose-500/15 px-2 py-0.5 rounded border border-rose-500/30">✕ Delivery Failed</span>;
      default:
        return <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/30">⏳ Pending</span>;
    }
  };

  const handleMemberRoleChange = async (memberId: string, newRole: UserRole) => {
    setActionLoadingId(memberId);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      await apiUpdateOrgMemberRole(selectedOrgId, memberId, newRole);
      setSuccessMsg('Member role updated successfully.');
      await loadOrgData(selectedOrgId);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update member role');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member from the organization?')) return;
    setActionLoadingId(memberId);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      await apiRemoveOrgMember(selectedOrgId, memberId);
      setSuccessMsg('Member removed from organization.');
      await loadOrgData(selectedOrgId);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to remove member');
    } finally {
      setActionLoadingId(null);
    }
  };

  const maskPhone = (phone?: string | null) => {
    if (!phone) return 'Mobile Contact';
    if (phone.length <= 6) return phone;
    const prefix = phone.slice(0, 3);
    const suffix = phone.slice(-4);
    return `${prefix} ••••••${suffix}`;
  };

  const getRoleBadgeStyle = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin':
        return 'bg-purple-500/15 text-purple-300 border border-purple-500/30';
      case 'developer':
        return 'bg-sky-500/15 text-sky-300 border border-sky-500/30';
      case 'client':
        return 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30';
      default:
        return 'bg-slate-800 text-slate-300 border border-slate-700';
    }
  };

  const getInitials = (name?: string, email?: string) => {
    if (name && name.trim().length > 0) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return name.slice(0, 2).toUpperCase();
    }
    if (email) return email.slice(0, 2).toUpperCase();
    return '??';
  };

  if (loadingOrgs) {
    return (
      <div className="min-h-screen bg-[#0B0F19] flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <svg className="animate-spin h-5 w-5 text-indigo-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="text-xs font-medium">Loading organization settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F19] text-[#F8FAFC] selection:bg-indigo-600 selection:text-white pb-16">
      {/* Header Bar */}
      <header className="sticky top-0 z-30 border-b border-[#1F2937] bg-[#111827]/90 backdrop-blur-md px-6 py-4 shadow-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-indigo-400 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Dashboard
            </Link>
            <div className="h-4 w-px bg-slate-800" />
            <div>
              <h1 className="text-lg font-extrabold text-slate-100 tracking-tight">Team Management</h1>
              <p className="text-xs text-slate-400">Manage workspace members and multi-channel team invitations</p>
            </div>
          </div>

          {/* Organization Selector */}
          {organizations.length > 0 && (
            <div className="flex items-center gap-2">
              <label htmlFor="org-select" className="text-xs text-slate-400 font-semibold hidden sm:inline">
                Workspace:
              </label>
              <select
                id="org-select"
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className="rounded-xl border border-[#1F2937] bg-[#0B0F19] px-3.5 py-1.5 text-xs font-bold text-slate-100 focus:border-indigo-500 focus:outline-none cursor-pointer shadow-sm"
              >
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name} ({org.role})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-6xl p-6 lg:p-8 space-y-8">
        
        {/* Global Feedback Banners */}
        {successMsg && (
          <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-semibold text-emerald-300 shadow-md">
            <svg className="w-4 h-4 shrink-0 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="flex items-center gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs font-semibold text-rose-300 shadow-md">
            <svg className="w-4 h-4 shrink-0 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT / MAIN COLUMN: Invite Team Member */}
          <div className="lg:col-span-6 space-y-6">
            <div className="rounded-2xl border border-[#1F2937] bg-[#111827] p-6 shadow-md">
              <div className="flex items-center gap-3 border-b border-[#1F2937] pb-4 mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-950 text-indigo-400 border border-indigo-500/30">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-100">Invite Team Member</h2>
                  <p className="text-xs text-slate-400">Add clients, developers, or administrators to your organization.</p>
                </div>
              </div>

              {!isAdmin && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-300">
                  <p className="font-bold">Admin Access Required</p>
                  <p className="mt-1 opacity-90">Only organization admins can invite new team members.</p>
                </div>
              )}

              {isAdmin && (
                <form onSubmit={handleInvite} className="space-y-5">
                  {/* Invitation Method Selector */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-2">Invitation Method</label>
                    <div className="flex rounded-xl bg-[#0B0F19] p-1 border border-[#1F2937]">
                      <button
                        type="button"
                        onClick={() => setInviteMethod('email')}
                        className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition-all ${
                          inviteMethod === 'email'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span>Email</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setInviteMethod('sms')}
                        className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition-all ${
                          inviteMethod === 'sms'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span>Mobile Number</span>
                      </button>
                    </div>
                  </div>

                  {/* Contact Input */}
                  {inviteMethod === 'email' ? (
                    <div>
                      <label htmlFor="invite-email" className="block text-xs font-bold text-slate-300 mb-1.5">
                        Email Address
                      </label>
                      <input
                        id="invite-email"
                        type="email"
                        required
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="name@company.com"
                        className="w-full rounded-xl border border-[#1F2937] bg-[#0B0F19] px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all"
                      />
                    </div>
                  ) : (
                    <div>
                      <label htmlFor="invite-phone" className="block text-xs font-bold text-slate-300 mb-1.5">
                        Mobile Number
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={countryCode}
                          onChange={(e) => setCountryCode(e.target.value)}
                          className="rounded-xl border border-[#1F2937] bg-[#0B0F19] px-3 py-2.5 text-xs font-bold text-slate-200 focus:border-indigo-500 focus:outline-none cursor-pointer"
                        >
                          <option value="+91">🇮🇳 +91 (India)</option>
                          <option value="+1">🇺🇸 +1 (US/CA)</option>
                          <option value="+44">🇬🇧 +44 (UK)</option>
                          <option value="+61">🇦🇺 +61 (AU)</option>
                          <option value="+971">🇦🇪 +971 (UAE)</option>
                        </select>
                        <input
                          id="invite-phone"
                          type="tel"
                          required
                          value={invitePhone}
                          onChange={(e) => setInvitePhone(e.target.value)}
                          placeholder="9876543210"
                          className="flex-1 rounded-xl border border-[#1F2937] bg-[#0B0F19] px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">E.164 normalized format: {countryCode} {invitePhone.trim() || 'XXXXXXXXXX'}</p>
                    </div>
                  )}

                  {/* Role Selection & Description */}
                  <div>
                    <label htmlFor="invite-role" className="block text-xs font-bold text-slate-300 mb-1.5">
                      Organization Role
                    </label>
                    <select
                      id="invite-role"
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as any)}
                      className="w-full rounded-xl border border-[#1F2937] bg-[#0B0F19] px-4 py-2.5 text-xs text-slate-100 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all cursor-pointer font-bold"
                    >
                      <option value="client">Client</option>
                      <option value="developer">Developer</option>
                      <option value="admin">Admin</option>
                    </select>

                    <div className="mt-2.5 rounded-xl border border-[#1F2937] bg-[#0B0F19] p-3 text-xs text-slate-400">
                      {inviteRole === 'client' && (
                        <p><strong className="text-slate-200">Client:</strong> Can view assigned projects, review deliverables and approve project completion.</p>
                      )}
                      {inviteRole === 'developer' && (
                        <p><strong className="text-slate-200">Developer:</strong> Can execute work, manage deliverables and project progress.</p>
                      )}
                      {inviteRole === 'admin' && (
                        <p><strong className="text-slate-200">Admin:</strong> Can manage organization members, projects and organization settings.</p>
                      )}
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={inviting}
                      className="inline-flex items-center justify-center gap-2 w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 px-6 py-2.5 text-xs font-bold text-white shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed min-h-[42px]"
                    >
                      {inviting ? (
                        <>
                          <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          <span>Sending Invitation...</span>
                        </>
                      ) : (
                        <span>Send Invitation</span>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Organization Members */}
          <div className="lg:col-span-6 space-y-6">
            <div className="rounded-2xl border border-[#1F2937] bg-[#111827] p-6 shadow-md">
              <div className="flex items-center justify-between border-b border-[#1F2937] pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <h2 className="text-sm font-extrabold text-slate-100">Organization Members</h2>
                </div>
                <span className="text-[11px] font-mono font-bold text-indigo-300 bg-indigo-500/15 px-2.5 py-0.5 rounded-full border border-indigo-500/30">
                  {members.length}
                </span>
              </div>

              {loadingData ? (
                <div className="py-8 text-center text-xs text-slate-400">Loading members...</div>
              ) : filteredMembers.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  {searchQuery ? 'No members match your search.' : 'No team members yet.'}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredMembers.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-3.5 rounded-xl border border-[#1F2937] bg-[#0B0F19]/60 hover:bg-[#151D2E] transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-950 text-xs font-bold text-indigo-300 border border-indigo-500/30 font-mono">
                          {getInitials(m.user?.name, m.user?.email)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-100 truncate">
                            {m.user?.name || 'Unnamed Member'}
                          </p>
                          <p className="text-[11px] text-slate-400 font-mono truncate">{m.user?.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isAdmin ? (
                          <select
                            value={m.role}
                            disabled={actionLoadingId === m.id}
                            onChange={(e) => handleMemberRoleChange(m.id, e.target.value as UserRole)}
                            className={`text-[10px] uppercase font-mono font-bold tracking-wider px-2 py-1 rounded-md border cursor-pointer ${getRoleBadgeStyle(m.role)}`}
                          >
                            <option value="client">Client</option>
                            <option value="developer">Developer</option>
                            <option value="admin">Admin</option>
                          </select>
                        ) : (
                          <span className={`text-[10px] uppercase font-mono font-bold tracking-wider px-2 py-0.5 rounded-md ${getRoleBadgeStyle(m.role)}`}>
                            {m.role}
                          </span>
                        )}

                        {isAdmin && (
                          <button
                            onClick={() => handleRemoveMember(m.id)}
                            disabled={actionLoadingId === m.id}
                            className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                            title="Remove Member"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* BOTTOM SECTION: Pending & Sent Invitations */}
        <div className="rounded-2xl border border-[#1F2937] bg-[#111827] p-6 shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#1F2937] pb-4 mb-4 gap-3">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <h2 className="text-base font-extrabold text-slate-100">Invitations</h2>
              <span className="text-[11px] font-mono font-bold text-amber-300 bg-amber-500/15 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                {invitations.length}
              </span>
            </div>

            {/* Search filter input */}
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search member or invitation..."
                className="w-full rounded-xl border border-[#1F2937] bg-[#0B0F19] pl-3 pr-8 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-200"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {loadingData ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading invitations...</div>
          ) : filteredInvitations.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              {searchQuery ? 'No invitations match your search query.' : 'No active invitations found for this workspace.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredInvitations.map((inv) => (
                <div
                  key={inv.id}
                  className="flex flex-col justify-between p-4 rounded-xl border border-[#1F2937] bg-[#0B0F19]/60 space-y-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="uppercase text-[9px] font-mono font-extrabold tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {inv.invitationMethod === 'sms' ? 'SMS / Mobile' : 'Email'}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {getStatusBadge(inv.status)}
                        <span className={`text-[10px] uppercase font-mono font-bold tracking-wider px-2 py-0.5 rounded-md ${getRoleBadgeStyle(inv.role)}`}>
                          {inv.role}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs font-bold text-slate-100 font-mono pt-1">
                      {inv.invitationMethod === 'sms' ? maskPhone(inv.phone) : inv.email}
                    </p>

                    {inv.failureReason && (
                      <div className="text-[10px] text-rose-400 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20 font-mono leading-tight">
                        Reason: {inv.failureReason}
                      </div>
                    )}

                    <p className="text-[11px] text-slate-500">
                      {inv.isExpired ? (
                        <span className="text-rose-400 font-semibold">Expired</span>
                      ) : (
                        `Expires ${new Date(inv.expiresAt).toLocaleDateString()}`
                      )}
                    </p>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-2 pt-2 border-t border-[#1F2937]">
                      <button
                        onClick={() => handleResendInvite(inv.id)}
                        disabled={actionLoadingId === inv.id}
                        className="flex-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 py-1.5 text-xs font-bold transition-all disabled:opacity-50 min-h-[36px]"
                      >
                        {actionLoadingId === inv.id ? '...' : inv.status === 'delivery_failed' ? 'Retry' : 'Resend'}
                      </button>
                      <button
                        onClick={() => handleCancelInvite(inv.id)}
                        disabled={actionLoadingId === inv.id}
                        className="flex-1 rounded-lg bg-[#151D2E] hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-slate-700 py-1.5 text-xs font-bold transition-all disabled:opacity-50 min-h-[36px]"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
