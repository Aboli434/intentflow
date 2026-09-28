'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Notification } from '@intentflow/types';
import {
  apiGetNotifications,
  apiMarkNotificationRead,
  apiMarkAllNotificationsRead,
} from '@/lib/api-client';
import {
  getNotificationTargetUrl,
  formatRelativeTime,
  getNotificationTypeIcon,
} from '@/lib/notification-utils';

type FilterType = 'all' | 'unread' | 'projects' | 'organization';

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiGetNotifications({ limit: 50 });
      setNotifications(data);
    } catch (err) {
      console.error('Failed to load notifications:', err);
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setProcessingId(id);
      await apiMarkNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
      );
    } catch (err) {
      console.error('Failed to mark notification read', err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiMarkAllNotificationsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
      );
    } catch (err) {
      console.error('Failed to mark all read', err);
    }
  };

  const handleCardClick = async (n: Notification) => {
    if (!n.readAt) {
      try {
        await apiMarkNotificationRead(n.id);
      } catch (err) {}
    }
    const url = getNotificationTargetUrl(n);
    router.push(url);
  };

  const [searchQuery, setSearchQuery] = useState<string>('');

  // Filter logic
  const filteredNotifications = notifications.filter((n) => {
    if (activeFilter === 'unread' && n.readAt) return false;
    if (activeFilter === 'projects' && !n.projectId) return false;
    if (activeFilter === 'organization' && !n.type.startsWith('organization_')) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return (
        n.title.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q) ||
        (n.projectName && n.projectName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="min-h-screen bg-[#0B0F19] text-[#F8FAFC] selection:bg-indigo-600 selection:text-white pb-16">
      {/* Header Bar */}
      <header className="sticky top-0 z-30 border-b border-[#1F2937] bg-[#111827]/90 backdrop-blur-md px-4 sm:px-6 py-4 shadow-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/dashboard"
              className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors shrink-0"
            >
              ← Dashboard
            </Link>
            <span className="text-slate-700">/</span>
            <h1 className="text-base sm:text-lg font-extrabold text-slate-100 tracking-tight truncate">
              Notifications Center
            </h1>
            {unreadCount > 0 && (
              <span className="bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-mono font-bold px-2 py-0.5 rounded-full">
                {unreadCount} unread
              </span>
            )}
          </div>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 px-3.5 py-1.5 text-xs font-bold transition-all shrink-0"
            >
              Mark all as read
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-4 sm:px-6 pt-6 space-y-6">
        {/* Filters & Search */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#111827] border border-[#1F2937] rounded-2xl p-3 shadow-md">
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 no-scrollbar">
            {(['all', 'unread', 'projects', 'organization'] as FilterType[]).map((tab) => {
              const isActive = activeFilter === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveFilter(tab)}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-xl border transition-all capitalize shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                      : 'bg-[#0B0F19] text-slate-400 border-[#1F2937] hover:text-slate-200 hover:bg-[#151D2E]'
                  }`}
                >
                  {tab}
                  {tab === 'unread' && unreadCount > 0 && (
                    <span className="ml-1.5 bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="relative w-full sm:w-56">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notifications..."
              className="w-full rounded-xl border border-[#1F2937] bg-[#0B0F19] pl-3 pr-7 py-1.5 text-xs text-[#F8FAFC] placeholder:text-[#64748B] focus:border-indigo-500 focus:outline-none"
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

        {/* Error State */}
        {error && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300 font-semibold flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={fetchNotifications}
              className="underline font-bold hover:text-rose-200 ml-4"
            >
              Try again
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-[#1F2937] bg-[#111827] p-4 space-y-2 animate-pulse shadow-md"
              >
                <div className="h-4 bg-[#1F2937] rounded w-1/3" />
                <div className="h-3 bg-[#151D2E] rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : filteredNotifications.length === 0 ? (
          /* Empty State */
          <div className="rounded-2xl border border-[#1F2937] bg-[#111827] p-12 text-center space-y-3 shadow-md">
            <span className="text-3xl">✨</span>
            <h3 className="text-sm font-extrabold text-slate-100">
              {activeFilter === 'unread' ? "You're all caught up!" : 'No notifications yet'}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto font-medium">
              {activeFilter === 'unread'
                ? 'No unread notifications to review right now.'
                : "We'll let you know when something requires your attention."}
            </p>
          </div>
        ) : (
          /* Notifications List */
          <div className="space-y-3">
            {filteredNotifications.map((n) => {
              const isUnread = !n.readAt;
              const icon = getNotificationTypeIcon(n.type);
              const relTime = formatRelativeTime(n.createdAt);

              return (
                <div
                  key={n.id}
                  onClick={() => handleCardClick(n)}
                  className={`group rounded-2xl border p-4 transition-all cursor-pointer flex items-start justify-between gap-4 shadow-md ${
                    isUnread
                      ? 'bg-indigo-950/30 border-indigo-500/50'
                      : 'bg-[#111827] border-[#1F2937] hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <span className="text-xl shrink-0 pt-0.5">{icon}</span>

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {n.projectName && (
                          <span className="bg-indigo-500/15 text-indigo-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border border-indigo-500/30">
                            {n.projectName}
                          </span>
                        )}
                        <h4 className="text-xs sm:text-sm font-bold text-slate-100 group-hover:text-indigo-400 transition-colors">
                          {n.title}
                        </h4>
                      </div>

                      <p className="text-xs text-slate-400 leading-relaxed">{n.body}</p>

                      <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-500 font-mono">
                        <span>{relTime}</span>
                        <span>•</span>
                        <span>{new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>

                  {isUnread && (
                    <button
                      onClick={(e) => handleMarkRead(n.id, e)}
                      disabled={processingId === n.id}
                      title="Mark read"
                      className="px-2.5 py-1 text-[11px] font-bold text-indigo-300 hover:text-indigo-200 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 rounded-lg transition-all shrink-0"
                    >
                      {processingId === n.id ? '...' : 'Mark read'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
