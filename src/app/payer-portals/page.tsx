'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import {
  Globe, Plus, Search, CheckCircle, XCircle, Zap, Edit, Trash2, MoreVertical,
  AlertTriangle, Clock, Shield, Settings, RefreshCw, ExternalLink, WifiOff, Loader2,
} from 'lucide-react';

interface Portal {
  id: string; payerName: string; payerCode: string; payerId: string | null;
  portalUrl: string | null; apiEndpoint: string | null; authMethod: string | null;
  isActive: boolean; isConfigured: boolean;
  supportsEligibility: boolean | null; supportsClaimStatus: boolean | null;
  supportsEra: boolean | null; supportsAuth: boolean | null;
  hasCredentials: boolean; totalInteractions: number;
  lastTestedAt: string | null; lastTestStatus: string | null;
  lastInteractionAt: string | null; lastInteractionStatus: string | null;
  notes: string | null; createdAt: string; updatedAt: string;
}

interface CheckResult { success: boolean; data: Record<string, unknown> | null; source: string; error?: string; message: string; retrievedAt?: string; }

const AUTH_METHODS = [
  { value: 'none', label: 'None (Not Configured)' },
  { value: 'basic', label: 'Basic Auth (Username/Password)' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'api_key', label: 'API Key' },
  { value: 'oauth2', label: 'OAuth 2.0' },
];

function StatusDot({ ok }: { ok: boolean | null }) {
  if (ok === null) return <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />;
  return <span className={`w-2 h-2 rounded-full inline-block ${ok ? 'bg-[#16A34A]' : 'bg-[#DC2626]'}`} />;
}

function ConfigBadge({ portal }: { portal: Portal }) {
  if (portal.isConfigured && portal.hasCredentials) return <Badge variant="success" size="sm">Configured</Badge>;
  if (portal.isConfigured) return <Badge variant="warning" size="sm">Partial</Badge>;
  return <Badge variant="default" size="sm">Not Configured</Badge>;
}

