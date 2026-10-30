import { NextResponse } from 'next/server';
import { ensureDefaultPlans } from '@/lib/saas';
export async function GET() { try { const p = await ensureDefaultPlans(); return NextResponse.json({ plans: p.filter(x=>x.isActive).sort((a,b)=>a.sortOrder-b.sortOrder) }); } catch { return NextResponse.json({ error: 'Failed to load plans' }, { status: 500 }); } }
