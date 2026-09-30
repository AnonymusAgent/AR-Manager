'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell, TableEmpty } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Search, Plus, ChevronLeft, ChevronRight, UserPlus } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  category: string;
  status: string;
  priority: string | null;
  patientName: string | null;
  insuranceName: string | null;
  dueDate: string | null;
  assigneeName: string | null;
  practiceName: string | null;
  createdAt: string;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

const CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories' },
  { value: 'prior_authorization', label: 'Prior Authorization' },
  { value: 'referral_management', label: 'Referral Management' },
  { value: 'verification_of_benefits', label: 'Verification of Benefits' },
  { value: 'charge_entry', label: 'Charge Entry' },
  { value: 'payment_posting', label: 'Payment Posting' },
  { value: 'custom', label: 'Custom Task' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'new', label: 'New' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'submitted_for_signoff', label: 'Pending Sign-off' },
  { value: 'signed_off', label: 'Signed Off' },
];

function TaskStatusBadge({ status }: { status: string }) {
  const config: Record<string, { variant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple'; label: string }> = {
    new: { variant: 'info', label: 'New' },
    assigned: { variant: 'purple', label: 'Assigned' },
    in_progress: { variant: 'warning', label: 'In Progress' },
    pending: { variant: 'default', label: 'Pending' },
    completed: { variant: 'success', label: 'Completed' },
    submitted_for_signoff: { variant: 'info', label: 'Pending Sign-off' },
    signed_off: { variant: 'success', label: 'Signed Off' },
    rejected: { variant: 'danger', label: 'Rejected' },
  };
  const c = config[status] || { variant: 'default' as const, label: status };
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

function CategoryBadge({ category }: { category: string }) {
  const labels: Record<string, string> = {
    prior_authorization: 'Prior Auth',
    referral_management: 'Referral',
    verification_of_benefits: 'VOB',
    charge_entry: 'Charge Entry',
    payment_posting: 'Payment Posting',
    custom: 'Custom',
  };
  return <Badge variant="default">{labels[category] || category}</Badge>;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [creating, setCreating] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'prior_authorization',
    priority: 'normal',
    patientName: '',
    insuranceName: '',
    dueDate: '',
    assignedTo: '',
  });
  const router = useRouter();

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (category) params.set('category', category);
      if (status) params.set('status', status);

      const res = await fetch(`/api/tasks?${params}`);
      const data = await res.json();
      if (res.ok) {
        setTasks(data.tasks);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoading(false);
    }
  }, [page, search, category, status]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch('/api/users?isActive=true');
        const data = await res.json();
        if (res.ok) {
          setUsers(data.users.filter((u: User) => ['ar_executive', 'billing_user'].includes(u.role)));
        }
      } catch (error) {
        console.error('Failed to fetch users:', error);
      }
    };
    fetchUsers();

    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => setCurrentUserRole(data.user?.role || ''))
      .catch(console.error);
  }, []);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setShowCreateModal(false);
        setFormData({
          title: '',
          description: '',
          category: 'prior_authorization',
          priority: 'normal',
          patientName: '',
          insuranceName: '',
          dueDate: '',
          assignedTo: '',
        });
        fetchTasks();
      }
    } catch (error) {
      console.error('Failed to create task:', error);
    } finally {
      setCreating(false);
    }
  };

  const canCreateTasks = ['administrator', 'supervisor', 'manager', 'senior_lead', 'team_lead'].includes(currentUserRole);

  return (
    <AppLayout title="Billing Tasks">
      <Card padding="none">
        {/* Filters */}
        <div className="p-4 border-b border-slate-200 flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <Select
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            options={CATEGORY_OPTIONS}
            className="w-44"
          />
          <Select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            options={STATUS_OPTIONS}
            className="w-40"
          />
          {canCreateTasks && (
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New Task
            </Button>
          )}
        </div>

        {/* Table */}
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Title</TableHeader>
              <TableHeader>Category</TableHeader>
              <TableHeader>Patient</TableHeader>
              <TableHeader>Insurance</TableHeader>
              <TableHeader>Due Date</TableHeader>
              <TableHeader>Assigned To</TableHeader>
              <TableHeader>Status</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">Loading...</TableCell>
              </TableRow>
            ) : tasks.length === 0 ? (
              <TableEmpty message="No tasks found" />
            ) : (
              tasks.map((task) => (
                <TableRow
                  key={task.id}
                  onClick={() => router.push(`/tasks/${task.id}`)}
                >
                  <TableCell className="font-medium">{task.title}</TableCell>
                  <TableCell><CategoryBadge category={task.category} /></TableCell>
                  <TableCell>{task.patientName || '-'}</TableCell>
                  <TableCell>{task.insuranceName || '-'}</TableCell>
                  <TableCell>{task.dueDate || '-'}</TableCell>
                  <TableCell>{task.assigneeName || '-'}</TableCell>
                  <TableCell><TaskStatusBadge status={task.status} /></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
          <p className="text-sm text-slate-600">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Create Task Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create New Task" size="lg">
        <form onSubmit={handleCreateTask} className="space-y-4">
          <Input
            label="Title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Category"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              options={CATEGORY_OPTIONS.filter(c => c.value !== '')}
            />
            <Select
              label="Priority"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              options={[
                { value: 'low', label: 'Low' },
                { value: 'normal', label: 'Normal' },
                { value: 'high', label: 'High' },
                { value: 'urgent', label: 'Urgent' },
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Patient Name"
              value={formData.patientName}
              onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
            />
            <Input
              label="Insurance"
              value={formData.insuranceName}
              onChange={(e) => setFormData({ ...formData, insuranceName: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Due Date"
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
            />
            <Select
              label="Assign To"
              value={formData.assignedTo}
              onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
              options={[
                { value: '', label: 'Unassigned' },
                ...users.map(u => ({ value: u.id, label: `${u.firstName} ${u.lastName}` })),
              ]}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button type="submit" loading={creating}>Create Task</Button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
