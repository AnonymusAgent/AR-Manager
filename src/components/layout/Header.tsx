'use client';

import React, { useState, useEffect } from 'react';
import { Bell, ChevronDown } from 'lucide-react';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface HeaderProps {
  user: User;
  title?: string;
}

const ROLE_LABELS: Record<string, string> = {
  administrator: 'System Administrator',
  supervisor: 'Supervisor Operations',
  manager: 'Account Manager Operations',
  senior_lead: 'Senior Lead Operations',
  team_lead: 'Team Lead Operations',
  ar_executive: 'AR Executive',
  billing_user: 'Billing Specialist',
};

export function Header({ user, title }: HeaderProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Array<{ id: string; title: string; message: string; isRead: boolean; createdAt: string }>>([]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications?limit=5', { credentials: 'include' });
      const data = await res.json();
      if (data.notifications) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    } catch {}
  };

  const markAsRead = async () => {
    try {
      await fetch('/api/notifications/mark-read', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }), credentials: 'include',
      });
      setUnreadCount(0);
      setNotifications(notifications.map(n => ({ ...n, isRead: true })));
    } catch {}
  };

  return (
    <header className="h-14 bg-[#0F2D52] px-6 flex items-center justify-between shadow-md relative z-30">
      {/* Left: Title */}
      <div>
        <h1 className="text-white font-bold text-lg tracking-tight">Account Receivable</h1>
      </div>

      {/* Right: Notifications + User */}
      <div className="flex items-center gap-5">
        {/* Notification bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
              <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-[#E5E7EB] z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB] bg-[#F5F7FA]">
                  <span className="font-semibold text-sm text-slate-900">Notifications</span>
                  {unreadCount > 0 && (
                    <button onClick={markAsRead} className="text-xs text-[#2563EB] hover:text-[#1d4ed8] font-medium">Mark all read</button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center text-[#64748B] text-sm">No notifications</div>
                  ) : (
                    notifications.map(n => (
                      <div key={n.id} className={`px-4 py-3 border-b border-[#E5E7EB] last:border-0 ${!n.isRead ? 'bg-blue-50/50' : ''}`}>
                        <p className="text-sm font-medium text-slate-900">{n.title}</p>
                        <p className="text-xs text-[#64748B] mt-0.5">{n.message}</p>
                        <p className="text-xs text-[#64748B]/60 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* User profile */}
        <div className="flex items-center gap-3 pl-4 border-l border-white/20">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold text-sm shadow-inner">
            {user.firstName[0]}{user.lastName[0]}
          </div>
          <div className="hidden sm:block">
            <p className="text-white text-sm font-semibold leading-tight">{user.firstName} {user.lastName}</p>
            <p className="text-white/50 text-xs leading-tight">{ROLE_LABELS[user.role] || user.role}</p>
          </div>
          <ChevronDown className="w-4 h-4 text-white/40" />
        </div>
      </div>
    </header>
  );
}
