'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, Organization } from '@intentflow/types';
import { apiLogout, apiGetOrganizations, apiGetMe } from '@/lib/api-client';
import { NotificationBell } from '../notifications/NotificationBell';

interface AppHeaderProps {
  user?: User | null;
  userRole?: string;
  organizations?: (Organization & { role: string })[];
  currentOrgId?: string;
  onSelectOrg?: (orgId: string) => void;
}

export function AppHeader({
  user: initialUser,
  userRole: initialRole,
  organizations: initialOrgs,
  currentOrgId,
  onSelectOrg,
}: AppHeaderProps) {
  const pathname = usePathname() || '';
  const [user, setUser] = useState<User | null>(initialUser || null);
  const [userRole, setUserRole] = useState<string>(initialRole || 'developer');
  const [orgs, setOrgs] = useState<(Organization & { role: string })[]>(initialOrgs || []);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!initialUser || !initialOrgs) {
      loadUserData();
    }
  }, [initialUser, initialOrgs]);

  const loadUserData = async () => {
    try {
      const meRes = await apiGetMe();
      setUser(meRes.user);
      setUserRole(meRes.memberships[0]?.role || 'developer');
      const orgsRes = await apiGetOrganizations();
      setOrgs(orgsRes);
    } catch {
      // Ignore if unauthenticated
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await apiLogout();
      window.location.href = '/login';
    } catch (err) {
      console.error('Logout error:', err);
      window.location.href = '/login';
    } finally {
      setLoggingOut(false);
    }
  };

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const navItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Projects', href: '/projects' },
    { label: 'Notifications', href: '/notifications' },
    { label: 'Settings', href: '/settings' },
  ];

  const currentOrg = orgs.find((o) => o.id === currentOrgId) || orgs[0];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#0F172A]/90 backdrop-blur-md px-4 sm:px-6 py-3 shadow-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        {/* Left Side: Brand Logo & Navigation Links */}
        <div className="flex items-center gap-6 sm:gap-8">
          <Link
            href="/dashboard"
            className="font-extrabold text-lg sm:text-xl tracking-tight text-white flex items-center gap-2.5 group"
          >
            <span className="w-3 h-3 rounded-full bg-indigo-500 group-hover:scale-110 transition-transform shadow-sm shadow-indigo-500/50" />
            <span className="bg-gradient-to-r from-white via-slate-100 to-indigo-300 bg-clip-text text-transparent">
              IntentFlow
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-1.5 text-xs font-semibold">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    isActive
                      ? 'bg-indigo-600/20 text-indigo-400 font-bold border border-indigo-500/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Side: Org Switcher, Notifications, User Profile */}
        <div className="flex items-center gap-2.5 sm:gap-4 text-xs">
          {/* Org Switcher (Desktop) */}
          {orgs.length > 0 && (
            <div className="hidden lg:flex items-center gap-2">
              <label htmlFor="header-org-select" className="sr-only">Select Organization</label>
              <select
                id="header-org-select"
                aria-label="Select Organization"
                value={currentOrg?.id || ''}
                onChange={(e) => onSelectOrg && onSelectOrg(e.target.value)}
                className="bg-[#1E293B] text-slate-200 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer max-w-[160px] truncate"
              >
                {orgs.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Notifications */}
          <NotificationBell />

          {/* User Profile Dropdown / Card */}
          {user && (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[#1E293B] border border-slate-700/80 hover:border-slate-600 text-slate-200 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-expanded={userMenuOpen}
                aria-label="User account menu"
              >
                <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-[10px] uppercase">
                  {user.name ? user.name.slice(0, 2) : 'US'}
                </div>
                <span className="hidden sm:inline font-bold text-slate-100 max-w-[100px] truncate">
                  {user.name}
                </span>
                <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                  {userRole}
                </span>
                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* User Dropdown */}
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-700/80 bg-[#1E293B] p-2 shadow-2xl z-50 text-slate-200 space-y-1">
                  <div className="px-3 py-2 border-b border-slate-700/80 mb-1">
                    <p className="text-xs font-bold text-white truncate">{user.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                    <span className="inline-block mt-1 text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold">
                      {userRole} Role
                    </span>
                  </div>

                  <Link
                    href="/settings"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-700/60 transition-colors"
                  >
                    <span>⚙️ Account Settings</span>
                  </Link>

                  <Link
                    href="/demo"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-700/60 transition-colors"
                  >
                    <span>🚀 Switch Demo Role</span>
                  </Link>

                  <button
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                  >
                    <span>{loggingOut ? 'Signing out...' : '🚪 Sign Out'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Mobile Hamburger Trigger (min 44px touch target) */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden flex items-center justify-center min-w-[44px] min-h-[44px] p-2 rounded-xl bg-[#1E293B] border border-slate-700/80 text-slate-300 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Toggle Navigation Menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Slide-Over Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col bg-[#0B0F19]/95 backdrop-blur-xl p-6 text-slate-100 animate-fade-in">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <span className="font-extrabold text-lg text-[#F8FAFC] flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-indigo-500" />
              IntentFlow Menu
            </span>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-[#1E293B] border border-slate-700 text-slate-300 hover:text-white"
              aria-label="Close menu"
            >
              ✕
            </button>
          </div>

          <nav className="flex-1 my-6 space-y-3">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between p-3.5 rounded-xl text-sm font-bold transition-all min-h-[48px] ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                      : 'bg-[#1E293B]/60 text-slate-200 hover:bg-[#1E293B] border border-slate-800'
                  }`}
                >
                  <span>{item.label}</span>
                  <span className="text-xs">→</span>
                </Link>
              );
            })}
          </nav>

          <div className="pt-4 border-t border-slate-800 space-y-3">
            {user && (
              <div className="p-3 rounded-xl bg-[#1E293B] border border-slate-800">
                <p className="text-xs font-bold text-white">{user.name}</p>
                <p className="text-[11px] text-slate-400">{user.email}</p>
                <span className="inline-block mt-1 text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold">
                  {userRole} Role
                </span>
              </div>
            )}

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-full flex items-center justify-center min-h-[48px] rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 font-bold text-sm transition-all"
            >
              {loggingOut ? 'Signing out...' : 'Sign Out'}
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
