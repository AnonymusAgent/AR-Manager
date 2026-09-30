'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  BarChart3, Users, FileText, CheckSquare, Clock, Building2,
  TrendingUp, AlertTriangle, CheckCircle, ExternalLink,
} from 'lucide-react';

interface DashboardData {
  claims: {
    total: number;
    byStatus: Record<string, number>;
  };
  tasks: {
    total: number;
    byStatus: Record<string, number>;
    byCategory: Array<{ category: string; count: number }>;
  };
  signoffs: {
    pending: number;
  };
  documents: {
    pendingReview: number;
  };
  practices: {
    total: number;
  };
  userProductivity: Array<{
    id: string;
    name: string;
    role: string;
    tasksCompletedToday: number;
    totalAssignedTasks: number;
    totalAssignedClaims: number;
    practiceCount: number;
  }>;
  recentPendingSignoffs: Array<{
    id: string;
    entityType: string;
    submittedAt: string;
    submitterName: string;
  }>;
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  subtitle,
  onClick,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  subtitle?: string;
  onClick?: () => void;
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-emerald-100 text-emerald-600',
    yellow: 'bg-amber-100 text-amber-600',
    red: 'bg-red-100 text-red-600',
    purple: 'bg-purple-100 text-purple-600',
    slate: 'bg-slate-100 text-slate-600',
  };

  return (
    <Card className={onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} onClick={onClick}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
          {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-xl ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </Card>
  );
}

export default function SupervisorDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await fetch('/api/supervisor/dashboard');
        const result = await res.json();
        if (res.ok) {
          setData(result);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <AppLayout title="Supervisor Panel">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!data) {
    return (
      <AppLayout title="Supervisor Panel">
        <div className="text-center py-12 text-slate-500">Failed to load dashboard data</div>
      </AppLayout>
    );
  }

  const categoryLabels: Record<string, string> = {
    prior_authorization: 'Prior Auth',
    referral_management: 'Referral',
    verification_of_benefits: 'VOB',
    charge_entry: 'Charge Entry',
    payment_posting: 'Payment',
    custom: 'Custom',
  };

  return (
    <AppLayout title="Supervisor Panel">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Total Claims"
          value={data.claims.total}
          icon={FileText}
          color="blue"
          onClick={() => router.push('/claims')}
        />
        <StatCard
          title="Total Tasks"
          value={data.tasks.total}
          icon={CheckSquare}
          color="purple"
          onClick={() => router.push('/tasks')}
        />
        <StatCard
          title="Pending Sign-offs"
          value={data.signoffs.pending}
          icon={Clock}
          color="yellow"
          onClick={() => router.push('/signoffs?status=pending')}
        />
        <StatCard
          title="Documents to Review"
          value={data.documents.pendingReview}
          icon={AlertTriangle}
          color="red"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Tasks by Category */}
        <Card>
          <CardHeader title="Tasks by Category" />
          <div className="space-y-3">
            {data.tasks.byCategory.map((cat) => (
              <div key={cat.category} className="flex items-center justify-between">
                <span className="text-sm text-slate-600">
                  {categoryLabels[cat.category] || cat.category}
                </span>
                <span className="font-semibold text-slate-900">{cat.count}</span>
              </div>
            ))}
            {data.tasks.byCategory.length === 0 && (
              <p className="text-slate-500 text-center py-4">No tasks yet</p>
            )}
          </div>
        </Card>

        {/* Claims by Status */}
        <Card>
          <CardHeader title="Claims by Status" />
          <div className="space-y-3">
            {[
              { key: 'new', label: 'New', color: 'bg-blue-500' },
              { key: 'assigned', label: 'Assigned', color: 'bg-purple-500' },
              { key: 'in_progress', label: 'In Progress', color: 'bg-amber-500' },
              { key: 'submitted_for_review', label: 'Under Review', color: 'bg-cyan-500' },
              { key: 'approved', label: 'Approved', color: 'bg-emerald-500' },
              { key: 'denied', label: 'Denied', color: 'bg-red-500' },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${item.color}`} />
                  <span className="text-sm text-slate-600">{item.label}</span>
                </div>
                <span className="font-medium text-slate-900">
                  {data.claims.byStatus[item.key] || 0}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Tasks by Status */}
        <Card>
          <CardHeader title="Tasks by Status" />
          <div className="space-y-3">
            {[
              { key: 'new', label: 'New', color: 'bg-blue-500' },
              { key: 'assigned', label: 'Assigned', color: 'bg-purple-500' },
              { key: 'in_progress', label: 'In Progress', color: 'bg-amber-500' },
              { key: 'completed', label: 'Completed', color: 'bg-emerald-500' },
              { key: 'submitted_for_signoff', label: 'Pending Sign-off', color: 'bg-cyan-500' },
              { key: 'signed_off', label: 'Signed Off', color: 'bg-green-500' },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${item.color}`} />
                  <span className="text-sm text-slate-600">{item.label}</span>
                </div>
                <span className="font-medium text-slate-900">
                  {data.tasks.byStatus[item.key] || 0}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Productivity */}
        <Card>
          <CardHeader
            title="Team Productivity"
            action={
              <Button variant="ghost" size="sm" onClick={() => router.push('/users')}>
                Manage Users
              </Button>
            }
          />
          {data.userProductivity.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No team members</p>
          ) : (
            <div className="space-y-3">
              {data.userProductivity.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                      {user.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{user.name}</p>
                      <p className="text-xs text-slate-500">
                        {user.totalAssignedTasks} tasks • {user.totalAssignedClaims} claims
                        {user.practiceCount > 0 && ` • ${user.practiceCount} practices`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-emerald-600">
                      {user.tasksCompletedToday}
                    </p>
                    <p className="text-xs text-slate-500">today</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Pending Sign-offs */}
        <Card>
          <CardHeader
            title="Pending Sign-offs"
            action={
              <Button variant="ghost" size="sm" onClick={() => router.push('/signoffs')}>
                View All
              </Button>
            }
          />
          {data.recentPendingSignoffs.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-emerald-300 mx-auto mb-2" />
              <p className="text-slate-500">All caught up!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.recentPendingSignoffs.map((signoff) => (
                <div
                  key={signoff.id}
                  className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg cursor-pointer hover:bg-amber-100 transition-colors"
                  onClick={() => router.push(`/signoffs`)}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="warning" size="sm">{signoff.entityType}</Badge>
                      <span className="text-sm font-medium text-slate-900">
                        {signoff.submitterName}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(signoff.submittedAt).toLocaleString()}
                    </p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-slate-400" />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="mt-6">
        <CardHeader title="Quick Actions" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Button variant="outline" className="h-auto py-4 flex-col" onClick={() => router.push('/tasks')}>
            <CheckSquare className="w-6 h-6 mb-2" />
            <span>Assign Tasks</span>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex-col" onClick={() => router.push('/claims')}>
            <FileText className="w-6 h-6 mb-2" />
            <span>Assign Claims</span>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex-col" onClick={() => router.push('/practices')}>
            <Building2 className="w-6 h-6 mb-2" />
            <span>Manage Practices</span>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex-col" onClick={() => router.push('/signoffs')}>
            <Clock className="w-6 h-6 mb-2" />
            <span>Review Sign-offs</span>
          </Button>
        </div>
      </Card>
    </AppLayout>
  );
}
