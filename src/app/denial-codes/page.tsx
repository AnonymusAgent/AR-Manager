'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell, TableEmpty } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Search, Plus } from 'lucide-react';

interface DenialCode {
  id: number;
  code: string;
  codeType: string;
  description: string;
  category: string | null;
  isActive: boolean;
}

const TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'CARC', label: 'CARC' },
  { value: 'RARC', label: 'RARC' },
];

export default function DenialCodesPage() {
  const [codes, setCodes] = useState<DenialCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    codeType: 'CARC',
    description: '',
    category: '',
  });
  const [saving, setSaving] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState('');

  const fetchCodes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (typeFilter) params.set('codeType', typeFilter);

      const res = await fetch(`/api/denial-codes?${params}`);
      const data = await res.json();
      if (res.ok) {
        setCodes(data.denialCodes);
      }
    } catch (error) {
      console.error('Failed to fetch denial codes:', error);
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter]);

  useEffect(() => {
    fetchCodes();
    // Get current user role
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => setCurrentUserRole(data.user?.role || ''))
      .catch(console.error);
  }, [fetchCodes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch('/api/denial-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setShowModal(false);
        setFormData({ code: '', codeType: 'CARC', description: '', category: '' });
        fetchCodes();
      }
    } catch (error) {
      console.error('Failed to create denial code:', error);
    } finally {
      setSaving(false);
    }
  };

  const canManage = currentUserRole === 'administrator';

  return (
    <AppLayout title="Denial Codes">
      <Card padding="none">
        {/* Filters */}
        <div className="p-4 border-b border-slate-200 flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by code or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            options={TYPE_OPTIONS}
            className="w-32"
          />
          {canManage && (
            <Button onClick={() => setShowModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Code
            </Button>
          )}
        </div>

        {/* Table */}
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Code</TableHeader>
              <TableHeader>Type</TableHeader>
              <TableHeader>Description</TableHeader>
              <TableHeader>Category</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : codes.length === 0 ? (
              <TableEmpty message="No denial codes found" />
            ) : (
              codes.map((code) => (
                <TableRow key={code.id}>
                  <TableCell className="font-mono font-medium">{code.code}</TableCell>
                  <TableCell>
                    <Badge variant={code.codeType === 'CARC' ? 'info' : 'purple'}>
                      {code.codeType}
                    </Badge>
                  </TableCell>
                  <TableCell>{code.description}</TableCell>
                  <TableCell>{code.category || '-'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Add Code Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Add Denial Code"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Code"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              required
            />
            <Select
              label="Type"
              value={formData.codeType}
              onChange={(e) => setFormData({ ...formData, codeType: e.target.value })}
              options={[
                { value: 'CARC', label: 'CARC' },
                { value: 'RARC', label: 'RARC' },
              ]}
            />
          </div>
          <Input
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            required
          />
          <Input
            label="Category"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Add Code
            </Button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
