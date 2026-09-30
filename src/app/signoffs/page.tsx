'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select, Textarea } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ChevronLeft, ChevronRight, CheckCircle, XCircle, Clock, ExternalLink } from 'lucide-react';

interface Signoff {
  id: string;
  entityType: string;
  entityId: string;
  taskId: string | null;
  claimId: string | null;
  status: string;
  submitterName: string;
  submittedAt: string;
  submissionNotes: string | null;
  isAutomatic: boolean;
  reviewerName: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  entityTitle: string;
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

function SignoffStatusBadge({ status }: { status: string }) {
  const config: Record<string, { variant: 'default' | 'success' | 'warning' | 'danger'; label: string }> = {
    pending: { variant: 'warning', label: 'Pending' },
    approved: { variant: 'success', label: 'Approved' },
    rejected: { variant: 'danger', label: 'Rejected' },
  };
  const c = config[status] || { variant: 'default' as const, label: status };
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

export default function SignoffsPage() {
  const [signoffs, setSignoffs] = useState<Signoff[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedSignoff, setSelectedSignoff] = useState<Signoff | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [reviewNotes, setReviewNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState('');
  const router = useRouter();

  const fetchSignoffs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (status) params.set('status', status);

      const res = await fetch(`/api/signoffs?${params}`);
      const data = await res.json();
      if (res.ok) {
        setSignoffs(data.signoffs);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch signoffs:', error);
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    fetchSignoffs();
  }, [fetchSignoffs]);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => setCurrentUserRole(data.user?.role || ''))
      .catch(console.error);
  }, []);

  const handleReview = async () => {
    if (!selectedSignoff) return;
    setSubmitting(true);

    try {
      const res = await fetch(`/api/signoffs/${selectedSignoff.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: reviewAction,
          reviewNotes,
        }),
      });

      if (res.ok) {
        setShowReviewModal(false);
        setSelectedSignoff(null);
        setReviewNotes('');
        fetchSignoffs();
      }
    } catch (error) {
      console.error('Failed to review signoff:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const openReviewModal = (signoff: Signoff, action: 'approve' | 'reject') => {
    setSelectedSignoff(signoff);
    setReviewAction(action);
    setShowReviewModal(true);
  };

  const canReview = ['administrator', 'supervisor', 'manager', 'senior_lead', 'team_lead'].includes(currentUserRole);

  return (
    <AppLayout title="Sign-offs">
      <Card padding="none">
        {/* Filters */}
        <div className="p-4 border-b border-slate-200 flex flex-wrap gap-4">
          <Select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            options={STATUS_OPTIONS}
            className="w-40"
          />
        </div>

        {/* List */}
        <div className="divide-y divide-slate-200">
          {loading ? (
            <div className="p-8 text-center">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : signoffs.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Clock className="w-12 h-12 text-slate-300 mx-auto mb-2" />
              <p>No sign-offs found</p>
            </div>
          ) : (
            signoffs.map((signoff) => (
              <div key={signoff.id} className="p-4 hover:bg-slate-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <SignoffStatusBadge status={signoff.status} />
                      <Badge variant="default">{signoff.entityType}</Badge>
                      {signoff.isAutomatic && <Badge variant="info" size="sm">Auto</Badge>}
                    </div>
                    <h3 className="font-medium text-slate-900">{signoff.entityTitle}</h3>
                    <p className="text-sm text-slate-600 mt-1">
                      Submitted by {signoff.submitterName} on {new Date(signoff.submittedAt).toLocaleString()}
                    </p>
                    {signoff.submissionNotes && (
                      <p className="text-sm text-slate-500 mt-2 italic">"{signoff.submissionNotes}"</p>
                    )}
                    {signoff.status !== 'pending' && signoff.reviewerName && (
                      <p className="text-sm text-slate-500 mt-2">
                        Reviewed by {signoff.reviewerName} on {signoff.reviewedAt && new Date(signoff.reviewedAt).toLocaleString()}
                        {signoff.reviewNotes && ` - "${signoff.reviewNotes}"`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {signoff.taskId && (
                      <Button variant="ghost" size="sm" onClick={() => router.push(`/tasks/${signoff.taskId}`)}>
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    )}
                    {signoff.claimId && (
                      <Button variant="ghost" size="sm" onClick={() => router.push(`/claims/${signoff.claimId}`)}>
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    )}
                    {canReview && signoff.status === 'pending' && (
                      <>
                        <button
                          onClick={() => openReviewModal(signoff, 'approve')}
                          className="p-2 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                          title="Approve"
                        >
                          <CheckCircle className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => openReviewModal(signoff, 'reject')}
                          className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                          title="Reject"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

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

      {/* Review Modal */}
      <Modal isOpen={showReviewModal} onClose={() => setShowReviewModal(false)} title={`${reviewAction === 'approve' ? 'Approve' : 'Reject'} Sign-off`}>
        {selectedSignoff && (
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-500">Sign-off for</p>
              <p className="font-semibold text-slate-900">{selectedSignoff.entityTitle}</p>
              <p className="text-sm text-slate-600 mt-1">Submitted by {selectedSignoff.submitterName}</p>
            </div>

            <div className={`p-4 rounded-lg ${reviewAction === 'approve' ? 'bg-emerald-50' : 'bg-red-50'}`}>
              <p className="font-medium mb-2">
                {reviewAction === 'approve' ? '✓ Approve this sign-off' : '✕ Reject this sign-off'}
              </p>
              <p className="text-sm text-slate-600">
                {reviewAction === 'approve' 
                  ? 'The work will be marked as signed off and completed.'
                  : 'The work will be sent back for revision.'}
              </p>
            </div>

            <Textarea
              label="Review Notes"
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder={reviewAction === 'approve' ? 'Optional notes...' : 'Please provide feedback...'}
              rows={4}
            />

            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowReviewModal(false)}>Cancel</Button>
              <Button
                onClick={handleReview}
                loading={submitting}
                className={reviewAction === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}
              >
                {reviewAction === 'approve' ? 'Approve' : 'Reject'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </AppLayout>
  );
}
