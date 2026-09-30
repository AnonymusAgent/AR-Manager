'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Upload, Eye, CheckCircle, FileText, ScanLine } from 'lucide-react';

interface OcrScan { id: string; fileName: string; documentType: string | null; extractedData: Record<string, string | null> | null; confidence: string | null; status: string; createdAt: string; }

export default function OcrPage() {
  const [scans, setScans] = useState<OcrScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [selectedScan, setSelectedScan] = useState<OcrScan | null>(null);
  const [editedData, setEditedData] = useState<Record<string, string>>({});
  const [applying, setApplying] = useState(false);

  const fetchScans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ocr'); const d = await res.json();
      if (res.ok) setScans(d.scans);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchScans(); }, [fetchScans]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file); fd.append('documentType', 'eob');
      const res = await fetch('/api/ocr', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok && data.scan) {
        setSelectedScan(data.scan);
        setEditedData(Object.fromEntries(Object.entries(data.scan.extractedData || {}).map(([k, v]) => [k, (v as string) || ''])));
        setShowReview(true);
        fetchScans();
      }
    } catch (e) { console.error(e); }
    finally { setUploading(false); }
  };

  const handleApply = async (claimId?: string) => {
    if (!selectedScan) return; setApplying(true);
    try {
      await fetch(`/api/ocr/${selectedScan.id}/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ editedData, claimId }) });
      setShowReview(false); fetchScans();
    } catch (e) { console.error(e); }
    finally { setApplying(false); }
  };

  const fieldLabels: Record<string, string> = { patientName: 'Patient Name', memberId: 'Member ID', groupNumber: 'Group Number', claimNumber: 'Claim Number', dateOfService: 'Date of Service', provider: 'Provider', totalCharge: 'Total Charge', amountPaid: 'Amount Paid', patientResponsibility: 'Patient Responsibility', diagnosisCode: 'Diagnosis Code', procedureCode: 'Procedure Code', payerName: 'Payer Name', authNumber: 'Auth Number', referralNumber: 'Referral Number', npi: 'NPI', taxId: 'Tax ID', denialCode: 'Denial Code' };

  return (
    <AppLayout title="OCR Document Scanner">
      {/* Upload Area */}
      <Card className="mb-6">
        <CardHeader title="Scan a Document" subtitle="Upload an EOB, ERA, insurance card, or medical document for automatic data extraction" />
        <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors">
          <ScanLine className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-700 font-medium mb-2">Drop a file or click to upload</p>
          <p className="text-sm text-slate-500 mb-4">Supported: PDF, Images (PNG, JPG), Text files</p>
          <label className="cursor-pointer">
            <Button loading={uploading}><Upload className="w-4 h-4 mr-2" />Select File</Button>
            <input type="file" accept=".pdf,.png,.jpg,.jpeg,.txt,.csv" className="hidden" onChange={e => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); e.target.value = ''; }} />
          </label>
        </div>
      </Card>

      {/* Recent Scans */}
      <Card>
        <CardHeader title="Recent Scans" />
        {loading ? <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
        : scans.length === 0 ? <p className="text-slate-500 text-center py-8">No scans yet. Upload a document above.</p>
        : <div className="space-y-3">
          {scans.map(s => (
            <div key={s.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="font-medium text-slate-900">{s.fileName}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={s.status === 'applied' ? 'success' : s.status === 'completed' ? 'info' : 'default'} size="sm">{s.status}</Badge>
                    {s.confidence && <span className="text-xs text-slate-500">Confidence: {parseFloat(s.confidence)}%</span>}
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setSelectedScan(s); setEditedData(Object.fromEntries(Object.entries(s.extractedData || {}).map(([k, v]) => [k, (v as string) || '']))); setShowReview(true); }}>
                <Eye className="w-4 h-4 mr-1" />Review
              </Button>
            </div>
          ))}
        </div>}
      </Card>

      {/* Review Modal */}
      <Modal isOpen={showReview} onClose={() => setShowReview(false)} title="Review Extracted Data" size="xl">
        {selectedScan && <div className="space-y-4">
          <div className="p-3 bg-blue-50 rounded-lg flex items-center justify-between">
            <span className="text-sm font-medium text-blue-800">File: {selectedScan.fileName}</span>
            {selectedScan.confidence && <Badge variant={parseFloat(selectedScan.confidence) > 50 ? 'success' : 'warning'}>Confidence: {parseFloat(selectedScan.confidence)}%</Badge>}
          </div>
          <p className="text-sm text-slate-600">Review and edit the extracted data below before saving or applying to a claim.</p>
          <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto">
            {Object.entries(editedData).filter(([k]) => k !== '_confidence').map(([key, value]) => (
              <Input key={key} label={fieldLabels[key] || key} value={value} onChange={e => setEditedData({ ...editedData, [key]: e.target.value })} />
            ))}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowReview(false)}>Cancel</Button>
            <Button variant="secondary" onClick={() => handleApply()} loading={applying}><CheckCircle className="w-4 h-4 mr-2" />Save Edits</Button>
            <Button onClick={() => handleApply()} loading={applying}><CheckCircle className="w-4 h-4 mr-2" />Apply to New Claim</Button>
          </div>
        </div>}
      </Modal>
    </AppLayout>
  );
}
