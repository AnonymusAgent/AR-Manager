'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell, TableEmpty } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { ChevronLeft, ChevronRight, Search, Filter } from 'lucide-react';

interface AuditLog {
  id: string;
  userId: string | null;
  userName: string;
  action: string;
  entityType: string;
  entityId: string | null;
  previousValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'user_login', label: 'User Login' },
  { value: 'user_logout', label: 'User Logout' },
  { value: 'user_created', label: 'User Created' },
  { value: 'user_updated', label: 'User Updated' },
  { value: 'claim_created', label: 'Claim Created' },
  { value: 'claim_updated', label: 'Claim Updated' },
  { value: 'claim_assigned', label: 'Claim Assigned' },
  { value: 'claim_status_changed', label: 'Status Changed' },
  { value: 'claim_note_added', label: 'Note Added' },
  { value: 'claim_submitted_for_review', label: 'Submitted for Review' },
  { value: 'claim_approved', label: 'Claim Approved' },
  { value: 'claim_rejected', label: 'Claim Rejected' },
  { value: 'document_uploaded', label: 'Document Uploaded' },
  { value: 'file_uploaded', label: 'File Uploaded' },
];

const ENTITY_OPTIONS = [
  { value: '', label: 'All Entities' },
  { value: 'user', label: 'User' },
  { value: 'claim', label: 'Claim' },
  { value: 'claimNote', label: 'Claim Note' },
  { value: 'claimDocument', label: 'Document' },
  { value: 'uploadedFile', label: 'Uploaded File' },
  { value: 'denialCode', label: 'Denial Code' },
];

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '50',
      });
      if (search) params.set('search', search);
      if (actionFilter) params.set('action', actionFilter);
      if (entityFilter) params.set('entityType', entityFilter);

      const res = await fetch(`/api/audit-logs?${params}`);
      const data = await res.json();
      if (res.ok) {
        setLogs(data.auditLogs);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setLoading(false);
    }
  }, [page, search, actionFilter, entityFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const formatAction = (action: string) => {
    return action
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getActionVariant = (action: string): 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' => {
    if (action.includes('login') || action.includes('created')) return 'success';
    if (action.includes('logout') || action.includes('deactivated')) return 'warning';
    if (action.includes('rejected') || action.includes('deleted')) return 'danger';
    if (action.includes('approved')) return 'success';
    if (action.includes('assigned')) return 'purple';
    return 'default';
  };

  return (
    <AppLayout title="Audit Logs">
      <Card padding="none">
        {/* Filters */}
        <div className="p-4 border-b border-slate-200 flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <Select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            options={ACTION_OPTIONS}
            className="w-44"
          />
          <Select
            value={entityFilter}
            onChange={(e) => {
              setEntityFilter(e.target.value);
              setPage(1);
            }}
            options={ENTITY_OPTIONS}
            className="w-36"
          />
          <Button variant="secondary" onClick={() => fetchLogs()}>
            <Filter className="w-4 h-4 mr-2" />
            Apply
          </Button>
        </div>

        {/* Table */}
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Timestamp</TableHeader>
              <TableHeader>User</TableHeader>
              <TableHeader>Action</TableHeader>
              <TableHeader>Entity</TableHeader>
              <TableHeader>Entity ID</TableHeader>
              <TableHeader>IP Address</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableEmpty message="No audit logs found" />
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-slate-600">
                    {new Date(log.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="font-medium">{log.userName}</TableCell>
                  <TableCell>
                    <Badge variant={getActionVariant(log.action)}>
                      {formatAction(log.action)}
                    </Badge>
                  </TableCell>
                  <TableCell className="capitalize">{log.entityType}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {log.entityId ? log.entityId.substring(0, 8) + '...' : '-'}
                  </TableCell>
                  <TableCell className="text-slate-500">
                    {log.ipAddress || '-'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
          <p className="text-sm text-slate-600">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    </AppLayout>
  );
}
