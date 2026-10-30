'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Brain, AlertTriangle, ChevronRight, ExternalLink, Zap, RefreshCw, CheckCircle2 } from 'lucide-react';

interface RecommendedAction { action: string; priority: number; description: string; successRate: number | null }
interface AnalysisResultShape {
  denialCategory?: string; rootCause?: string; severity?: string; confidence?: string;
  historicalMatchCount?: number; historicalSuccessRate?: number; analyzedAt?: string;
}
interface Analysis {
  id: string; claimId: string; claimNumber: string | null; patientName: string | null; balance: string | null;
  denialCode: string | null; likelyReason: string | null;
  recommendedActions: Array<RecommendedAction | string> | null;
  recoveryPotential: string | null; priorityScore: number | null; confidenceScore: string | null;
  status: string; outcome: string | null; createdAt: string; analysisResult: AnalysisResultShape | null;
}

/** Older rows stored plain strings; normalize both shapes (the old UI assumed objects and rendered blanks). */
function normalizeActions(actions: Analysis['recommendedActions']): RecommendedAction[] {
  if (!Array.isArray(actions)) return [];
  return actions.map((a, i) => typeof a === 'string'
    ? { action: a, priority: i + 1, description: a, successRate: null }
    : { action: a.action, priority: a.priority ?? i + 1, description: a.description || a.action, successRate: a.successRate ?? null });
}

function PriorityBadge({ score }: { score: number | null }) {
  if (score === null || score === undefined) return null;
  const v = score >= 70 ? 'danger' : score >= 40 ? 'warning' : 'default';
  const l = score >= 70 ? 'High Priority' : score >= 40 ? 'Medium' : 'Low';
  return <Badge variant={v as 'danger' | 'warning' | 'default'}>{l} ({score})</Badge>;
}
function RecoveryBadge({ potential }: { potential: string | null }) {
  if (!potential) return null;
  const v = potential === 'high' ? 'success' : potential === 'medium' ? 'warning' : 'default';
  return <Badge variant={v as 'success' | 'warning' | 'default'}>Recovery: {potential}</Badge>;
}

const OUTCOME_OPTIONS: { value: string; label: string }[] = [
  { value: 'recovered', label: 'Recovered' }, { value: 'paid', label: 'Paid' },
  { value: 'partially_recovered', label: 'Partially recovered' }, { value: 'written_off', label: 'Written off' },
  { value: 'no_recovery', label: 'No recovery' },
];

