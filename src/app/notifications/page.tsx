'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Bell, CheckCircle, ExternalLink } from 'lucide-react';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  relatedClaimId: string | null;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const router = useRouter();

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications?limit=100');
      const data = await res.json();
      if (res.ok) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      });
      setNotifications(notifications.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds: [id] }),
      });
      setNotifications(notifications.map(n => 
        n.id === id ? { ...n, isRead: true } : n
      ));
      setUnreadCount(Math.max(0, unreadCount - 1));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const getTypeVariant = (type: string): 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' => {
    switch (type) {
      case 'new_assignment':
        return 'purple';
      case 'claim_submitted':
        return 'info';
      case 'claim_approved':
        return 'success';
      case 'claim_rejected':
        return 'danger';
      case 'rework_requested':
        return 'warning';
      default:
        return 'default';
    }
  };

  const formatType = (type: string) => {
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <AppLayout title="Notifications">
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Bell className="w-6 h-6 text-slate-400" />
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Notifications</h2>
              {unreadCount > 0 && (
                <p className="text-sm text-slate-500">{unreadCount} unread</p>
              )}
            </div>
          </div>
          {unreadCount > 0 && (
            <Button variant="secondary" onClick={handleMarkAllRead}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Mark All Read
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No notifications yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 rounded-lg border transition-colors ${
                  notification.isRead
                    ? 'bg-white border-slate-200'
                    : 'bg-blue-50 border-blue-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={getTypeVariant(notification.type)} size="sm">
                        {formatType(notification.type)}
                      </Badge>
                      {!notification.isRead && (
                        <span className="w-2 h-2 bg-blue-600 rounded-full" />
                      )}
                    </div>
                    <h3 className="font-medium text-slate-900">
                      {notification.title}
                    </h3>
                    <p className="text-sm text-slate-600 mt-1">
                      {notification.message}
                    </p>
                    <p className="text-xs text-slate-400 mt-2">
                      {new Date(notification.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {notification.relatedClaimId && (
                      <button
                        onClick={() => router.push(`/claims/${notification.relatedClaimId}`)}
                        className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                        title="View Claim"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    )}
                    {!notification.isRead && (
                      <button
                        onClick={() => handleMarkRead(notification.id)}
                        className="p-2 text-slate-400 hover:text-green-600 transition-colors"
                        title="Mark as Read"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </AppLayout>
  );
}
