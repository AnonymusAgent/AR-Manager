'use client';
import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { TrendingUp, FileText, ShieldCheck, Code, CheckCircle, Users } from 'lucide-react';

interface UserStat {
  id:string; name:string; role:string;
  claims:{total:number;completed:number;denied:number;pending:number};
  authorizations:{total:number;completed:number;pending:number};
  tasks:{total:number;completed:number};
  todayCompleted:number; completionPercentage:number;
}
interface Data { userProductivity:UserStat[]; coding:{pending:number;completed:number;byStatus:Record<string,number>}; totals:{claims:number;authorizations:number;pendingSignoffs:number}; }

export default function ProductivityPage() {
  const [data, setData] = useState<Data|null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/productivity').then(r=>r.json()).then(d=>{if(d.userProductivity)setData(d);}).catch(console.error).finally(()=>setLoading(false));
  }, []);

  if (loading) return <AppLayout title="Productivity"><div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"/></div></AppLayout>;
  if (!data) return <AppLayout title="Productivity"><p className="text-center text-slate-500 py-12">Failed to load</p></AppLayout>;

  return (
    <AppLayout title="Productivity Dashboard">
      {/* Global Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          {label:'Total Claims',value:data.totals.claims,icon:FileText,color:'bg-blue-100 text-blue-600'},
          {label:'Total Authorizations',value:data.totals.authorizations,icon:ShieldCheck,color:'bg-purple-100 text-purple-600'},
          {label:'Coding Pending',value:data.coding.pending,icon:Code,color:'bg-amber-100 text-amber-600'},
          {label:'Pending Sign-offs',value:data.totals.pendingSignoffs,icon:CheckCircle,color:'bg-emerald-100 text-emerald-600'},
        ].map(s=>(
          <Card key={s.label}><div className="flex items-center justify-between">
            <div><p className="text-sm text-slate-500">{s.label}</p><p className="text-2xl font-bold text-slate-900 mt-1">{s.value}</p></div>
            <div className={`p-3 rounded-xl ${s.color}`}><s.icon className="w-6 h-6"/></div>
          </div></Card>
        ))}
      </div>

      {/* User Productivity Table */}
      <Card>
        <CardHeader title="Team Productivity" subtitle="Performance overview for all team members"/>
        {data.userProductivity.length === 0 ? <p className="text-slate-500 text-center py-8">No team members</p> : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50"><tr>
                {['Team Member','Claims','Auth','Tasks','Today','Completion'].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-slate-200">
                {data.userProductivity.map(u=>(
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">{u.name.split(' ').map(n=>n[0]).join('')}</div>
                        <div><p className="font-medium text-slate-900">{u.name}</p><p className="text-xs text-slate-500">{u.role.replace('_',' ')}</p></div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm"><span className="font-medium text-emerald-600">{u.claims.completed}</span><span className="text-slate-400"> / {u.claims.total}</span></div>
                      <div className="flex gap-1 mt-1">{u.claims.pending>0 && <Badge variant="warning" size="sm">{u.claims.pending} pending</Badge>}{u.claims.denied>0 && <Badge variant="danger" size="sm">{u.claims.denied} denied</Badge>}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm"><span className="font-medium text-emerald-600">{u.authorizations.completed}</span><span className="text-slate-400"> / {u.authorizations.total}</span></div>
                      {u.authorizations.pending>0 && <Badge variant="warning" size="sm">{u.authorizations.pending} pending</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm"><span className="font-medium text-emerald-600">{u.tasks.completed}</span><span className="text-slate-400"> / {u.tasks.total}</span></div>
                    </td>
                    <td className="px-4 py-3"><span className="text-lg font-bold text-blue-600">{u.todayCompleted}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-200 rounded-full h-2 min-w-[60px]"><div className={`h-2 rounded-full ${u.completionPercentage>=80?'bg-emerald-500':u.completionPercentage>=50?'bg-amber-500':'bg-red-500'}`} style={{width:`${u.completionPercentage}%`}}/></div>
                        <span className="text-sm font-medium text-slate-700">{u.completionPercentage}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Coding Summary */}
      <Card className="mt-6">
        <CardHeader title="Coding Queue Summary"/>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Object.entries(data.coding.byStatus).map(([status, count]) => (
            <div key={status} className="p-3 bg-slate-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-slate-900">{count}</p>
              <p className="text-xs text-slate-500 mt-1">{status.replace(/_/g,' ')}</p>
            </div>
          ))}
          {Object.keys(data.coding.byStatus).length === 0 && <p className="col-span-5 text-center text-slate-500 py-4">No coding requests yet</p>}
        </div>
      </Card>
    </AppLayout>
  );
}