export default function AiAnalysisPage() {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [savingOutcome, setSavingOutcome] = useState<string | null>(null);
  const router = useRouter();

  const fetchAnalyses = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/ai-analysis?limit=50');
      const d = await res.json().catch(() => ({}));
      if (res.ok) setAnalyses(d.analyses || []);
      else setError(d.error || 'Failed to load analyses. Please try again.');
    } catch { setError('Network error — could not load analyses. Check your connection and retry.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchAnalyses(); }, [fetchAnalyses]);

  const recordOutcome = async (id: string, outcome: string) => {
    setSavingOutcome(id);
    try {
      const res = await fetch('/api/ai-analysis', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ id, outcome }) });
      if (res.ok) setAnalyses(prev => prev.map(a => a.id === id ? { ...a, outcome, status: 'resolved' } : a));
      else { const d = await res.json().catch(() => ({})); alert(d.error || 'Failed to record outcome.'); }
    } catch { alert('Network error. Please try again.'); }
    finally { setSavingOutcome(null); }
  };

  const fmt = (n: string | null) => n ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parseFloat(n)) : '-';

  return (
    <AppLayout title="AI Denial Analysis">
      <div className="mb-6 flex items-center gap-3">
        <div className="p-3 bg-purple-100 rounded-xl"><Brain className="w-7 h-7 text-purple-600" /></div>
        <div><h2 className="text-lg font-semibold text-slate-900">AI-Powered Denial Analysis</h2><p className="text-sm text-slate-500">Rule-based analysis of denied claims with recommended actions, recovery potential and historical outcomes</p></div>
      </div>

      <p className="text-sm text-slate-600 mb-4 bg-blue-50 p-3 rounded-lg">💡 <strong>To analyze a claim:</strong> open a denied claim and click <strong>Analyze Denial</strong>. When you finish working one, record its outcome below — future analyses for the same denial code learn from it.</p>

      {error && (
        <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}</span>
          <Button size="sm" variant="secondary" onClick={fetchAnalyses}><RefreshCw className="w-3.5 h-3.5 mr-1" />Retry</Button>
        </div>
      )}

      {loading ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" /></div>
      : analyses.length === 0 && !error ? <Card><div className="text-center py-12"><Brain className="w-12 h-12 text-slate-300 mx-auto mb-3" /><p className="text-slate-500">No analyses yet. Open a denied claim and click “Analyze Denial” to see recommendations here.</p></div></Card>
      : <div className="space-y-4">
        {analyses.map(a => {
          const actions = normalizeActions(a.recommendedActions);
          const r = a.analysisResult;
          return (
          <Card key={a.id} className="hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <button className="text-blue-600 hover:underline font-semibold" onClick={() => router.push(`/claims/${a.claimId}`)}>{a.claimNumber || 'Claim'}</button>
                  <PriorityBadge score={a.priorityScore} />
                  <RecoveryBadge potential={a.recoveryPotential} />
                  {a.confidenceScore && <Badge variant="info" size="sm">AI Confidence: {parseFloat(a.confidenceScore)}%</Badge>}
                  {r?.denialCategory && <Badge variant="purple" size="sm">{r.denialCategory}</Badge>}
                  {a.status === 'resolved' && a.outcome && <Badge variant="success" size="sm"><CheckCircle2 className="w-3 h-3 mr-1" />Outcome: {a.outcome.replace(/_/g, ' ')}</Badge>}
                </div>
                <div className="flex gap-6 text-sm text-slate-600 mb-3 flex-wrap">
                  <span>Patient: <strong>{a.patientName || '-'}</strong></span>
                  <span>Balance: <strong>{fmt(a.balance)}</strong></span>
                  <span>Denial Code: <strong>{a.denialCode || '-'}</strong></span>
                  {r && r.historicalMatchCount !== undefined && r.historicalMatchCount > 0 && (
                    <span>Historical: <strong>{r.historicalSuccessRate}% recovered across {r.historicalMatchCount} similar denial(s)</strong></span>)}
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-3">
                  <p className="text-sm font-medium text-amber-900">📋 Likely Reason</p>
                  <p className="text-sm text-amber-800 mt-1">{a.likelyReason || '—'}</p>
                  {r?.rootCause && <><p className="text-sm font-medium text-amber-900 mt-2">🎯 Root Cause</p><p className="text-sm text-amber-800 mt-1">{r.rootCause}</p></>}
                </div>

                <button onClick={() => setExpanded(expanded === a.id ? null : a.id)} aria-expanded={expanded === a.id} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 mb-2">
                  <Zap className="w-4 h-4" />{expanded === a.id ? 'Hide' : 'Show'} Recommended Actions ({actions.length})
                  <ChevronRight className={`w-4 h-4 transition-transform ${expanded === a.id ? 'rotate-90' : ''}`} />
                </button>

                {expanded === a.id && (
                  <div className="space-y-2 ml-5">
                    {actions.length === 0 ? <p className="text-sm text-slate-500">No actions stored for this analysis — re-analyze the claim to regenerate them.</p> :
                    actions.map((action) => (
                      <div key={action.priority} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-slate-900">
                            <span className="inline-flex w-5 h-5 bg-blue-600 text-white rounded-full items-center justify-center text-xs mr-2">{action.priority}</span>
                            {action.action}
                          </span>
                          {action.successRate !== null && (
                            <Badge variant={action.successRate >= 60 ? 'success' : action.successRate >= 40 ? 'warning' : 'default'} size="sm">
                              {action.successRate}% historical success
                            </Badge>)}
                        </div>
                        {action.description !== action.action && <p className="text-sm text-slate-600 mt-1 ml-7">{action.description}</p>}
                      </div>
                    ))}
                  </div>
                )}

                {a.status !== 'resolved' && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500">Record outcome:</span>
                    {OUTCOME_OPTIONS.map(o => (
                      <button key={o.value} disabled={savingOutcome === a.id} onClick={() => recordOutcome(a.id, o.value)}
                        className="px-2.5 py-1 rounded-full border text-xs font-medium hover:bg-slate-100 disabled:opacity-50 transition-colors">{o.label}</button>
                    ))}
                  </div>
                )}
              </div>
              <Button variant="ghost" size="sm" aria-label="Open claim" onClick={() => router.push(`/claims/${a.claimId}`)}><ExternalLink className="w-4 h-4" /></Button>
            </div>
          </Card>);
        })}
      </div>}
    </AppLayout>
  );
}
