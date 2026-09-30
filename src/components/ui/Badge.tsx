'use client';

import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
  size?: 'sm' | 'md';
}

export function Badge({ children, variant = 'default', size = 'md' }: BadgeProps) {
  const variants = {
    default: 'bg-slate-100 text-slate-700',
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    danger: 'bg-red-100 text-red-700',
    info: 'bg-blue-100 text-blue-700',
    purple: 'bg-purple-100 text-purple-700',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${variants[variant]} ${sizes[size]}`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { variant: BadgeProps['variant']; label: string }> = {
    new: { variant: 'info', label: 'New' },
    assigned: { variant: 'purple', label: 'Assigned' },
    in_progress: { variant: 'warning', label: 'In Progress' },
    pending: { variant: 'default', label: 'Pending' },
    submitted_for_review: { variant: 'info', label: 'Under Review' },
    approved: { variant: 'success', label: 'Approved' },
    rework_required: { variant: 'danger', label: 'Rework' },
    paid: { variant: 'success', label: 'Paid' },
    denied: { variant: 'danger', label: 'Denied' },
    closed: { variant: 'default', label: 'Closed' },
    sent_to_coding: { variant: 'purple', label: 'Sent to Coding' },
    coding_review: { variant: 'warning', label: 'Coding Review' },
    coding_corrected: { variant: 'success', label: 'Coding Corrected' },
    returned_to_billing: { variant: 'info', label: 'Returned' },
    resubmitted: { variant: 'success', label: 'Resubmitted' },
  };

  const config = statusConfig[status] || { variant: 'default' as const, label: status };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export function RoleBadge({ role }: { role: string }) {
  const roleConfig: Record<string, { variant: BadgeProps['variant']; label: string }> = {
    administrator: { variant: 'danger', label: 'Administrator' },
    supervisor: { variant: 'purple', label: 'Supervisor' },
    manager: { variant: 'purple', label: 'Manager' },
    senior_lead: { variant: 'info', label: 'Senior Lead' },
    team_lead: { variant: 'warning', label: 'Team Lead' },
    ar_executive: { variant: 'default', label: 'AR Executive' },
    billing_user: { variant: 'default', label: 'Billing User' },
  };

  const config = roleConfig[role] || { variant: 'default' as const, label: role };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
