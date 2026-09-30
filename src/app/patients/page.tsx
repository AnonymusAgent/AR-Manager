'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Search, Plus, ChevronLeft, ChevronRight, UserCircle, AlertTriangle } from 'lucide-react';

interface Patient { id:string; firstName:string; middleName:string|null; lastName:string; dateOfBirth:string|null; gender:string|null; phone:string|null; email:string|null; memberId:string|null; city:string|null; state:string|null; isActive:boolean; createdAt:string; }

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dupeWarning, setDupeWarning] = useState('');
  const [form, setForm] = useState({ firstName:'', lastName:'', middleName:'', dateOfBirth:'', gender:'', phone:'', email:'', memberId:'', address:'', city:'', state:'', zip:'' });

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page:String(page), limit:'20' });
      if (search) p.set('search', search);
      const res = await fetch(`/api/patients?${p}`, { credentials:'include' });
      const d = await res.json();
      if (res.ok) { setPatients(d.patients); setTotal(d.pagination.total); setTotalPages(d.pagination.totalPages); }
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { fetchPatients(); }, [fetchPatients]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setDupeWarning('');
    try {
      const res = await fetch('/api/patients', { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body:JSON.stringify(form) });
      const d = await res.json();
      if (res.ok) {
        if (d.duplicateWarning) setDupeWarning(d.duplicateWarning);
        setShowCreate(false); setForm({ firstName:'', lastName:'', middleName:'', dateOfBirth:'', gender:'', phone:'', email:'', memberId:'', address:'', city:'', state:'', zip:'' }); fetchPatients();
      }
    } catch(e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <AppLayout title="Patient Management">
      <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E5E7EB] flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
            <input type="text" placeholder="Search patients by name, phone, member ID..." value={search} onChange={e=>setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 placeholder:text-[#94A3B8]" />
          </div>
          <Button onClick={()=>setShowCreate(true)}><Plus className="w-4 h-4 mr-1.5"/>Add Patient</Button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead><tr className="bg-[#F1F5F9] border-b border-[#E5E7EB]">
              {['NAME','DOB','GENDER','PHONE','EMAIL','MEMBER ID','LOCATION','STATUS'].map(h=>
                <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-[#64748B] uppercase tracking-wider">{h}</th>
              )}
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={8} className="px-4 py-12 text-center text-[#64748B]">Loading...</td></tr>
              : patients.length === 0 ? <tr><td colSpan={8} className="px-4 py-12 text-center text-[#64748B]"><UserCircle className="w-10 h-10 mx-auto mb-2 text-slate-300"/>No patients found</td></tr>
              : patients.map(p => (
                <tr key={p.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]">
                  <td className="px-4 py-3 font-semibold text-slate-900">{p.lastName}, {p.firstName}{p.middleName ? ` ${p.middleName}` : ''}</td>
                  <td className="px-4 py-3 text-sm text-[#64748B]">{p.dateOfBirth || '—'}</td>
                  <td className="px-4 py-3 text-sm text-[#64748B] capitalize">{p.gender || '—'}</td>
                  <td className="px-4 py-3 text-sm text-[#64748B]">{p.phone || '—'}</td>
                  <td className="px-4 py-3 text-sm text-[#64748B]">{p.email || '—'}</td>
                  <td className="px-4 py-3 text-sm font-mono text-[#64748B]">{p.memberId || '—'}</td>
                  <td className="px-4 py-3 text-sm text-[#64748B]">{[p.city, p.state].filter(Boolean).join(', ') || '—'}</td>
                  <td className="px-4 py-3"><Badge variant={p.isActive ? 'success' : 'danger'} size="sm">{p.isActive ? 'Active' : 'Inactive'}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 flex items-center justify-between border-t border-[#E5E7EB] bg-[#FAFBFC]">
          <p className="text-[13px] text-[#64748B]">Showing {total} patients</p>
          <div className="flex gap-0.5">
            <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} className="px-2.5 py-1 text-[13px] text-[#64748B] hover:bg-[#F1F5F9] rounded disabled:opacity-30">Prev</button>
            <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} className="px-2.5 py-1 text-[13px] text-[#64748B] hover:bg-[#F1F5F9] rounded disabled:opacity-30">Next</button>
          </div>
        </div>
      </div>

      <Modal isOpen={showCreate} onClose={()=>setShowCreate(false)} title="Add Patient" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          {dupeWarning && <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800"><AlertTriangle className="w-4 h-4"/>{dupeWarning}</div>}
          <div className="grid grid-cols-3 gap-4">
            <Input label="First Name *" value={form.firstName} onChange={e=>setForm({...form,firstName:e.target.value})} required />
            <Input label="Middle Name" value={form.middleName} onChange={e=>setForm({...form,middleName:e.target.value})} />
            <Input label="Last Name *" value={form.lastName} onChange={e=>setForm({...form,lastName:e.target.value})} required />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="Date of Birth" type="date" value={form.dateOfBirth} onChange={e=>setForm({...form,dateOfBirth:e.target.value})} />
            <Select label="Gender" value={form.gender} onChange={e=>setForm({...form,gender:e.target.value})} options={[{value:'',label:'Select...'},{value:'male',label:'Male'},{value:'female',label:'Female'},{value:'other',label:'Other'}]} />
            <Input label="Member ID" value={form.memberId} onChange={e=>setForm({...form,memberId:e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Phone" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} />
            <Input label="Email" type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} />
          </div>
          <div className="flex justify-end gap-2.5 pt-3 border-t border-[#E5E7EB]">
            <Button type="button" variant="secondary" onClick={()=>setShowCreate(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Create Patient</Button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
