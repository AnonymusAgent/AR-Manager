'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell, TableEmpty } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Search, Plus, ChevronLeft, ChevronRight, FileText, CheckCircle, Clock, Upload } from 'lucide-react';

interface Auth { id: string; patientName: string; insuranceName: string; authNumber: string|null; status: string; dateObtained: string|null; expirationDate: string|null; assigneeName: string|null; createdAt: string; }
interface UserOption { id: string; firstName: string; lastName: string; }

function AuthStatusBadge({ status }: { status: string }) {
  const c: Record<string,{v:'success'|'warning'|'danger'|'info'|'default';l:string}> = {
    pending:{v:'warning',l:'Pending'}, in_progress:{v:'info',l:'In Progress'}, completed:{v:'success',l:'Completed'}, denied:{v:'danger',l:'Denied'}, expired:{v:'default',l:'Expired'},
  };
  const cfg = c[status] || {v:'default' as const,l:status};
  return <Badge variant={cfg.v}>{cfg.l}</Badge>;
}

export default function AuthorizationsPage() {
  const [auths, setAuths] = useState<Auth[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({ total: 0, pending: 0, completed: 0, denied: 0 });
  const [showCreate, setShowCreate] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ patientName: '', insuranceName: '', serviceRequested: '', cptCodes: '', assignedTo: '', expirationDate: '' });
  const router = useRouter();

  const fetchAuths = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) p.set('search', search);
      if (status) p.set('status', status);
      const res = await fetch(`/api/authorizations?${p}`);
      const data = await res.json();
      if (res.ok) { setAuths(data.authorizations); setTotalPages(data.pagination.totalPages); setStats(data.stats); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page, search, status]);

  useEffect(() => { fetchAuths(); }, [fetchAuths]);
  useEffect(() => {
    fetch('/api/users?isActive=true').then(r=>r.json()).then(d => setUsers(d.users || [])).catch(console.error);
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setCreating(true);
    try {
      const res = await fetch('/api/authorizations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (res.ok) { setShowCreate(false); setForm({ patientName: '', insuranceName: '', serviceRequested: '', cptCodes: '', assignedTo: '', expirationDate: '' }); fetchAuths(); }
    } catch (e) { console.error(e); }
    finally { setCreating(false); }
  };

  const completionPct = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  return (
    <AppLayout title="Authorization & Referral Management">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total', value: stats.total, icon: FileText, color: 'bg-blue-100 text-blue-600' },
          { label: 'Pending', value: stats.pending, icon: Clock, color: 'bg-amber-100 text-amber-600' },
          { label: 'Completed', value: stats.completed, icon: CheckCircle, color: 'bg-emerald-100 text-emerald-600' },
          { label: 'Completion Rate', value: `${completionPct}%`, icon: CheckCircle, color: 'bg-purple-100 text-purple-600' },
        ].map(s => (
          <Card key={s.label}>
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-slate-500">{s.label}</p><p className="text-2xl font-bold text-slate-900 mt-1">{s.value}</p></div>
              <div className={`p-3 rounded-xl ${s.color}`}><s.icon className="w-6 h-6" /></div>
            </div>
          </Card>
        ))}
      </div>

      <Card padding="none">
        <div className="p-4 border-b border-slate-200 flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Search patient, insurance, auth#..." value={search} onChange={e=>setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <Select value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}} options={[
            {value:'',label:'All Statuses'},{value:'pending',label:'Pending'},{value:'in_progress',label:'In Progress'},{value:'completed',label:'Completed'},{value:'denied',label:'Denied'},
          ]} className="w-40" />
          <Button onClick={()=>setShowCreate(true)}><Plus className="w-4 h-4 mr-2"/>New Authorization</Button>
        </div>

        <Table>
          <TableHead><TableRow>
            <TableHeader>Patient</TableHeader><TableHeader>Insurance</TableHeader><TableHeader>Auth #</TableHeader>
            <TableHeader>Expiration</TableHeader><TableHeader>Assigned To</TableHeader><TableHeader>Status</TableHeader>
          </TableRow></TableHead>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
            : auths.length === 0 ? <TableEmpty message="No authorizations found" />
            : auths.map(a => (
              <TableRow key={a.id} onClick={()=>router.push(`/authorizations/${a.id}`)}>
                <TableCell className="font-medium">{a.patientName}</TableCell>
                <TableCell>{a.insuranceName}</TableCell>
                <TableCell className="font-mono">{a.authNumber || '-'}</TableCell>
                <TableCell>{a.expirationDate || '-'}</TableCell>
                <TableCell>{a.assigneeName || '-'}</TableCell>
                <TableCell><AuthStatusBadge status={a.status}/></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
          <p className="text-sm text-slate-600">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}><ChevronLeft className="w-4 h-4"/></Button>
            <Button variant="outline" size="sm" onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}><ChevronRight className="w-4 h-4"/></Button>
          </div>
        </div>
      </Card>

      <Modal isOpen={showCreate} onClose={()=>setShowCreate(false)} title="New Authorization" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Patient Name" value={form.patientName} onChange={e=>setForm({...form,patientName:e.target.value})} required />
            <Input label="Insurance Company" value={form.insuranceName} onChange={e=>setForm({...form,insuranceName:e.target.value})} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Service Requested" value={form.serviceRequested} onChange={e=>setForm({...form,serviceRequested:e.target.value})} />
            <Input label="CPT Codes" value={form.cptCodes} onChange={e=>setForm({...form,cptCodes:e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Expiration Date" type="date" value={form.expirationDate} onChange={e=>setForm({...form,expirationDate:e.target.value})} />
            <Select label="Assign To" value={form.assignedTo} onChange={e=>setForm({...form,assignedTo:e.target.value})}
              options={[{value:'',label:'Unassigned'},...users.map(u=>({value:u.id,label:`${u.firstName} ${u.lastName}`}))]} />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={()=>setShowCreate(false)}>Cancel</Button>
            <Button type="submit" loading={creating}>Create</Button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
