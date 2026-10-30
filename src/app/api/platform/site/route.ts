import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { siteSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { requirePlatformAdmin } from '@/lib/platform-admin';
import { getSiteContent, mergeSiteContent } from '@/lib/site-content';
import { createAuditLog } from '@/lib/audit';
const guard = requirePlatformAdmin;
export async function GET() { if (!await guard()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); return NextResponse.json({ content: await getSiteContent() }); }
export async function PUT(req: NextRequest) {
  const admin = await guard(); if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid content' }, { status: 400 });
  const content = mergeSiteContent(body);
  const [existing] = await db.select().from(siteSettings).where(eq(siteSettings.key, 'main')).limit(1);
  if (existing) await db.update(siteSettings).set({ value: content, updatedBy: admin.id, updatedAt: new Date() }).where(eq(siteSettings.key, 'main'));
  else await db.insert(siteSettings).values({ key: 'main', value: content, updatedBy: admin.id });
  await createAuditLog({ userId: admin.id, action: 'site_content_updated', entityType: 'site_settings', entityId: 'main', newValue: { brandName: content.brandName, sections: Object.keys(body) } });
  return NextResponse.json({ success: true, content });
}
