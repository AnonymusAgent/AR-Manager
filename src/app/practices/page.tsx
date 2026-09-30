'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell, TableEmpty } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Search, Plus, Users, Building2 } from 'lucide-react';

interface Practice {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  npi: string | null;
  specialty: string | null;
  isActive: boolean;
  createdAt: string;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

const RESPONSIBILITY_OPTIONS = [
  { value: 'accounts_receivable', label: 'Accounts Receivable' },
  { value: 'charge_entry', label: 'Charge Entry' },
  { value: 'payment_posting', label: 'Payment Posting' },
  { value: 'prior_authorization', label: 'Prior Authorization' },
  { value: 'referral_management', label: 'Referral Management' },
  { value: 'verification_of_benefits', label: 'Verification of Benefits' },
  { value: 'full_practice_management', label: 'Full Practice Management' },
];

export default function PracticesPage() {
  const [practices, setPractices] = useState<Practice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedPractice, setSelectedPractice] = useState<Practice | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: '',
    phone: '',
    email: '',
    npi: '',
    specialty: '',
  });
  const [assignData, setAssignData] = useState({
    userId: '',
    responsibilities: [] as string[],
    isPrimary: false,
  });

  const fetchPractices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);

      const res = await fetch(`/api/practices?${params}`);
      const data = await res.json();
      if (res.ok) {
        setPractices(data.practices);
      }
    } catch (error) {
      console.error('Failed to fetch practices:', error);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchPractices();
  }, [fetchPractices]);

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
  }, []);

  const handleCreatePractice = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch('/api/practices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setShowCreateModal(false);
        setFormData({ name: '', code: '', address: '', phone: '', email: '', npi: '', specialty: '' });
        fetchPractices();
      }
    } catch (error) {
      console.error('Failed to create practice:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleAssignPractice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPractice) return;
    setSaving(true);

    try {
      const res = await fetch(`/api/practices/${selectedPractice.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assignData),
      });

      if (res.ok) {
        setShowAssignModal(false);
        setAssignData({ userId: '', responsibilities: [], isPrimary: false });
        setSelectedPractice(null);
      }
    } catch (error) {
      console.error('Failed to assign practice:', error);
    } finally {
      setSaving(false);
    }
  };

  const openAssignModal = (practice: Practice) => {
    setSelectedPractice(practice);
    setShowAssignModal(true);
  };

  return (
    <AppLayout title="Practices">
      <Card padding="none">
        {/* Filters */}
        <div className="p-4 border-b border-slate-200 flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search practices..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Practice
          </Button>
        </div>

        {/* Table */}
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Name</TableHeader>
              <TableHeader>Code</TableHeader>
              <TableHeader>Specialty</TableHeader>
              <TableHeader>NPI</TableHeader>
              <TableHeader>Phone</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">Loading...</TableCell>
              </TableRow>
            ) : practices.length === 0 ? (
              <TableEmpty message="No practices found" />
            ) : (
              practices.map((practice) => (
                <TableRow key={practice.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-slate-400" />
                      <span className="font-medium">{practice.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono">{practice.code}</TableCell>
                  <TableCell>{practice.specialty || '-'}</TableCell>
                  <TableCell>{practice.npi || '-'}</TableCell>
                  <TableCell>{practice.phone || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={practice.isActive ? 'success' : 'danger'}>
                      {practice.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => openAssignModal(practice)}>
                      <Users className="w-4 h-4 mr-1" />
                      Assign
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Create Practice Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Add Practice" size="lg">
        <form onSubmit={handleCreatePractice} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Practice Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <Input
              label="Practice Code"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              required
            />
          </div>
          <Input
            label="Address"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
            <Input
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="NPI"
              value={formData.npi}
              onChange={(e) => setFormData({ ...formData, npi: e.target.value })}
            />
            <Input
              label="Specialty"
              value={formData.specialty}
              onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Create Practice</Button>
          </div>
        </form>
      </Modal>

      {/* Assign Practice Modal */}
      <Modal isOpen={showAssignModal} onClose={() => setShowAssignModal(false)} title={`Assign User to ${selectedPractice?.name}`}>
        <form onSubmit={handleAssignPractice} className="space-y-4">
          <Select
            label="User"
            value={assignData.userId}
            onChange={(e) => setAssignData({ ...assignData, userId: e.target.value })}
            options={[
              { value: '', label: 'Select a user...' },
              ...users.map(u => ({ value: u.id, label: `${u.firstName} ${u.lastName}` })),
            ]}
          />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Responsibilities</label>
            <div className="space-y-2">
              {RESPONSIBILITY_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={assignData.responsibilities.includes(opt.value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setAssignData({ ...assignData, responsibilities: [...assignData.responsibilities, opt.value] });
                      } else {
                        setAssignData({ ...assignData, responsibilities: assignData.responsibilities.filter(r => r !== opt.value) });
                      }
                    }}
                    className="rounded border-slate-300"
                  />
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={assignData.isPrimary}
              onChange={(e) => setAssignData({ ...assignData, isPrimary: e.target.checked })}
              className="rounded border-slate-300"
            />
            <span className="text-sm font-medium">Primary Assignment</span>
          </label>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowAssignModal(false)}>Cancel</Button>
            <Button type="submit" loading={saving} disabled={!assignData.userId}>Assign</Button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
