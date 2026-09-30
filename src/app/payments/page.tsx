'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { CreditCard, Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react';

interface Payment { id:string; paymentType:string; payerName:string|null; paymentDate:string; checkNumber:string|null; totalAmount:string; allocatedAmount:string|null; unallocatedAmount:string|null; status:string; createdAt:string; }

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ paymentType:'insurance', payerName:'', paymentDate:'', checkNumber:'', totalAmount:'', notes:'' });

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try { const res = await fetch(`/api/payments?page=${page}&limit=20`, {credentials:'include'}); const d = await res.json(); if (res.ok) { setPayments(d.payments); setTotalPages(d.pagination.totalPages); } } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const res = await fetch('/api/payments', { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body:JSON.stringify(form) });
      if (res.ok) { setShowCreate(false); setForm({ paymentType:'insurance', payerName:'', paymentDate:'', checkNumber:'', totalAmount:'', notes:'' }); fetchPayments(); }
      else { const d = await res.json(); alert(d.error); }
    } catch(e) { console.error(e); }
    finally { setSaving(false); }
  };

  const fmt = (v:string|null) => v ? `$${parseFloat(v).toLocaleString('en-US',{minimumFractionDigits:2})}` : '$0.00';

  return (
    <AppLayout title="Payment Posting">
      <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Payments</h3>
          <Button onClick={()=>setShowCreate(true)}><Plus className="w-4 h-4 mr-1.5"/>New Payment</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead><tr className="bg-[#F1F5F9] border-b border-[#E5E7EB]">
              {['TYPE','PAYER','DATE','CHECK #','TOTAL','ALLOCATED','UNALLOCATED','STATUS'].map(h=>
                <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-[#64748B] uppercase tracking-wider">{h}</th>
              )}
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={8} className="px-4 py-8 text-center text-[#64748B]">Loading...</td></tr>
              : payments.length === 0 ? <tr><td colSpan={8} className="px-4 py-8 text-center text-[#64748B]"><CreditCard className="w-10 h-10 mx-auto mb-2 text-slate-300"/>No payments yet</td></tr>
              : payments.map(p => (
                <tr key={p.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]">
                  <td className="px-4 py-3 text-sm capitalize">{p.paymentType}</td>
                  <td className="px-4 py-3 text-sm text-[#64748B]">{p.payerName || '—'}</td>
                  <td className="px-4 py-3 text-sm text-[#64748B]">{p.paymentDate}</td>
                  <td className="px-4 py-3 text-sm font-mono text-[#64748B]">{p.checkNumber || '—'}</td>
                  <td className="px-4 py-3 text-sm font-bold text-slate-900">{fmt(p.totalAmount)}</td>
                  <td className="px-4 py-3 text-sm text-emerald-600">{fmt(p.allocatedAmount)}</td>
                  <td className="px-4 py-3 text-sm text-amber-600">{fmt(p.unallocatedAmount)}</td>
                  <td className="px-4 py-3"><Badge variant={p.status==='posted'?'success':p.status==='pending'?'warning':'default'} size="sm">{p.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={showCreate} onClose={()=>setShowCreate(false)} title="New Payment">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select label="Payment Type *" value={form.paymentType} onChange={e=>setForm({...form,paymentType:e.target.value})} options={[{value:'insurance',label:'Insurance Payment'},{value:'patient',label:'Patient Payment'},{value:'adjustment',label:'Adjustment'},{value:'refund',label:'Refund'}]} />
            <Input label="Payer Name" value={form.payerName} onChange={e=>setForm({...form,payerName:e.target.value})} placeholder="Insurance/Payer name" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="Payment Date *" type="date" value={form.paymentDate} onChange={e=>setForm({...form,paymentDate:e.target.value})} required />
            <Input label="Check/EFT Number" value={form.checkNumber} onChange={e=>setForm({...form,checkNumber:e.target.value})} />
            <Input label="Total Amount *" type="number" step="0.01" value={form.totalAmount} onChange={e=>setForm({...form,totalAmount:e.target.value})} required placeholder="0.00" />
          </div>
          <div className="flex justify-end gap-2.5 pt-3 border-t border-[#E5E7EB]">
            <Button type="button" variant="secondary" onClick={()=>setShowCreate(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Create Payment</Button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
