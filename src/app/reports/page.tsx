'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Download, TrendingUp, TrendingDown, DollarSign, FileText, ShieldCheck, BarChart3, PieChart, AlertTriangle, Calendar } from 'lucide-react';

interface ReportData {
  dateRange: { from: string; to: string };
  kpis: { totalClaims: number; paidClaims: number; deniedClaims: number; pendingClaims: number; totalBilled: number; totalPaid: number; totalBalance: number; denialRate: number; collectionRate: number; totalAuths: number; completedAuths: number; pendingAuths: number };
  claimsByStatus: Array<{ status: string; count: number }>;
  trendData: Array<{ date: string; count: number }>;
  claimsByInsurance: Array<{ insurance: string; count: number; totalBilled: number }>;
  codingByStatus: Array<{ status: string; count: number }>;
  userPerformance: Array<{ name: string; claimsCompleted: number; claimsTotal: number; authsCompleted: number }>;
  aging: Array<{ bucket: string; claims: number; balance: number }>;
}

function KpiCard({ label, value, icon: Icon, color, trend }: { label: string; value: string | number; icon: React.ElementType; color: string; trend?: string }) {
  const colorMap: Record<string, string> = { blue: 'bg-blue-100 text-blue-600', green: 'bg-emerald-100 text-emerald-600', red: 'bg-red-100 text-red-600', amber: 'bg-amber-100 text-amber-600', purple: 'bg-purple-100 text-purple-600' };
  return (
    <Card><div className="flex items-start justify-between">
      <div><p className="text-sm text-slate-500 font-medium">{label}</p><p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
        {trend && <p className="text-xs text-slate-500 mt-1">{trend}</p>}
      </div>
      <div className={`p-3 rounded-xl ${colorMap[color]}`}><Icon className="w-6 h-6" /></div>
    </div></Card>
  );
}

