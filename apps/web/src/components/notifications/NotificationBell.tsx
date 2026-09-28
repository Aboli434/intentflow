'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Notification } from '@intentflow/types';
import {
  apiGetNotifications,
  apiGetUnreadNotificationCount,
  apiMarkNotificationRead,
  apiMarkAllNotificationsRead,
} from '../../lib/api-client';
import {
  getNotificationTargetUrl,
  formatRelativeTime,
  getNotificationTypeIcon,
} from '../../lib/notification-utils';

export function NotificationBell() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadData = async () => {
    try {
      const count = await apiGetUnreadNotificationCount();
      setUnreadCount(count);
      const list = await apiGetNotifications({ limit: 15 });
      setNotifications(list);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleBellClick = () => {
    // Mobile viewport: navigate straight to /notifications
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      router.push('/notifications');
      return;
    }
    setIsOpen((prev) => !prev);
  };

  const handleMarkRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiMarkNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark read', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiMarkAllNotificationsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all read', err);
    }
  };

  const handleNotificationClick = async (n: Notification) => {
    if (!n.readAt) {
      try {
        await apiMarkNotificationRead(n.id);
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {}
    }
    setIsOpen(false);
    const targetUrl = getNotificationTargetUrl(n);
    router.push(targetUrl);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleBellClick}
        className="relative p-2 text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#151D2E] rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/40 border border-[#1F2937]"
        aria-label="Notifications"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-[#0B0F19] animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Desktop Notification Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2.5 w-80 sm:w-96 rounded-2xl border border-[#1F2937] bg-[#111827] shadow-2xl z-50 overflow-hidden text-[#F8FAFC]">
          <div className="flex items-center justify-between border-b border-[#1F2937] px-4 py-3 bg-[#0B0F19]/60">
            <div className="flex items-center gap-2">
              <span className="text-sm">🔔</span>
              <h4 className="text-xs font-extrabold text-[#F8FAFC] tracking-wide uppercase">Notifications</h4>
              {unreadCount > 0 && (
                <span className="bg-indigo-500/10 text-indigo-400 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border border-indigo-500/30">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 transition"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-[#1F2937] custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <span className="text-2xl">✨</span>
                <p className="text-xs font-bold text-[#F8FAFC]">You&apos;re all caught up!</p>
                <p className="text-[11px] text-[#94A3B8]">No unread notifications.</p>
              </div>
            ) : (
              notifications.map((n) => {
                const isUnread = !n.readAt;
                const icon = getNotificationTypeIcon(n.type);
                const relTime = formatRelativeTime(n.createdAt);

                return (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`p-3.5 hover:bg-[#151D2E] transition cursor-pointer flex items-start gap-3 group ${
                      isUnread ? 'bg-indigo-500/10 border-l-2 border-indigo-500' : ''
                    }`}
                  >
                    <span className="text-base shrink-0 pt-0.5">{icon}</span>

                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[#F8FAFC] group-hover:text-indigo-400 transition-colors truncate">
                          {n.title}
                        </span>
                        <span className="text-[10px] text-[#64748B] shrink-0 font-mono">
                          {relTime}
                        </span>
                      </div>

                      <p className="text-xs text-[#94A3B8] leading-snug line-clamp-2">
                        {n.body}
                      </p>

                      {n.projectName && (
                        <div className="pt-0.5">
                          <span className="inline-block bg-[#0B0F19] text-[#94A3B8] text-[10px] font-mono px-1.5 py-0.5 rounded border border-[#1F2937]">
                            Project: {n.projectName}
                          </span>
                        </div>
                      )}
                    </div>

                    {isUnread && (
                      <button
                        onClick={(e) => handleMarkRead(n.id, e)}
                        title="Mark as read"
                        className="text-indigo-400 hover:text-indigo-300 p-1 shrink-0"
                      >
                        <span className="w-2 h-2 rounded-full bg-indigo-500 block" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-[#1F2937] p-2.5 bg-[#0B0F19]/60 text-center">
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors inline-flex items-center gap-1"
            >
              View all notifications →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

