import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantByHostname } from '@/lib/saas';
// Public, safe: returns only org name/branding for a verified hostname — never data. Used to brand login pages.
export async function GET(req: NextRequest) {
  const host = req.nextUrl.searchParams.get('host') || req.headers.get('host') || '';
  const r = await resolveTenantByHostname(host);
  if ('error' in r) return NextResponse.json({ tenant: null, error: r.error }, { status: 404 });
  return NextResponse.json({ tenant: { id: r.org.id, name: r.org.name, slug: r.org.slug, logoUrl: r.org.logoUrl, primaryColor: r.org.primaryColor } });
}