function BarViz({ items, maxVal }: { items: Array<{ label: string; value: number; color: string }>; maxVal: number }) {
  return (
    <div className="space-y-3">
      {items.map(item => (
        <div key={item.label}>
          <div className="flex justify-between text-sm mb-1"><span className="text-slate-600">{item.label}</span><span className="font-medium text-slate-900">{item.value}</span></div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${item.color}`} style={{ width: `${maxVal > 0 ? (item.value / maxVal) * 100 : 0}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

function MiniChart({ data, height = 60 }: { data: Array<{ date: string; count: number }>; height?: number }) {
  if (data.length === 0) return <p className="text-sm text-slate-400 text-center py-4">No trend data</p>;
  const max = Math.max(...data.map(d => d.count), 1);
  const w = 100 / data.length;
  return (
    <div className="relative" style={{ height }}>
      <svg viewBox={`0 0 ${data.length * 10} ${height}`} className="w-full h-full" preserveAspectRatio="none">
        <defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" /><stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" /></linearGradient></defs>
        <path d={`M0,${height} ${data.map((d, i) => `L${i * 10 + 5},${height - (d.count / max) * (height - 5)}`).join(' ')} L${data.length * 10},${height} Z`} fill="url(#tg)" />
        <polyline fill="none" stroke="#3b82f6" strokeWidth="1.5" points={data.map((d, i) => `${i * 10 + 5},${height - (d.count / max) * (height - 5)}`).join(' ')} />
      </svg>
      <div className="flex justify-between text-xs text-slate-400 mt-1"><span>{data[0]?.date?.slice(5)}</span><span>{data[data.length - 1]?.date?.slice(5)}</span></div>
    </div>
  );
}

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
const statusLabels: Record<string, string> = { new: 'New', assigned: 'Assigned', in_progress: 'In Progress', pending: 'Pending', submitted_for_review: 'Under Review', approved: 'Approved', rework_required: 'Rework', paid: 'Paid', denied: 'Denied', closed: 'Closed', sent_to_coding: 'Sent to Coding', coding_review: 'Coding Review', coding_corrected: 'Corrected', returned_to_billing: 'Returned', resubmitted: 'Resubmitted' };
const statusColors: Record<string, string> = { new: 'bg-blue-500', assigned: 'bg-purple-500', in_progress: 'bg-amber-500', pending: 'bg-slate-400', submitted_for_review: 'bg-cyan-500', approved: 'bg-emerald-500', rework_required: 'bg-red-400', paid: 'bg-green-500', denied: 'bg-red-600', closed: 'bg-slate-600', sent_to_coding: 'bg-indigo-500', coding_review: 'bg-amber-400', coding_corrected: 'bg-emerald-400', returned_to_billing: 'bg-purple-400', resubmitted: 'bg-teal-500' };

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [exporting, setExporting] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports?dateFrom=${dateFrom}&dateTo=${dateTo}`);
      const d = await res.json();
      if (res.ok) setData(d);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [dateFrom, dateTo]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const handleExport = async (entity: string, format: string) => {
    setExporting(true);
    try {
      const url = `/api/export?entity=${entity}&format=${format}&dateFrom=${dateFrom}&dateTo=${dateTo}`;
      const link = document.createElement('a');
      link.href = url; link.download = `${entity}_${format}`; document.body.appendChild(link); link.click(); document.body.removeChild(link);
    } finally { setTimeout(() => setExporting(false), 1000); }
  };

  if (loading) return <AppLayout title="Reports"><div className="flex justify-center py-16"><div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div></AppLayout>;
  if (!data) return <AppLayout title="Reports"><p className="text-center text-slate-500 py-16">Failed to load report data</p></AppLayout>;

  const maxStatus = Math.max(...data.claimsByStatus.map(s => s.count), 1);

  return (
    <AppLayout title="Advanced Reports">
      {/* Date Range & Export Controls */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <Input label="From" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-44" />
          <Input label="To" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-44" />
          <Button onClick={fetchReport} variant="secondary"><Calendar className="w-4 h-4 mr-2" />Apply</Button>
          <div className="flex-1" />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleExport('claims', 'csv')} loading={exporting}><Download className="w-4 h-4 mr-1" />CSV</Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('claims', 'xlsx')} loading={exporting}><Download className="w-4 h-4 mr-1" />Excel</Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('productivity', 'csv')} loading={exporting}><Download className="w-4 h-4 mr-1" />Productivity</Button>
          </div>
        </div>
      </Card>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
        <KpiCard label="Total Claims" value={data.kpis.totalClaims} icon={FileText} color="blue" />
        <KpiCard label="Collection Rate" value={`${data.kpis.collectionRate}%`} icon={TrendingUp} color="green" trend={fmt(data.kpis.totalPaid) + ' collected'} />
        <KpiCard label="Denial Rate" value={`${data.kpis.denialRate}%`} icon={data.kpis.denialRate > 15 ? TrendingDown : TrendingUp} color={data.kpis.denialRate > 15 ? 'red' : 'green'} trend={`${data.kpis.deniedClaims} denied`} />
        <KpiCard label="Outstanding" value={fmt(data.kpis.totalBalance)} icon={DollarSign} color="amber" />
        <KpiCard label="Authorizations" value={`${data.kpis.completedAuths}/${data.kpis.totalAuths}`} icon={ShieldCheck} color="purple" trend={`${data.kpis.pendingAuths} pending`} />
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card><div className="text-center"><p className="text-sm text-slate-500">Total Billed</p><p className="text-3xl font-bold text-blue-600 mt-1">{fmt(data.kpis.totalBilled)}</p></div></Card>
        <Card><div className="text-center"><p className="text-sm text-slate-500">Total Collected</p><p className="text-3xl font-bold text-emerald-600 mt-1">{fmt(data.kpis.totalPaid)}</p></div></Card>
        <Card><div className="text-center"><p className="text-sm text-slate-500">Outstanding Balance</p><p className="text-3xl font-bold text-amber-600 mt-1">{fmt(data.kpis.totalBalance)}</p></div></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Claims Trend */}
        <Card>
          <CardHeader title="Claims Volume Trend" subtitle={`${data.dateRange.from} — ${data.dateRange.to}`} />
          <MiniChart data={data.trendData} height={120} />
        </Card>

        {/* Claims by Status */}
        <Card>
          <CardHeader title="Claims by Status" />
          <BarViz items={data.claimsByStatus.map(s => ({ label: statusLabels[s.status] || s.status, value: s.count, color: statusColors[s.status] || 'bg-slate-400' }))} maxVal={maxStatus} />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* AR Aging */}
        <Card>
          <CardHeader title="AR Aging Report" action={<Button variant="ghost" size="sm" onClick={() => handleExport('claims', 'xlsx')}><Download className="w-4 h-4" /></Button>} />
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50"><tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Aging Bucket</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Claims</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Balance</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-200">
                {data.aging.map(a => (
                  <tr key={a.bucket} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{a.bucket}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{a.claims}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{fmt(a.balance)}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-bold">
                  <td className="px-4 py-3 text-slate-900">Total</td>
                  <td className="px-4 py-3 text-right text-slate-900">{data.aging.reduce((s, a) => s + a.claims, 0)}</td>
                  <td className="px-4 py-3 text-right text-slate-900">{fmt(data.aging.reduce((s, a) => s + a.balance, 0))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        {/* Top Insurance */}
        <Card>
          <CardHeader title="Claims by Insurance (Top 10)" />
          {data.claimsByInsurance.length === 0 ? <p className="text-slate-500 text-center py-6">No data</p> : (
            <div className="space-y-3">
              {data.claimsByInsurance.map(ins => (
                <div key={ins.insurance} className="flex items-center justify-between">
                  <div className="flex-1 min-w-0"><p className="text-sm font-medium text-slate-900 truncate">{ins.insurance}</p>
                    <p className="text-xs text-slate-500">{ins.count} claims • {fmt(ins.totalBilled)} billed</p>
                  </div>
                  <Badge variant="default">{ins.count}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* User Performance */}
      <Card>
        <CardHeader title="User Performance" action={<Button variant="ghost" size="sm" onClick={() => handleExport('productivity', 'xlsx')}><Download className="w-4 h-4 mr-1" />Export</Button>} />
        {data.userPerformance.length === 0 ? <p className="text-slate-500 text-center py-6">No performance data</p> : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50"><tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Name</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Claims Done</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Total Claims</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Auths Done</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Completion</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-200">
                {data.userPerformance.map(u => {
                  const total = u.claimsTotal + (u.authsCompleted > 0 ? 1 : 0);
                  const done = u.claimsCompleted + u.authsCompleted;
                  const pct = total > 0 ? Math.round((done / Math.max(total, 1)) * 100) : 0;
                  return (
                    <tr key={u.name} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{u.name}</td>
                      <td className="px-4 py-3 text-center text-emerald-600 font-semibold">{u.claimsCompleted}</td>
                      <td className="px-4 py-3 text-center text-slate-700">{u.claimsTotal}</td>
                      <td className="px-4 py-3 text-center text-purple-600 font-semibold">{u.authsCompleted}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-center"><div className="w-16 bg-slate-200 rounded-full h-2"><div className={`h-2 rounded-full ${pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} /></div><span className="text-sm font-medium text-slate-700 w-10 text-right">{pct}%</span></div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AppLayout>
  );
}
