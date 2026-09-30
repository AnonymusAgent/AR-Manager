'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select, Textarea } from '@/components/ui/Input';
import {
  X, Minus, Paperclip, ArrowRight, Send, Upload, FileText, Clock, User,
  ChevronDown, CheckCircle, XCircle, RotateCcw, Brain, AlertTriangle,
} from 'lucide-react';
import { DenialCodeSearch } from '@/components/ui/DenialCodeSearch';
import { MedicalInlineLoader } from '@/components/ui/MedicalLoader';

interface ClaimDetail {
  id: string; claimNumber: string; accountNumber: string | null; patientName: string | null;
  dateOfService: string | null; cptCodes: string | null; provider: string | null;
  insurance: string | null; payer: string | null; billedAmount: string | null;
  paidAmount: string | null; balance: string | null; status: string; priority: string | null;
  reviewComments: string | null; denialReason: string | null;
  workflowStatus: string | null; claimInsuranceStatus: string | null;
  subStatus: string | null; reworkReason: string | null; reworkCount: number | null;
  workedBy: string | null; workedDate: string | null;
  assignee: { id: string; firstName: string; lastName: string; email: string } | null;
  reviewer: { id: string; firstName: string; lastName: string; email: string } | null;
  denialCode: { code: string; description: string } | null;
  createdAt: string; updatedAt: string;
}
interface Note { id: string; note: string; actionPerformed: string | null; userName: string; createdAt: string; }
interface StatusHistoryItem { id: string; previousStatus: string | null; newStatus: string; reason: string | null; userName: string; createdAt: string; }
interface DocItem { id: string; documentType: string; fileName: string; mimeType: string; createdAt: string; }
interface CurrentUser { id: string; role: string; firstName: string; lastName: string; }

const CLAIM_STATUSES = [
  { value: '', label: '– Select Status –' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'pending', label: 'Pending' },
  { value: 'submitted_for_review', label: 'Submit for Review' },
  { value: 'paid', label: 'Paid' },
  { value: 'denied', label: 'Denied' },
  { value: 'closed', label: 'Closed' },
];

const SUB_STATUSES = [
  { value: '', label: '– Select Sub-Status –' },
  { value: 'call_payer', label: 'Called Payer' },
  { value: 'appeal_filed', label: 'Appeal Filed' },
  { value: 'records_requested', label: 'Medical Records Requested' },
  { value: 'corrected_claim', label: 'Corrected Claim Submitted' },
  { value: 'patient_contacted', label: 'Patient Contacted' },
  { value: 'cob_updated', label: 'COB Updated' },
  { value: 'auth_obtained', label: 'Authorization Obtained' },
  { value: 'pending_eob', label: 'Pending EOB' },
  { value: 'follow_up', label: 'Follow Up Required' },
];

function getAging(dateStr: string | null): { days: number; bucket: string } {
  if (!dateStr) return { days: 0, bucket: '0–30' };
  const d = new Date(dateStr);
  const now = new Date();
  const days = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  const bucket = days > 180 ? '180+' : days > 120 ? '120–180' : days > 90 ? '90–120' : days > 60 ? '60–90' : days > 30 ? '30–60' : '0–30';
  return { days, bucket };
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return d; }
}

