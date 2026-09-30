'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell, TableEmpty } from '@/components/ui/Table';
import { Modal } from '@/components/ui/Modal';
import { PenTool, Plus, RotateCcw, Check, ChevronLeft, ChevronRight } from 'lucide-react';

interface Sig { id: string; documentType: string; documentTitle: string; signerName: string; signerRole: string | null; signedAt: string; }

export default function ESignaturesPage() {
  const [sigs, setSigs] = useState<Sig[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showSign, setShowSign] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ documentType: 'appeal', documentTitle: '', signerName: '' });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const fetchSigs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/signatures?page=${page}&limit=20`);
      const d = await res.json();
      if (res.ok) { setSigs(d.signatures); setTotalPages(d.pagination.totalPages); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { fetchSigs(); }, [fetchSigs]);

  // Canvas drawing
  const getCtx = () => canvasRef.current?.getContext('2d');
  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };
  const startDraw = (e: React.MouseEvent | React.TouchEvent) => { e.preventDefault(); setIsDrawing(true); const ctx = getCtx(); if(!ctx) return; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
  const draw = (e: React.MouseEvent | React.TouchEvent) => { if (!isDrawing) return; e.preventDefault(); const ctx = getCtx(); if(!ctx) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); };
  const stopDraw = () => { setIsDrawing(false); };
  const clearCanvas = () => { const ctx = getCtx(); if (!ctx || !canvasRef.current) return; ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height); };

  const handleSign = async () => {
    if (!canvasRef.current || !form.documentTitle || !form.signerName) return;
    setSaving(true);
    try {
      const signatureData = canvasRef.current.toDataURL('image/png');
      const res = await fetch('/api/signatures', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, signatureData }),
      });
      if (res.ok) { setShowSign(false); clearCanvas(); setForm({ documentType: 'appeal', documentTitle: '', signerName: '' }); fetchSigs(); }
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <AppLayout title="Electronic Signatures">
      <Card padding="none">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-semibold text-slate-900">Signed Documents</h3>
          <Button onClick={() => setShowSign(true)}><PenTool className="w-4 h-4 mr-2" />New Signature</Button>
        </div>
        <Table>
          <TableHead><TableRow>
            <TableHeader>Document</TableHeader><TableHeader>Type</TableHeader><TableHeader>Signer</TableHeader><TableHeader>Role</TableHeader><TableHeader>Signed At</TableHeader>
          </TableRow></TableHead>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
            : sigs.length === 0 ? <TableEmpty message="No signatures yet" />
            : sigs.map(s => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.documentTitle}</TableCell>
                <TableCell className="capitalize">{s.documentType}</TableCell>
                <TableCell>{s.signerName}</TableCell>
                <TableCell className="capitalize">{s.signerRole?.replace('_', ' ') || '-'}</TableCell>
                <TableCell>{new Date(s.signedAt).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
          <p className="text-sm text-slate-600">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft className="w-4 h-4" /></Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>
      </Card>

      <Modal isOpen={showSign} onClose={() => setShowSign(false)} title="Sign Document" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Document Title" value={form.documentTitle} onChange={e => setForm({ ...form, documentTitle: e.target.value })} required placeholder="e.g. Appeal Letter for Claim #12345" />
            <Select label="Document Type" value={form.documentType} onChange={e => setForm({ ...form, documentType: e.target.value })} options={[
              { value: 'appeal', label: 'Appeal Letter' }, { value: 'payment_agreement', label: 'Payment Agreement' },
              { value: 'authorization', label: 'Authorization Form' }, { value: 'medical_record', label: 'Medical Record Release' },
              { value: 'other', label: 'Other' },
            ]} />
          </div>
          <Input label="Signer Name" value={form.signerName} onChange={e => setForm({ ...form, signerName: e.target.value })} required />
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-slate-700">Signature</label>
              <button onClick={clearCanvas} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"><RotateCcw className="w-3 h-3" />Clear</button>
            </div>
            <div className="border-2 border-slate-300 rounded-lg overflow-hidden bg-white">
              <canvas ref={canvasRef} width={550} height={150}
                onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
                onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
                className="w-full cursor-crosshair touch-none" style={{ height: 150 }} />
            </div>
            <p className="text-xs text-slate-400 mt-1">Draw your signature above using mouse, touch, or stylus</p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowSign(false)}>Cancel</Button>
            <Button onClick={handleSign} loading={saving} disabled={!form.documentTitle || !form.signerName}><Check className="w-4 h-4 mr-2" />Sign Document</Button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
}
