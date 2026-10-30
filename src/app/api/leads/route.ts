import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { leads } from '@/db/schema';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(getClientIp(req), 'leads'); if (!rl.allowed) return NextResponse.json({ error: 'Too many submissions' }, { status: 429 });
  const b = await req.json();
  if (b.website) return NextResponse.json({ success: true }); // honeypot — silently drop bots
  if (!b.name || !b.email || !/^\S+@\S+\.\S+$/.test(b.email)) return NextResponse.json({ error: 'Name and a valid email are required' }, { status: 400 });
  const [lead] = await db.insert(leads).values({ type: ['contact','sales','demo'].includes(b.type) ? b.type : 'contact', name: String(b.name).slice(0,255), email: String(b.email).toLowerCase(), organization: b.organization||null, phone: b.phone||null, message: b.message ? String(b.message).slice(0,5000) : null }).returning();
  return NextResponse.json({ success: true, id: lead.id }, { status: 201 });
}