function fmt(v: string | null) { return v ? `$${parseFloat(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'; }

function statusLabel(s: string) {
  const map: Record<string, string> = {
    new: 'Unworked', assigned: 'Unworked', in_progress: 'In Progress', pending: 'Pending',
    submitted_for_review: 'Under Review', approved: 'Approved', rework_required: 'Rework',
    paid: 'Paid', denied: 'Denied', closed: 'Closed', sent_to_coding: 'Coding',
    coding_review: 'Coding Review', coding_corrected: 'Corrected', returned_to_billing: 'Returned',
    resubmitted: 'Resubmitted',
  };
  return map[s] || s;
}

function isWorked(s: string) {
  return ['approved', 'paid', 'closed', 'coding_corrected', 'resubmitted'].includes(s);
}

export default function ClaimDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [claim, setClaim] = useState<ClaimDetail | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryItem[]>([]);
  const [documents, setDocuments] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  // Work form state
  const [claimStatus, setClaimStatus] = useState('');
  const [subStatus, setSubStatus] = useState('');
  const [remarks, setRemarks] = useState('');
  const [selectedDenialCode, setSelectedDenialCode] = useState<{ id: number; code: string; codeType: string; description: string; category: string | null } | null>(null);
  const [denialReasonText, setDenialReasonText] = useState('');

  // Modals
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState('eob');
  const [showReview, setShowReview] = useState(false);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | 'rework'>('approve');
  const [reviewComments, setReviewComments] = useState('');
  const [showCoding, setShowCoding] = useState(false);
  const [codingReason, setCodingReason] = useState('');

  // Activity tab
  const [activeInfoTab, setActiveInfoTab] = useState<'notes' | 'history' | 'documents'>('notes');

  const router = useRouter();

  const fetchClaim = useCallback(async () => {
    try {
      const res = await fetch(`/api/claims/${id}`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setClaim(data.claim); setNotes(data.notes); setStatusHistory(data.statusHistory); setDocuments(data.documents);
        // Load existing denial code if claim has one
        if (data.claim.denialCode) {
          setSelectedDenialCode(data.claim.denialCode);
          setDenialReasonText(data.claim.denialReason || data.claim.denialCode.description || '');
        } else if (data.claim.denialReason) {
          setDenialReasonText(data.claim.denialReason);
        }
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => {
    fetchClaim();
    fetch('/api/auth/me', { credentials: 'include' }).then(r => r.json()).then(d => setCurrentUser(d.user)).catch(console.error);
  }, [fetchClaim]);

  const callWorkflow = async (action: string, extra?: Record<string, unknown>) => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { action, remarks, ...extra };
      if (claimStatus) body.claimInsuranceStatus = claimStatus;
      if (subStatus) body.subStatus = SUB_STATUSES.find(s => s.value === subStatus)?.label;
      // Include denial code data
      if (selectedDenialCode) body.denialCodeId = selectedDenialCode.id;
      if (denialReasonText) body.denialReason = denialReasonText;
      const res = await fetch(`/api/claims/${id}/workflow`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); alert(d.error || 'Action failed'); return; }
      setClaimStatus(''); setSubStatus(''); setRemarks('');
      fetchClaim();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleSubmitWork = async () => {
    if (!confirm('Are you sure you want to submit this claim for supervisor approval?')) return;
    await callWorkflow('submit_for_approval');
  };

  const handleSubmitForReview = handleSubmitWork;

  const handleStartWorking = async () => {
    await callWorkflow('start_working');
  };

  const handleMarkDead = async () => {
    if (!confirm('Are you sure you want to mark this claim as dead/unworkable?')) return;
    await callWorkflow('mark_dead');
  };

  const handleUpload = async () => {
    if (!uploadFile) return; setSaving(true);
    try {
      const fd = new FormData(); fd.append('file', uploadFile); fd.append('documentType', uploadType);
      await fetch(`/api/claims/${id}/documents`, { method: 'POST', body: fd, credentials: 'include' });
      setShowUpload(false); setUploadFile(null); fetchClaim();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleReview = async () => {
    if (reviewAction === 'approve') {
      if (!confirm('Are you sure you want to approve this claim?')) return;
      await callWorkflow('approve');
    } else if (reviewAction === 'rework') {
      if (!reviewComments.trim()) { alert('Rework reason is mandatory'); return; }
      await callWorkflow('send_back_rework', { reworkReason: reviewComments });
    } else {
      await callWorkflow('send_back_rework', { reworkReason: reviewComments || 'Rejected by supervisor' });
    }
    setShowReview(false); setReviewComments('');
  };

  const handleSendToCoding = async () => {
    setSaving(true);
    try {
      await fetch('/api/coding', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ claimId: id, denialReason: codingReason }),
      });
      setShowCoding(false); setCodingReason(''); fetchClaim();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  // AI Analysis state
  const [analysisResult, setAnalysisResult] = useState<Record<string, string | string[] | number | boolean | null> | null>(null);
  const [analysisError, setAnalysisError] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  const handleAnalyze = async () => {
    setAnalyzing(true); setAnalysisError(''); setAnalysisResult(null);
    try {
      const res = await fetch('/api/ai-analysis', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ claimId: id }),
      });
      const data = await res.json();
      if (res.ok && data.analysis) {
        setAnalysisResult(data.analysis as Record<string, string | string[] | number | boolean | null>);
      } else {
        setAnalysisError(data.error || 'Analysis failed. Please try again.');
      }
    } catch (e) { setAnalysisError('Network error. Please check your connection and try again.'); }
    finally { setAnalyzing(false); }
  };

  // Load existing analysis on mount — only for denied claims
  useEffect(() => {
    if (!claim) return;
    const claimIsDenied = claim.status === 'denied' || claim.claimInsuranceStatus === 'denied' || !!claim.denialReason;
    if (claimIsDenied) {
      fetch(`/api/ai-analysis?claimId=${id}&limit=1`, { credentials: 'include' })
        .then(r => r.json())
        .then(d => { if (d.analyses?.length > 0 && d.analyses[0].analysisResult) setAnalysisResult(d.analyses[0].analysisResult as Record<string, string | string[] | number | boolean | null>); })
        .catch(() => {});
    }
  }, [claim, id]);

  if (loading) {
    return (
      <AppLayout title="Claim"><MedicalInlineLoader message="Loading claim details..." /></AppLayout>
    );
  }

  if (!claim) {
    return (
      <AppLayout title="Claim"><div className="flex flex-col items-center py-20">
        <p className="text-[#64748B] mb-4">Claim not found</p>
        <button onClick={() => router.back()} className="text-[#2563EB] hover:underline text-sm">← Go back</button>
      </div></AppLayout>
    );
  }

  const aging = getAging(claim.createdAt);
  const canReview = currentUser && ['administrator', 'supervisor', 'manager', 'senior_lead', 'team_lead'].includes(currentUser.role);
  const canWork = claim.assignee?.id === currentUser?.id || canReview;
  const worked = isWorked(claim.status);
  const isDenied = claim.status === 'denied' || claim.claimInsuranceStatus === 'denied' || claim.claimInsuranceStatus === 'rejected' || !!claim.denialReason;
  const genClaimNum = claim.claimNumber || `${(claim.patientName || 'UNK').replace(/\s/g, '-')}-${claim.dateOfService || 'NODATE'}`;

  return (
    <AppLayout title={`Claim: ${claim.claimNumber}`}>
      <div className="max-w-[960px] mx-auto">
        {/* ============ MODAL-STYLE CARD ============ */}
        <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] overflow-hidden">

          {/* ---- Header ---- */}
          <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-bold text-slate-900">Claim: {claim.claimNumber}</h1>
                <span className={`inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-semibold ${worked ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-[#2563EB]'}`}>
                  {worked ? 'Worked' : 'Unworked'}
                </span>
                <Minus className="w-4 h-4 text-[#64748B]" />
              </div>
              <p className="text-[13px] text-[#64748B] mt-1.5">
                Assigned: <span className="text-slate-700 font-medium">{claim.assignee ? `${claim.assignee.firstName} ${claim.assignee.lastName}` : '—'}</span>
                <span className="mx-2">•</span>
                Worked by: <span className="text-slate-700 font-medium">{claim.reviewer ? `${claim.reviewer.firstName} ${claim.reviewer.lastName}` : '—'}</span>
                <span className="mx-2">•</span>
                TL: <span className="text-slate-700 font-medium">{canReview && currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : '—'}</span>
              </p>
            </div>
            <button onClick={() => router.back()} className="p-1.5 rounded-md hover:bg-[#F5F7FA] text-[#64748B] hover:text-slate-900 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ---- Claim Information Grid ---- */}
          <div className="px-6 py-5">
            <div className="grid grid-cols-2 gap-x-12 gap-y-0">
              {/* Row 1 */}
              <div className="flex justify-between py-3 border-b border-[#F1F5F9]">
                <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Practice</span>
                <span className="text-sm font-semibold text-slate-900">{claim.provider || '—'}</span>
              </div>
              <div className="flex justify-between py-3 border-b border-[#F1F5F9]">
                <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Patient</span>
                <span className="text-sm font-semibold text-slate-900 uppercase">{claim.patientName || '—'}</span>
              </div>
              {/* Row 2 */}
              <div className="flex justify-between py-3 border-b border-[#F1F5F9]">
                <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Chart Number</span>
                <span className="text-sm font-semibold text-slate-900">{claim.accountNumber || claim.claimNumber}</span>
              </div>
              <div className="flex justify-between py-3 border-b border-[#F1F5F9]">
                <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Date of Service</span>
                <span className="text-sm font-semibold text-slate-900">{fmtDate(claim.dateOfService)}</span>
              </div>
              {/* Row 3 */}
              <div className="flex justify-between py-3 border-b border-[#F1F5F9]">
                <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Payer</span>
                <span className="text-sm font-semibold text-slate-900 uppercase">{claim.insurance || '—'}</span>
              </div>
              <div className="flex justify-between py-3 border-b border-[#F1F5F9]">
                <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Policy Number</span>
                <span className="text-sm font-semibold text-slate-900">{claim.accountNumber || '—'}</span>
              </div>
              {/* Row 4 */}
              <div className="flex justify-between py-3 border-b border-[#F1F5F9]">
                <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Charge Amount</span>
                <span className="text-sm font-bold text-slate-900">{fmt(claim.billedAmount)}</span>
              </div>
              <div className="flex justify-between py-3 border-b border-[#F1F5F9]">
                <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Total Balance</span>
                <span className="text-sm font-bold text-slate-900">{fmt(claim.balance)}</span>
              </div>
              {/* Row 5 */}
              <div className="flex justify-between py-3">
                <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Aging</span>
                <div className="text-right">
                  <span className={`text-sm font-bold ${aging.days > 90 ? 'text-[#DC2626]' : 'text-[#16A34A]'}`}>{aging.days}d</span>
                  <span className="text-[11px] text-[#64748B] ml-1.5">{aging.bucket}</span>
                </div>
              </div>
              <div className="flex justify-between py-3">
                <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Claim Number</span>
                <span className="text-sm font-semibold text-slate-900">{genClaimNum}</span>
              </div>
            </div>
          </div>

          {/* ---- REWORK REASON BANNER ---- */}
          {claim.reworkReason && claim.workflowStatus === 'rework' && (
            <div className="px-6 py-4 border-t border-red-200 bg-red-50">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-[#DC2626] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-red-900">Returned for Rework by Supervisor</p>
                  <p className="text-sm text-red-800 mt-1">{claim.reworkReason}</p>
                  <p className="text-[11px] text-red-600 mt-1">Rework #{claim.reworkCount || 1} — please address the issues and resubmit.</p>
                </div>
              </div>
            </div>
          )}

          {/* ---- START WORKING BUTTON (for unworked claims) ---- */}
          {claim.workflowStatus === 'unworked' && canWork && (
            <div className="px-6 py-4 border-t border-[#E5E7EB] bg-[#FAFBFC]">
              <Button onClick={handleStartWorking} loading={saving} className="w-full">
                <CheckCircle className="w-4 h-4 mr-2" />Start Working on This Claim
              </Button>
            </div>
          )}

          {/* ---- WORK THIS CLAIM (only when working or rework) ---- */}
          {canWork && (claim.workflowStatus === 'working' || claim.workflowStatus === 'rework') && (
            <div className="px-6 py-5 border-t border-[#E5E7EB] bg-[#FAFBFC]">
              <h3 className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-4">Work This Claim</h3>

              {/* Dropdowns side by side */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="relative">
                  <label className="block text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">Claim Status *</label>
                  <div className="relative">
                    <select value={claimStatus} onChange={e => setClaimStatus(e.target.value)}
                      className="w-full appearance-none px-3.5 py-2.5 pr-10 rounded-lg border border-[#E5E7EB] bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]">
                      {CLAIM_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B] pointer-events-none" />
                  </div>
                </div>
                <div className="relative">
                  <label className="block text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">Sub-Status</label>
                  <div className="relative">
                    <select value={subStatus} onChange={e => setSubStatus(e.target.value)}
                      className="w-full appearance-none px-3.5 py-2.5 pr-10 rounded-lg border border-[#E5E7EB] bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]">
                      {SUB_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B] pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Denial Code Section — shown when status is Denied */}
              {claimStatus === 'denied' && (
                <div className="mb-4 p-4 bg-red-50/50 border border-red-100 rounded-lg">
                  <DenialCodeSearch
                    selectedCode={selectedDenialCode}
                    onSelect={setSelectedDenialCode}
                    onReasonChange={setDenialReasonText}
                    initialReason={denialReasonText}
                  />
                </div>
              )}

              {/* Remarks */}
              <div className="mb-4">
                <label className="block text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">Remarks</label>
                <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={3}
                  placeholder="Add any note for this claim..."
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] bg-white text-sm text-slate-900 placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] resize-none" />
              </div>

              {/* Action Bar */}
              <div className="flex items-center justify-between pt-2">
                {/* Left: Attach */}
                <button onClick={() => setShowUpload(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#E5E7EB] bg-white text-sm text-[#64748B] hover:bg-[#F5F7FA] hover:text-slate-900 transition-colors">
                  <Paperclip className="w-4 h-4" />Attach
                </button>

                {/* Right: Action buttons */}
                <div className="flex items-center gap-2.5">
                  <button onClick={() => router.back()}
                    className="px-4 py-2 rounded-lg border border-[#E5E7EB] bg-white text-sm text-[#64748B] hover:bg-[#F5F7FA] transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleMarkDead}
                    className="px-4 py-2 rounded-lg border border-[#DC2626] bg-white text-sm text-[#DC2626] hover:bg-red-50 transition-colors font-medium">
                    Mark as Dead
                  </button>

                  <button onClick={handleSubmitWork} disabled={saving}
                    className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#1d4ed8] transition-colors shadow-sm disabled:opacity-50">
                    {saving ? 'Submitting...' : 'Submit for Approval'} <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ---- AI DENIAL ANALYSIS RESULTS (inline) ---- */}
          {isDenied && (
            <div className="px-6 py-5 border-t border-[#E5E7EB]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-purple-600" />
                  <h3 className="text-[13px] font-bold text-slate-900 uppercase tracking-wider">AI Denial Analysis</h3>
                </div>
                <button onClick={handleAnalyze} disabled={analyzing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 transition-colors disabled:opacity-50">
                  {analyzing ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />Analyzing...</> : <><Brain className="w-3.5 h-3.5" />{analysisResult ? 'Re-analyze' : 'Analyze Denial'}</>}
                </button>
              </div>

              {analysisError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 mb-3">
                  <AlertTriangle className="w-4 h-4 inline mr-1.5" />{analysisError}
                </div>
              )}

              {analysisResult !== null && (
                <div className="space-y-3">
                  {/* Severity + Confidence */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      analysisResult.severity === 'Critical' ? 'bg-red-100 text-red-700' :
                      analysisResult.severity === 'High' ? 'bg-red-50 text-red-600' :
                      analysisResult.severity === 'Medium' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'
                    }`}>Severity: {String(analysisResult.severity)}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      analysisResult.confidence === 'High' ? 'bg-emerald-50 text-emerald-700' :
                      analysisResult.confidence === 'Medium' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'
                    }`}>AI Confidence: {String(analysisResult.confidence)}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      analysisResult.recoveryPotential === 'high' ? 'bg-emerald-50 text-emerald-700' :
                      analysisResult.recoveryPotential === 'medium' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'
                    }`}>Recovery: {String(analysisResult.recoveryPotential)}</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700">{String(analysisResult.denialCategory)}</span>
                  </div>

                  {/* Denial Reason */}
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-[11px] font-bold text-red-700 uppercase mb-1">🔴 Denial Reason</p>
                    <p className="text-sm text-red-900">{String(analysisResult.denialReason)}</p>
                  </div>

                  {/* Root Cause */}
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-[11px] font-bold text-amber-700 uppercase mb-1">🎯 Root Cause</p>
                    <p className="text-sm text-amber-900">{String(analysisResult.rootCause)}</p>
                  </div>

                  {/* Recommended Action */}
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-[11px] font-bold text-blue-700 uppercase mb-1">✅ Recommended Action</p>
                    <p className="text-sm text-blue-900">{String(analysisResult.recommendedAction)}</p>
                  </div>

                  {/* Next Steps */}
                  {(() => {
                    const steps = (analysisResult.nextSteps || []) as string[];
                    if (!steps.length) return null;
                    return (
                    <div className="p-3 bg-[#F5F7FA] border border-[#E5E7EB] rounded-lg">
                      <p className="text-[11px] font-bold text-[#64748B] uppercase mb-2">📋 Next Steps</p>
                      <ol className="space-y-1.5">
                        {steps.map((step: string, i: number) => (
                          <li key={i} className="flex gap-2 text-sm text-slate-700">
                            <span className="w-5 h-5 rounded-full bg-[#2563EB] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                            {String(step)}
                          </li>
                        ))}
                      </ol>
                    </div>);
                  })()}

                  {/* Required Information */}
                  {(analysisResult.requiredInformation as unknown as string[] | undefined)?.length ? (
                    <div className="p-3 bg-[#F5F7FA] border border-[#E5E7EB] rounded-lg">
                      <p className="text-[11px] font-bold text-[#64748B] uppercase mb-2">📄 Required Information</p>
                      <ul className="space-y-1">
                        {((analysisResult.requiredInformation || []) as string[]).map((info: string, i: number) => (
                          <li key={i} className="text-sm text-slate-700 flex items-center gap-1.5">
<span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />{String(info)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {/* Additional Recommendations */}
                  <div className="grid grid-cols-2 gap-3">
                    {!!analysisResult.resubmitRecommendation && (
                      <div className="p-2.5 bg-[#F5F7FA] rounded-lg"><p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">🔄 Resubmission</p><p className="text-[12px] text-slate-700">{String(analysisResult.resubmitRecommendation)}</p></div>
                    )}
                    {!!analysisResult.payerFollowUp && (
                      <div className="p-2.5 bg-[#F5F7FA] rounded-lg"><p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">📞 Payer Follow-Up</p><p className="text-[12px] text-slate-700">{String(analysisResult.payerFollowUp)}</p></div>
                    )}
                  </div>

                  {/* Disclaimer */}
                  <p className="text-[10px] text-[#94A3B8] italic mt-2">
                    {String(analysisResult.disclaimer || 'AI-generated analysis. Verify recommendations against payer policies before acting.')}
                  </p>
                  {analysisResult.analyzedAt && (
                    <p className="text-[10px] text-[#94A3B8]">Last analyzed: {new Date(String(analysisResult.analyzedAt)).toLocaleString()}</p>
                  )}
                </div>
              )}

              {!analysisResult && !analysisError && !analyzing && (
                <p className="text-sm text-[#64748B] text-center py-4">Click "Analyze Denial" to get AI-powered recommendations for this denied claim.</p>
              )}
            </div>
          )}

          {/* ---- Quick Actions for Supervisors/Denied ---- */}
          {(canReview || isDenied) && (
            <div className="px-6 py-3 border-t border-[#E5E7EB] bg-[#F8FAFC] flex items-center gap-2 flex-wrap">
              {canReview && claim.workflowStatus === 'pending_approval' && (
                <>
                  <button onClick={() => { setReviewAction('approve'); setShowReview(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100 transition-colors">
                    <CheckCircle className="w-3.5 h-3.5" />Approve
                  </button>
                  <button onClick={() => { setReviewAction('rework'); setShowReview(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-50 text-amber-700 text-xs font-medium hover:bg-amber-100 transition-colors">
                    <RotateCcw className="w-3.5 h-3.5" />Rework
                  </button>
                  <button onClick={() => { setReviewAction('reject'); setShowReview(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-50 text-red-700 text-xs font-medium hover:bg-red-100 transition-colors">
                    <XCircle className="w-3.5 h-3.5" />Reject
                  </button>
                </>
              )}
              {claim.status === 'denied' && (
                <>
                  <button onClick={() => setShowCoding(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-purple-50 text-purple-700 text-xs font-medium hover:bg-purple-100 transition-colors">
                    <Send className="w-3.5 h-3.5" />Send to Coding
                  </button>
                  <button onClick={handleAnalyze} disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-50 text-blue-700 text-xs font-medium hover:bg-blue-100 transition-colors disabled:opacity-50">
                    <Brain className="w-3.5 h-3.5" />AI Analyze
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* ============ ACTIVITY TABS ============ */}
        <div className="mt-5 bg-white rounded-xl shadow-sm border border-[#E5E7EB] overflow-hidden">
          <div className="flex border-b border-[#E5E7EB]">
            {(['notes', 'history', 'documents'] as const).map(t => (
              <button key={t} onClick={() => setActiveInfoTab(t)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeInfoTab === t ? 'border-[#2563EB] text-[#2563EB]' : 'border-transparent text-[#64748B] hover:text-slate-900'
                }`}>
                {t === 'notes' ? `Notes (${notes.length})` : t === 'history' ? `History (${statusHistory.length})` : `Documents (${documents.length})`}
              </button>
            ))}
          </div>

          <div className="p-5 max-h-[400px] overflow-y-auto">
            {activeInfoTab === 'notes' && (
              notes.length === 0 ? <p className="text-sm text-[#64748B] text-center py-6">No notes yet</p>
              : <div className="space-y-3">
                {notes.map(n => (
                  <div key={n.id} className="p-3 bg-[#F8FAFC] rounded-lg border border-[#F1F5F9]">
                    <div className="flex items-center gap-2 mb-1">
                      <User className="w-3.5 h-3.5 text-[#64748B]" />
                      <span className="text-sm font-medium text-slate-900">{n.userName}</span>
                      <span className="text-[11px] text-[#64748B]">{new Date(n.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-slate-700 ml-5">{n.note}</p>
                    {n.actionPerformed && <span className="ml-5 mt-1 inline-block text-[11px] px-2 py-0.5 bg-blue-50 text-[#2563EB] rounded-full font-medium">{n.actionPerformed}</span>}
                  </div>
                ))}
              </div>
            )}

            {activeInfoTab === 'history' && (
              statusHistory.length === 0 ? <p className="text-sm text-[#64748B] text-center py-6">No history</p>
              : <div className="space-y-3">
                {statusHistory.map(h => (
                  <div key={h.id} className="flex items-start gap-3">
                    <Clock className="w-4 h-4 text-[#64748B] mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        {h.previousStatus && <><span className="text-xs px-2 py-0.5 bg-gray-100 text-[#64748B] rounded-full">{statusLabel(h.previousStatus)}</span><span className="text-[#64748B]">→</span></>}
                        <span className="text-xs px-2 py-0.5 bg-blue-50 text-[#2563EB] rounded-full font-medium">{statusLabel(h.newStatus)}</span>
                      </div>
                      <p className="text-[12px] text-[#64748B] mt-1">{h.userName} • {new Date(h.createdAt).toLocaleString()}</p>
                      {h.reason && <p className="text-sm text-slate-600 mt-0.5">{h.reason}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeInfoTab === 'documents' && (
              documents.length === 0 ? <p className="text-sm text-[#64748B] text-center py-6">No documents</p>
              : <div className="space-y-2">
                {documents.map(d => (
                  <div key={d.id} className="flex items-center gap-3 p-3 bg-[#F8FAFC] rounded-lg">
                    <FileText className="w-4 h-4 text-[#64748B]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{d.fileName}</p>
                      <p className="text-[11px] text-[#64748B]">{d.documentType.toUpperCase()} • {new Date(d.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============ MODALS ============ */}

      {/* Upload */}
      <Modal isOpen={showUpload} onClose={() => setShowUpload(false)} title="Attach Document">
        <div className="space-y-4">
          <Select label="Document Type" value={uploadType} onChange={e => setUploadType(e.target.value)} options={[
            { value: 'eob', label: 'EOB' }, { value: 'denial', label: 'Denial Letter' },
            { value: 'appeal', label: 'Appeal' }, { value: 'other', label: 'Other' },
          ]} />
          <div>
            <label className="block text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">File</label>
            <input type="file" onChange={e => setUploadFile(e.target.files?.[0] || null)}
              className="w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-[#2563EB] file:font-medium file:text-sm hover:file:bg-blue-100" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowUpload(false)}>Cancel</Button>
            <Button onClick={handleUpload} loading={saving} disabled={!uploadFile}>Upload</Button>
          </div>
        </div>
      </Modal>

      {/* Review */}
      <Modal isOpen={showReview} onClose={() => setShowReview(false)} title={`${reviewAction.charAt(0).toUpperCase() + reviewAction.slice(1)} Claim`}>
        <div className="space-y-4">
          <div className={`p-3 rounded-lg ${reviewAction === 'approve' ? 'bg-emerald-50' : reviewAction === 'rework' ? 'bg-amber-50' : 'bg-red-50'}`}>
            <p className="text-sm font-medium">{reviewAction === 'approve' ? '✓ Approve this claim' : reviewAction === 'rework' ? '↻ Request rework' : '✕ Reject this claim'}</p>
          </div>
          <Textarea label="Comments" value={reviewComments} onChange={e => setReviewComments(e.target.value)} placeholder="Add review comments..." rows={3} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowReview(false)}>Cancel</Button>
            <Button onClick={handleReview} loading={saving}>{reviewAction.charAt(0).toUpperCase() + reviewAction.slice(1)}</Button>
          </div>
        </div>
      </Modal>

      {/* Send to Coding */}
      <Modal isOpen={showCoding} onClose={() => setShowCoding(false)} title="Send to Coding Team">
        <div className="space-y-4">
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">All existing documents will be auto-attached.</div>
          <Textarea label="Denial Reason" value={codingReason} onChange={e => setCodingReason(e.target.value)} placeholder="Describe the coding issue..." rows={3} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowCoding(false)}>Cancel</Button>
            <Button onClick={handleSendToCoding} loading={saving}>Send to Coding</Button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
}
