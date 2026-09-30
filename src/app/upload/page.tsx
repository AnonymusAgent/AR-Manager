'use client';

import React, { useState, useRef, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Upload, FileText, CheckCircle, AlertCircle, X, ArrowRight, ArrowLeft, Building2, User, Stethoscope } from 'lucide-react';

interface UploadResult { success: boolean; fileName: string; recordsProcessed?: number; error?: string; }
interface Practice { id: string; name: string; code: string; specialty: string | null; }
interface UserOption { id: string; firstName: string; lastName: string; role: string; }

type Step = 'files' | 'assignment' | 'uploading' | 'done';

export default function UploadPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [step, setStep] = useState<Step>('files');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Assignment fields
  const [practices, setPractices] = useState<Practice[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedPractice, setSelectedPractice] = useState('');
  const [provider, setProvider] = useState('');
  const [assignedUser, setAssignedUser] = useState('');

  useEffect(() => {
    fetch('/api/practices/my', { credentials: 'include' }).then(r => r.json()).then(d => setPractices(d.practices || [])).catch(console.error);
    fetch('/api/users?isActive=true', { credentials: 'include' }).then(r => r.json()).then(d => setUsers((d.users || []).filter((u: UserOption) => ['ar_executive', 'billing_user'].includes(u.role)))).catch(console.error);
  }, []);

  const handleDrag = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragActive(e.type === 'dragenter' || e.type === 'dragover'); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false);
    const dropped = Array.from(e.dataTransfer.files).filter(f => /\.(xlsx|xls|csv|pdf)$/i.test(f.name));
    setFiles(prev => [...prev, ...dropped]);
  };
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files) setFiles(prev => [...prev, ...Array.from(e.target.files!)]); };
  const removeFile = (i: number) => setFiles(prev => prev.filter((_, idx) => idx !== i));

  const handleUpload = async () => {
    setStep('uploading'); setUploading(true); setResults([]);
    for (const file of files) {
      try {
        const fd = new FormData();
        fd.append('file', file);
        if (selectedPractice) fd.append('practiceId', selectedPractice);
        if (provider) fd.append('provider', provider);
        if (assignedUser) fd.append('assignedTo', assignedUser);

        const res = await fetch('/api/upload', { method: 'POST', body: fd, credentials: 'include' });
        const data = await res.json();
        setResults(prev => [...prev, { success: res.ok, fileName: file.name, recordsProcessed: data.recordsProcessed, error: data.error }]);
      } catch { setResults(prev => [...prev, { success: false, fileName: file.name, error: 'Upload failed' }]); }
    }
    setUploading(false); setStep('done');
  };

  const resetForm = () => { setFiles([]); setResults([]); setStep('files'); setSelectedPractice(''); setProvider(''); setAssignedUser(''); };

  const fmtSize = (b: number) => b < 1024 ? `${b} B` : b < 1024*1024 ? `${(b/1024).toFixed(1)} KB` : `${(b/(1024*1024)).toFixed(1)} MB`;

  const selectedPracticeName = practices.find(p => p.id === selectedPractice);
  const selectedUserName = users.find(u => u.id === assignedUser);

  return (
    <AppLayout title="Upload AR Files">
      <div className="max-w-3xl mx-auto">
        {/* Step Indicator */}
        <div className="flex items-center gap-3 mb-6">
          {[
            { key: 'files', label: '1. Select Files', icon: FileText },
            { key: 'assignment', label: '2. Assign Practice & User', icon: Building2 },
            { key: 'uploading', label: '3. Import AR', icon: Upload },
          ].map((s, i) => (
            <React.Fragment key={s.key}>
              {i > 0 && <div className={`flex-1 h-0.5 ${step === s.key || step === 'done' || (step === 'assignment' && i <= 1) || (step === 'uploading' && i <= 2) ? 'bg-[#2563EB]' : 'bg-[#E5E7EB]'}`} />}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap ${
                step === s.key || (step === 'done' && s.key === 'uploading') ? 'bg-[#2563EB] text-white' :
                (step === 'assignment' && s.key === 'files') || (step === 'uploading' && i < 2) || (step === 'done' && i < 2) ? 'bg-emerald-100 text-emerald-700' :
                'bg-[#F1F5F9] text-[#64748B]'
              }`}>
                <s.icon className="w-3.5 h-3.5" />{s.label}
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* Step 1: Select Files */}
        {step === 'files' && (
          <Card>
            <CardHeader title="Upload AR File" subtitle="Select Excel, CSV, or PDF files containing claim/AR data" />
            <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${dragActive ? 'border-[#2563EB] bg-blue-50' : 'border-[#E5E7EB] hover:border-slate-400'}`}
              onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}>
              <Upload className="w-12 h-12 text-[#94A3B8] mx-auto mb-4" />
              <p className="text-slate-700 font-medium mb-2">Drag and drop files here</p>
              <p className="text-[#64748B] text-sm mb-4">or click to browse</p>
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>Select Files</Button>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv,.pdf" multiple onChange={handleFileInput} className="hidden" />
              <p className="text-xs text-[#94A3B8] mt-4">Supported: XLSX, XLS, CSV, PDF</p>
            </div>

            {files.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-medium text-slate-700 mb-3">Selected Files ({files.length})</h4>
                <div className="space-y-2">
                  {files.map((file, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-[#F5F7FA] rounded-lg">
                      <div className="flex items-center gap-3"><FileText className="w-5 h-5 text-[#64748B]" /><div><p className="text-sm font-medium">{file.name}</p><p className="text-xs text-[#94A3B8]">{fmtSize(file.size)}</p></div></div>
                      <button onClick={() => removeFile(i)} className="p-1 text-[#94A3B8] hover:text-[#DC2626]"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
                <Button className="mt-4 w-full" onClick={() => setStep('assignment')}>
                  Continue to Assignment <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}
          </Card>
        )}

        {/* Step 2: Practice & User Assignment */}
        {step === 'assignment' && (
          <Card>
            <CardHeader title="Assign Practice & User" subtitle="Associate the uploaded AR with a practice and assign to a user" />

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Practice *</label>
                <select value={selectedPractice} onChange={e => setSelectedPractice(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]">
                  <option value="">Select Practice...</option>
                  {practices.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}{p.specialty ? ` (${p.specialty})` : ''}</option>)}
                </select>
              </div>

              <Input label="Provider" value={provider} onChange={e => setProvider(e.target.value)} placeholder="Provider/Physician name (optional)" />

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Assign to User *</label>
                <select value={assignedUser} onChange={e => setAssignedUser(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]">
                  <option value="">Select AR Executive / Billing User...</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.role.replace(/_/g,' ')})</option>)}
                </select>
              </div>

              {/* Review Summary */}
              {selectedPractice && assignedUser && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-medium text-blue-900 mb-2">Review Assignment</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-blue-600">Files:</span> <span className="font-medium text-blue-900">{files.length} file(s)</span></div>
                    <div><span className="text-blue-600">Practice:</span> <span className="font-medium text-blue-900">{selectedPracticeName?.code} — {selectedPracticeName?.name}</span></div>
                    {provider && <div><span className="text-blue-600">Provider:</span> <span className="font-medium text-blue-900">{provider}</span></div>}
                    <div><span className="text-blue-600">Assigned to:</span> <span className="font-medium text-blue-900">{selectedUserName?.firstName} {selectedUserName?.lastName}</span></div>
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-4">
                <Button variant="secondary" onClick={() => setStep('files')}><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
                <Button onClick={handleUpload} disabled={!selectedPractice || !assignedUser}>
                  Confirm & Import <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Step 3: Uploading / Done */}
        {(step === 'uploading' || step === 'done') && (
          <Card>
            <CardHeader title={uploading ? 'Importing AR...' : 'AR Successfully Imported'} />
            {uploading && (
              <div className="flex items-center justify-center py-8"><div className="w-8 h-8 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin" /></div>
            )}
            {results.length > 0 && (
              <div className="space-y-2">
                {results.map((r, i) => (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-lg ${r.success ? 'bg-emerald-50' : 'bg-red-50'}`}>
                    {r.success ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-[#DC2626]" />}
                    <div><p className={`text-sm font-medium ${r.success ? 'text-emerald-900' : 'text-red-900'}`}>{r.fileName}</p>
                      <p className={`text-xs ${r.success ? 'text-emerald-700' : 'text-red-700'}`}>{r.success ? `${r.recordsProcessed} records imported` : r.error}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {step === 'done' && (
              <div className="flex justify-between mt-6">
                <Button variant="secondary" onClick={resetForm}>Upload More Files</Button>
                <Button onClick={() => window.location.href = '/claims'}>View Claims <ArrowRight className="w-4 h-4 ml-2" /></Button>
              </div>
            )}
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