export default function PayerPortalsPage() {
  const [portals, setPortals] = useState<Portal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  // CRUD modal
  const [showForm, setShowForm] = useState(false);
  const [editingPortal, setEditingPortal] = useState<Portal | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({
    payerName: '', payerCode: '', payerId: '', portalUrl: '', apiEndpoint: '',
    authMethod: 'none', credUsername: '', credPassword: '', credToken: '', credApiKey: '',
    supportsEligibility: false, supportsClaimStatus: false, supportsEra: false, supportsAuth: false,
    notes: '',
  });

  // Check modal
  const [showCheck, setShowCheck] = useState(false);
  const [checkPortal, setCheckPortal] = useState<Portal | null>(null);
  const [checkType, setCheckType] = useState('eligibility');
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [checkMemberId, setCheckMemberId] = useState('');
  const [checkDos, setCheckDos] = useState('');

  // Delete confirm
  const [showDelete, setShowDelete] = useState(false);
  const [deletePortal, setDeletePortal] = useState<Portal | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Action menu
  const [menuId, setMenuId] = useState<string | null>(null);

  const fetchPortals = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (showInactive) params.set('includeInactive', 'true');
      const res = await fetch(`/api/payer-portals?${params}`, { credentials: 'include' });
      const d = await res.json();
      if (res.ok) setPortals(d.portals);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [search, showInactive]);

  useEffect(() => { fetchPortals(); }, [fetchPortals]);

  const openCreateForm = () => {
    setEditingPortal(null);
    setForm({ payerName: '', payerCode: '', payerId: '', portalUrl: '', apiEndpoint: '', authMethod: 'none', credUsername: '', credPassword: '', credToken: '', credApiKey: '', supportsEligibility: false, supportsClaimStatus: false, supportsEra: false, supportsAuth: false, notes: '' });
    setFormError(''); setShowForm(true);
  };

  const openEditForm = (p: Portal) => {
    setEditingPortal(p);
    setForm({
      payerName: p.payerName, payerCode: p.payerCode, payerId: p.payerId || '', portalUrl: p.portalUrl || '',
      apiEndpoint: p.apiEndpoint || '', authMethod: p.authMethod || 'none',
      credUsername: '', credPassword: '', credToken: '', credApiKey: '',
      supportsEligibility: !!p.supportsEligibility, supportsClaimStatus: !!p.supportsClaimStatus,
      supportsEra: !!p.supportsEra, supportsAuth: !!p.supportsAuth, notes: p.notes || '',
    });
    setFormError(''); setShowForm(true); setMenuId(null);
  };

  const handleSavePortal = async (e: React.FormEvent) => {
    e.preventDefault(); setFormError(''); setSaving(true);
    try {
      if (!form.payerName || !form.payerCode) { setFormError('Payer name and code are required.'); setSaving(false); return; }

      // Build credentials object
      let credentials: Record<string, string> | null = null;
      if (form.authMethod === 'basic' && form.credUsername && form.credPassword) credentials = { username: form.credUsername, password: form.credPassword };
      else if (form.authMethod === 'bearer' && form.credToken) credentials = { token: form.credToken };
      else if (form.authMethod === 'api_key' && form.credApiKey) credentials = { apiKey: form.credApiKey };

      const body = {
        payerName: form.payerName, payerCode: form.payerCode, payerId: form.payerId || null,
        portalUrl: form.portalUrl || null, apiEndpoint: form.apiEndpoint || null,
        authMethod: form.authMethod, ...(credentials ? { credentials } : {}),
        supportsEligibility: form.supportsEligibility, supportsClaimStatus: form.supportsClaimStatus,
        supportsEra: form.supportsEra, supportsAuth: form.supportsAuth, notes: form.notes || null,
      };

      const url = editingPortal ? `/api/payer-portals/${editingPortal.id}` : '/api/payer-portals';
      const method = editingPortal ? 'PATCH' : 'POST';

      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'include' });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error || 'Failed to save.'); return; }
      setShowForm(false); fetchPortals();
    } catch { setFormError('An error occurred.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deletePortal) return; setDeleting(true);
    try {
      await fetch(`/api/payer-portals/${deletePortal.id}`, { method: 'DELETE', credentials: 'include' });
      setShowDelete(false); setDeletePortal(null); fetchPortals();
    } catch (e) { console.error(e); }
    finally { setDeleting(false); }
  };

  const handleToggleActive = async (p: Portal) => {
    try {
      await fetch(`/api/payer-portals/${p.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !p.isActive }), credentials: 'include' });
      fetchPortals();
    } catch (e) { console.error(e); }
    setMenuId(null);
  };

  const openCheckModal = (p: Portal) => {
    setCheckPortal(p); setCheckResult(null); setCheckType('eligibility'); setCheckMemberId(''); setCheckDos(''); setShowCheck(true); setMenuId(null);
  };

  const handleCheck = async () => {
    if (!checkPortal) return; setChecking(true); setCheckResult(null);
    try {
      const res = await fetch(`/api/payer-portals/${checkPortal.id}/check`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ interactionType: checkType, memberId: checkMemberId || undefined, dateOfService: checkDos || undefined }),
      });
      const data = await res.json();
      setCheckResult(data);
      fetchPortals(); // Refresh last tested status
    } catch { setCheckResult({ success: false, data: null, source: 'error', error: 'Network error — unable to reach the server.', message: 'Network error' }); }
    finally { setChecking(false); }
  };

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleString() : '—';

  return (
    <AppLayout title="Payer Portal Integrations">
      {/* Main Card */}
      <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] overflow-hidden">
        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-[#E5E7EB] flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
            <input type="text" placeholder="Search payer portals..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] placeholder:text-[#64748B]" />
          </div>
          <label className="flex items-center gap-2 text-sm text-[#64748B] cursor-pointer">
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="rounded border-[#E5E7EB]" />
            Show inactive
          </label>
          <Button onClick={openCreateForm}><Plus className="w-4 h-4 mr-1.5" />Add Payer Portal</Button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead><tr className="bg-[#F1F5F9] border-b border-[#E5E7EB]">
              {['PAYER', 'CODE', 'STATUS', 'INTEGRATION', 'CAPABILITIES', 'LAST TESTED', 'INTERACTIONS', 'ACTIONS'].map(h =>
                <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">{h}</th>
              )}
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-[#64748B]">
                  <div className="flex items-center justify-center gap-2"><div className="w-5 h-5 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />Loading...</div>
                </td></tr>
              ) : portals.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-[#64748B]">
                  <Globe className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <p>No payer portals configured</p>
                  <p className="text-xs mt-1">Click "Add Payer Portal" to get started</p>
                </td></tr>
              ) : portals.map(p => (
                <tr key={p.id} className={`border-b border-[#E5E7EB] hover:bg-[#F8FAFC] transition-colors ${!p.isActive ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <StatusDot ok={p.isActive ? (p.lastTestStatus === 'success' ? true : p.lastTestStatus === 'failed' ? false : null) : false} />
                      <span className="text-sm font-semibold text-slate-900">{p.payerName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-sm text-[#64748B]">{p.payerCode}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${p.isActive ? 'bg-emerald-50 text-[#16A34A]' : 'bg-red-50 text-[#DC2626]'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${p.isActive ? 'bg-[#16A34A]' : 'bg-[#DC2626]'}`} />
                      {p.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-3"><ConfigBadge portal={p} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {p.supportsEligibility && <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded font-medium">ELIG</span>}
                      {p.supportsClaimStatus && <span className="text-[10px] px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded font-medium">CLM</span>}
                      {p.supportsEra && <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded font-medium">ERA</span>}
                      {p.supportsAuth && <span className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded font-medium">AUTH</span>}
                      {!p.supportsEligibility && !p.supportsClaimStatus && !p.supportsEra && !p.supportsAuth && <span className="text-xs text-[#64748B]">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {p.lastTestedAt ? (
                      <div>
                        <span className={`text-xs font-medium ${p.lastTestStatus === 'success' ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                          {p.lastTestStatus === 'success' ? '✓ Success' : '✗ Failed'}
                        </span>
                        <p className="text-[10px] text-[#64748B] mt-0.5">{fmtDate(p.lastTestedAt)}</p>
                      </div>
                    ) : <span className="text-xs text-[#64748B]">Never tested</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#64748B]">{p.totalInteractions}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openCheckModal(p)} disabled={!p.isActive}
                        className="p-1.5 rounded-md hover:bg-blue-50 text-[#2563EB] disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title="Check portal">
                        <Zap className="w-4 h-4" />
                      </button>
                      <div className="relative">
                        <button onClick={() => setMenuId(menuId === p.id ? null : p.id)} className="p-1.5 rounded-md hover:bg-[#F1F5F9] text-[#64748B] transition-colors">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {menuId === p.id && (<>
                          <div className="fixed inset-0 z-40" onClick={() => setMenuId(null)} />
                          <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-lg shadow-xl border border-[#E5E7EB] z-50 py-1">
                            <button onClick={() => openEditForm(p)} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-[#F5F7FA]"><Edit className="w-4 h-4 text-[#64748B]" />Edit Portal</button>
                            <button onClick={() => handleToggleActive(p)} className={`flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-[#F5F7FA] ${p.isActive ? 'text-amber-700' : 'text-[#16A34A]'}`}>
                              {p.isActive ? <><XCircle className="w-4 h-4" />Disable</> : <><CheckCircle className="w-4 h-4" />Enable</>}
                            </button>
                            <div className="border-t border-[#E5E7EB] my-1" />
                            <button onClick={() => { setDeletePortal(p); setShowDelete(true); setMenuId(null); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[#DC2626] hover:bg-red-50">
                              <Trash2 className="w-4 h-4" />Remove Portal
                            </button>
                          </div>
                        </>)}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-[#E5E7EB] bg-[#FAFBFC]">
          <p className="text-sm text-[#64748B]">{portals.length} payer portal{portals.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* ======== ADD/EDIT PORTAL MODAL ======== */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingPortal ? `Edit: ${editingPortal.payerName}` : 'Add Payer Portal'} size="lg">
        <form onSubmit={handleSavePortal} className="space-y-4">
          {formError && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-[#DC2626]"><AlertTriangle className="w-4 h-4 flex-shrink-0" />{formError}</div>}

          <div className="grid grid-cols-2 gap-4">
            <Input label="Payer Name *" value={form.payerName} onChange={e => setForm({ ...form, payerName: e.target.value })} required placeholder="e.g. United Healthcare" />
            <Input label="Payer Code *" value={form.payerCode} onChange={e => setForm({ ...form, payerCode: e.target.value })} required disabled={!!editingPortal} placeholder="e.g. UHC" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Payer ID" value={form.payerId} onChange={e => setForm({ ...form, payerId: e.target.value })} placeholder="Clearinghouse Payer ID" />
            <Input label="Portal URL" value={form.portalUrl} onChange={e => setForm({ ...form, portalUrl: e.target.value })} placeholder="https://portal.uhc.com" />
          </div>
          <Input label="API Endpoint" value={form.apiEndpoint} onChange={e => setForm({ ...form, apiEndpoint: e.target.value })} placeholder="https://api.uhc.com/v1" helperText="Required for live integration. Leave blank if no API is available." />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Authentication Method</label>
            <select value={form.authMethod} onChange={e => setForm({ ...form, authMethod: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20">
              {AUTH_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          {form.authMethod === 'basic' && (
            <div className="grid grid-cols-2 gap-4 p-3 bg-[#F5F7FA] rounded-lg">
              <Input label="Username" value={form.credUsername} onChange={e => setForm({ ...form, credUsername: e.target.value })} placeholder="API username" />
              <Input label="Password" type="password" value={form.credPassword} onChange={e => setForm({ ...form, credPassword: e.target.value })} placeholder="API password" />
            </div>
          )}
          {form.authMethod === 'bearer' && (
            <div className="p-3 bg-[#F5F7FA] rounded-lg">
              <Input label="Bearer Token" type="password" value={form.credToken} onChange={e => setForm({ ...form, credToken: e.target.value })} placeholder="Paste bearer token" />
            </div>
          )}
          {form.authMethod === 'api_key' && (
            <div className="p-3 bg-[#F5F7FA] rounded-lg">
              <Input label="API Key" type="password" value={form.credApiKey} onChange={e => setForm({ ...form, credApiKey: e.target.value })} placeholder="Paste API key" />
            </div>
          )}
          {editingPortal && form.authMethod !== 'none' && !form.credUsername && !form.credPassword && !form.credToken && !form.credApiKey && (
            <p className="text-xs text-[#64748B] italic">Leave credential fields blank to keep existing credentials unchanged.</p>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Supported Capabilities</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'supportsEligibility', label: 'Eligibility Check' },
                { key: 'supportsClaimStatus', label: 'Claim Status' },
                { key: 'supportsEra', label: 'ERA / EOB Retrieval' },
                { key: 'supportsAuth', label: 'Authorization Status' },
              ].map(c => (
                <label key={c.key} className="flex items-center gap-2 p-2 bg-[#F5F7FA] rounded-lg cursor-pointer hover:bg-[#EFF6FF] transition-colors">
                  <input type="checkbox" checked={form[c.key as keyof typeof form] as boolean} onChange={e => setForm({ ...form, [c.key]: e.target.checked })} className="rounded border-[#E5E7EB] text-[#2563EB]" />
                  <span className="text-sm">{c.label}</span>
                </label>
              ))}
            </div>
          </div>

          <Textarea label="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Internal notes about this integration..." />

          <div className="flex justify-end gap-2.5 pt-3 border-t border-[#E5E7EB]">
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editingPortal ? 'Save Changes' : 'Add Portal'}</Button>
          </div>
        </form>
      </Modal>

      {/* ======== CHECK PORTAL MODAL ======== */}
      <Modal isOpen={showCheck} onClose={() => setShowCheck(false)} title={`Check: ${checkPortal?.payerName}`} size="lg">
        <div className="space-y-4">
          {/* Configuration Status */}
          {checkPortal && !checkPortal.isConfigured && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-900">Integration Not Configured</p>
                <p className="text-sm text-amber-800 mt-1">This payer portal does not have an API endpoint or credentials configured. Real-time data cannot be retrieved. Please configure the integration in portal settings.</p>
              </div>
            </div>
          )}

          {/* Check Type Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Check Type</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { value: 'eligibility', label: 'Eligibility', supported: checkPortal?.supportsEligibility },
                { value: 'claim_status', label: 'Claim Status', supported: checkPortal?.supportsClaimStatus },
                { value: 'era', label: 'ERA/EOB', supported: checkPortal?.supportsEra },
                { value: 'authorization', label: 'Authorization', supported: checkPortal?.supportsAuth },
              ].map(t => (
                <button key={t.value} onClick={() => setCheckType(t.value)} disabled={!t.supported}
                  className={`p-2.5 rounded-lg border text-sm font-medium text-center transition-all ${
                    checkType === t.value ? 'border-[#2563EB] bg-blue-50 text-[#2563EB]' :
                    !t.supported ? 'border-[#E5E7EB] bg-gray-50 text-gray-400 cursor-not-allowed' :
                    'border-[#E5E7EB] hover:border-[#2563EB] text-slate-700'
                  }`}>
                  {t.label}
                  {!t.supported && <p className="text-[10px] text-gray-400 mt-0.5">Not supported</p>}
                </button>
              ))}
            </div>
          </div>

          {/* Optional Fields */}
          <div className="grid grid-cols-2 gap-4">
            <Input label="Member ID" value={checkMemberId} onChange={e => setCheckMemberId(e.target.value)} placeholder="Optional" />
            <Input label="Date of Service" type="date" value={checkDos} onChange={e => setCheckDos(e.target.value)} />
          </div>

          <Button onClick={handleCheck} loading={checking} className="w-full" disabled={!checkPortal?.isActive}>
            {checking ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Retrieving from {checkPortal?.payerName}...</> : <><Zap className="w-4 h-4 mr-2" />Run Check</>}
          </Button>

          {/* Result */}
          {checkResult && (
            <div className={`p-4 rounded-lg border ${checkResult.success ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center gap-2 mb-3">
                {checkResult.success ? <CheckCircle className="w-5 h-5 text-[#16A34A]" /> : <WifiOff className="w-5 h-5 text-[#DC2626]" />}
                <span className={`text-sm font-semibold ${checkResult.success ? 'text-emerald-900' : 'text-red-900'}`}>
                  {checkResult.success ? 'Data Retrieved Successfully' : 'Data Unavailable'}
                </span>
                {checkResult.success && checkResult.retrievedAt && (
                  <span className="text-[10px] text-emerald-700 ml-auto flex items-center gap-1">
                    <Clock className="w-3 h-3" />LIVE — {new Date(checkResult.retrievedAt).toLocaleString()}
                  </span>
                )}
              </div>

              {checkResult.success && checkResult.data ? (
                <div className="space-y-2">
                  {Object.entries(checkResult.data).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm py-1 border-b border-emerald-100 last:border-0">
                      <span className="text-emerald-700 capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                      <span className="font-medium text-emerald-900">{typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v ?? '—')}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-red-800">{checkResult.error || checkResult.message}</p>
              )}

              {!checkResult.success && (
                <p className="text-xs text-red-700 mt-3 italic">
                  Real-time data is currently unavailable. Please verify the portal configuration, credentials, and payer API availability.
                </p>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* ======== DELETE CONFIRMATION ======== */}
      <Modal isOpen={showDelete} onClose={() => setShowDelete(false)} title="Remove Payer Portal">
        {deletePortal && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-[#DC2626] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-900">This action cannot be undone</p>
                <p className="text-sm text-red-800 mt-1">
                  You are about to remove <strong>{deletePortal.payerName} ({deletePortal.payerCode})</strong>.
                  {deletePortal.totalInteractions > 0 && ` This portal has ${deletePortal.totalInteractions} logged interactions and will be deactivated instead of permanently deleted.`}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2.5">
              <Button variant="secondary" onClick={() => setShowDelete(false)}>Cancel</Button>
              <Button variant="danger" onClick={handleDelete} loading={deleting}>Remove Portal</Button>
            </div>
          </div>
        )}
      </Modal>
    </AppLayout>
  );
}
