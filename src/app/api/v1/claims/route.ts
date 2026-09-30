import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { claims } from '@/db/schema';
import { desc, ilike, or, sql, eq } from 'drizzle-orm';
import { authenticateApiKey } from '@/lib/api-auth';
import { getCurrentUser } from '@/lib/auth';

async function getAuth(request: NextRequest) {
  // Try API key first, then session cookie
  const apiAuth = await authenticateApiKey(request);
  if (apiAuth) return apiAuth.user;
  return getCurrentUser();
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuth(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const sp = request.nextUrl.searchParams;
    const search = sp.get('search');
    const page = parseInt(sp.get('page') || '1');
    const limit = Math.min(parseInt(sp.get('limit') || '50'), 100);

    const conditions = [];
    if (search) conditions.push(or(ilike(claims.claimNumber, `%${search}%`), ilike(claims.patientName, `%${search}%`)));

    const whereClause = conditions.length > 0 ? conditions[0] : undefined;
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(claims).where(whereClause);

    const rows = await db.select({
      id: claims.id, claimNumber: claims.claimNumber, accountNumber: claims.accountNumber,
      patientName: claims.patientName, dateOfService: claims.dateOfService, cptCodes: claims.cptCodes,
      provider: claims.provider, insurance: claims.insurance, billedAmount: claims.billedAmount,
      paidAmount: claims.paidAmount, balance: claims.balance, status: claims.status, createdAt: claims.createdAt,
    }).from(claims).where(whereClause).orderBy(desc(claims.createdAt)).limit(limit).offset((page - 1) * limit);

    return NextResponse.json({ data: rows, meta: { page, limit, total: count, totalPages: Math.ceil(count / limit) } });
  } catch (error) {
    console.error('API v1 claims error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
