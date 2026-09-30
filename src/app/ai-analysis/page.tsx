'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Brain, TrendingUp, AlertTriangle, ChevronRight, ExternalLink, Zap } from 'lucide-react';

interface Analysis { id: string; claimId: string; claimNumber: string | null; patientName: string | null; balance: string | null; denialCode: string | null; likelyReason: string | null; recommendedActions: Array<{ action: string; priority: number; description: string; successRate: number }> | null; recoveryPotential: string | null; priorityScore: number | null; confidenceScore: string | null; status: string; outcome: string | null; createdAt: string; }

function PriorityBadge({ score }: { score: number | null }) {
  if (!score) return null;
  const v = score >= 70 ? 'danger' : score >= 40 ? 'warning' : 'default';
  const l = score >= 70 ? 'High Priority' : score >= 40 ? 'Medium' : 'Low';
  return <Badge variant={v as 'danger' | 'warning' | 'default'}>{l} ({score})</Badge>;
}

function RecoveryBadge({ potential }: { potential: string | null }) {
  if (!potential) return null;
  const v = potential === 'high' ? 'success' : potential === 'medium' ? 'warning' : 'default';
  return <Badge variant={v as 'success' | 'warning' | 'default'}>Recovery: {potential}</Badge>;
}

export default function AiAnalysisPage() {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const router = useRouter();

  const fetchAnalyses = useCallback(async () => {
    setLoading(true);
    try { const res = await fetch('/api/ai-analysis?limit=50'); const d = await res.json(); if (res.ok) setAnalyses(d.analyses); } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAnalyses(); }, [fetchAnalyses]);

  const fmt = (n: string | null) => n ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parseFloat(n)) : '-';

  return (
    <AppLayout title="AI Denial Analysis">
      <div className="mb-6 flex items-center gap-3">
        <div className="p-3 bg-purple-100 rounded-xl"><Brain className="w-7 h-7 text-purple-600" /></div>
        <div><h2 className="text-lg font-semibold text-slate-900">AI-Powered Denial Analysis</h2><p className="text-sm text-slate-500">Intelligent analysis of denied claims with recommended actions and recovery potential</p></div>
      </div>

      <p className="text-sm text-slate-600 mb-4 bg-blue-50 p-3 rounded-lg">💡 <strong>To analyze a claim:</strong> Open any denied claim → the system will automatically analyze it. Or use the Claims page to find denied claims.</p>

      {loading ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" /></div>
      : analyses.length === 0 ? <Card><div className="text-center py-12"><Brain className="w-12 h-12 text-slate-300 mx-auto mb-3" /><p className="text-slate-500">No analyses yet. Analyze denied claims to see AI recommendations here.</p></div></Card>
      : <div className="space-y-4">
        {analyses.map(a => (
          <Card key={a.id} className="hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <button className="text-blue-600 hover:underline font-semibold" onClick={() => router.push(`/claims/${a.claimId}`)}>{a.claimNumber || 'Claim'}</button>
                  <PriorityBadge score={a.priorityScore} />
                  <RecoveryBadge potential={a.recoveryPotential} />
                  {a.confidenceScore && <Badge variant="info" size="sm">AI Confidence: {parseFloat(a.confidenceScore)}%</Badge>}
                </div>
                <div className="flex gap-6 text-sm text-slate-600 mb-3">
                  <span>Patient: <strong>{a.patientName || '-'}</strong></span>
                  <span>Balance: <strong>{fmt(a.balance)}</strong></span>
                  <span>Denial Code: <strong>{a.denialCode || '-'}</strong></span>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-3">
                  <p className="text-sm font-medium text-amber-900">📋 Likely Reason</p>
                  <p className="text-sm text-amber-800 mt-1">{a.likelyReason}</p>
                </div>

                {/* Recommended Actions */}
                <button onClick={() => setExpanded(expanded === a.id ? null : a.id)} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 mb-2">
                  <Zap className="w-4 h-4" />{expanded === a.id ? 'Hide' : 'Show'} Recommended Actions ({a.recommendedActions?.length || 0})
                  <ChevronRight className={`w-4 h-4 transition-transform ${expanded === a.id ? 'rotate-90' : ''}`} />
                </button>

                {expanded === a.id && a.recommendedActions && (
                  <div className="space-y-2 ml-5">
                    {a.recommendedActions.map((action, i) => (
                      <div key={i} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-900">
                            <span className="inline-flex w-5 h-5 bg-blue-600 text-white rounded-full items-center justify-center text-xs mr-2">{action.priority}</span>
                            {action.action}
                          </span>
                          <Badge variant={action.successRate >= 60 ? 'success' : action.successRate >= 40 ? 'warning' : 'default'} size="sm">
                            {action.successRate}% success rate
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-600 mt-1 ml-7">{action.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={() => router.push(`/claims/${a.claimId}`)}><ExternalLink className="w-4 h-4" /></Button>
            </div>
          </Card>
        ))}
      </div>}
    </AppLayout>
  );
}
