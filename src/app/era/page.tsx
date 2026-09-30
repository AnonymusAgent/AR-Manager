'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Upload, FileDown, CheckCircle, AlertCircle, Clock, ChevronRight } from 'lucide-react';

interface EraFile { id:string; fileName:string; payerName:string|null; checkNumber:string|null; totalPayment:string|null; totalClaims:number; matchedClaims:number; unmatchedClaims:number; postedClaims:number; status:string; createdAt:string; }

export default function EraPage() {
  const [eraFiles, setEraFiles] = useState<EraFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState<string|null>(null);
  const [uploadResult, setUploadResult] = useState<{success:boolean;message:string}|null>(null);

  const fetchEras = useCallback(async () => {
    setLoading(true);
    try { const res = await fetch('/api/era', {credentials:'include'}); const d = await res.json(); if (res.ok) setEraFiles(d.eraFiles); } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchEras(); }, [fetchEras]);

  const handleUpload = async (file: File) => {
    setUploading(true); setUploadResult(null);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await fetch('/api/era', { method:'POST', body:fd, credentials:'include' });
      const d = await res.json();
      if (res.ok) { setUploadResult({ success:true, message:`ERA processed: ${d.eraFile.totalClaims} claims (${d.eraFile.matched} matched, ${d.eraFile.unmatched} unmatched)` }); fetchEras(); }
      else { setUploadResult({ success:false, message:d.error }); }
    } catch(e) { setUploadResult({ success:false, message:'Upload failed' }); }
    finally { setUploading(false); }
  };

  const handlePost = async (eraId: string) => {
    if (!confirm('Post all matched ERA transactions? This will update claim balances.')) return;
    setPosting(eraId);
    try {
      const res = await fetch(`/api/era/${eraId}/post`, { method:'POST', credentials:'include' });
      const d = await res.json();
      if (res.ok) { alert(`Posted: ${d.posted} claims, $${d.totalAllocated.toFixed(2)} allocated${d.failed > 0 ? `, ${d.failed} failed` : ''}`); fetchEras(); }
      else { alert(d.error); }
    } catch(e) { alert('Failed to post ERA'); }
    finally { setPosting(null); }
  };

  const fmt = (v:string|null) => v ? `$${parseFloat(v).toLocaleString('en-US',{minimumFractionDigits:2})}` : '—';

  return (
    <AppLayout title="ERA/835 Processing">
      {/* Upload Section */}
      <Card className="mb-5">
        <CardHeader title="Upload ERA/835 File" subtitle="Upload ANSI X12 835 or CSV remittance files for automated payment posting" />
        <div className="border-2 border-dashed border-[#E5E7EB] rounded-xl p-6 text-center">
          <FileDown className="w-10 h-10 text-[#94A3B8] mx-auto mb-3" />
          <p className="text-sm text-[#64748B] mb-3">Drop an ERA/835 file or click to upload</p>
          <label className="cursor-pointer">
            <Button loading={uploading}><Upload className="w-4 h-4 mr-2"/>Select ERA File</Button>
            <input type="file" accept=".835,.txt,.csv,.edi" className="hidden" onChange={e=>{if(e.target.files?.[0])handleUpload(e.target.files[0]); e.target.value='';}} />
          </label>
        </div>
        {uploadResult && (
          <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${uploadResult.success ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
            {uploadResult.success ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="text-sm">{uploadResult.message}</span>
          </div>
        )}
      </Card>

      {/* ERA History */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-[#E5E7EB]"><h3 className="font-semibold text-slate-900">ERA Processing History</h3></div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead><tr className="bg-[#F1F5F9] border-b border-[#E5E7EB]">
              {['FILE','PAYER','CHECK #','TOTAL','CLAIMS','MATCHED','UNMATCHED','POSTED','STATUS','ACTIONS'].map(h=>
                <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-[#64748B] uppercase tracking-wider">{h}</th>
              )}
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={10} className="px-4 py-8 text-center text-[#64748B]">Loading...</td></tr>
              : eraFiles.length === 0 ? <tr><td colSpan={10} className="px-4 py-8 text-center text-[#64748B]">No ERA files processed yet</td></tr>
              : eraFiles.map(era => (
                <tr key={era.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900 max-w-[200px] truncate">{era.fileName}</td>
                  <td className="px-4 py-3 text-sm text-[#64748B]">{era.payerName || '—'}</td>
                  <td className="px-4 py-3 text-sm font-mono text-[#64748B]">{era.checkNumber || '—'}</td>
                  <td className="px-4 py-3 text-sm font-bold text-slate-900">{fmt(era.totalPayment)}</td>
                  <td className="px-4 py-3 text-sm text-[#64748B]">{era.totalClaims}</td>
                  <td className="px-4 py-3 text-sm text-emerald-600 font-medium">{era.matchedClaims}</td>
                  <td className="px-4 py-3 text-sm text-red-600 font-medium">{era.unmatchedClaims}</td>
                  <td className="px-4 py-3 text-sm text-[#64748B]">{era.postedClaims}</td>
                  <td className="px-4 py-3">
                    <Badge variant={era.status==='posted'?'success':era.status==='partial'?'warning':era.status==='parsed'?'info':'default'} size="sm">
                      {era.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {era.status === 'parsed' && era.matchedClaims > 0 && (
                      <Button size="sm" onClick={()=>handlePost(era.id)} loading={posting===era.id}>
                        <CheckCircle className="w-3.5 h-3.5 mr-1"/>Post
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </AppLayout>
  );
}
