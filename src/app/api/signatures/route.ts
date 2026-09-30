import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { eSignatures, users } from '@/db/schema';
import { eq, desc, sql, and, gte, lte } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const sp = request.nextUrl.searchParams;
    const page = parseInt(sp.get('page') || '1');
    const limit = parseInt(sp.get('limit') || '20');

    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(eSignatures);

    const rows = await db.select({
      id: eSignatures.id, documentType: eSignatures.documentType, documentTitle: eSignatures.documentTitle,
      signerName: eSignatures.signerName, signerRole: eSignatures.signerRole, signedAt: eSignatures.signedAt,
      relatedClaimId: eSignatures.relatedClaimId, relatedEntityType: eSignatures.relatedEntityType,
    }).from(eSignatures).orderBy(desc(eSignatures.createdAt)).limit(limit).offset((page - 1) * limit);

    return NextResponse.json({ signatures: rows, pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) } });
  } catch (error) {
    console.error('Get signatures error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { documentType, documentTitle, documentContent, signatureData, signerName, signerRole, relatedClaimId, relatedEntityType, relatedEntityId } = body;

    if (!signatureData || !signerName || !documentTitle) {
      return NextResponse.json({ error: 'Signature data, signer name, and document title are required' }, { status: 400 });
    }

    const [sig] = await db.insert(eSignatures).values({
      documentType: documentType || 'general', documentTitle, documentContent,
      signatureData, signerName, signerRole: signerRole || user.role,
      signerEmail: user.email, ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || undefined,
      relatedClaimId, relatedEntityType, relatedEntityId, signedBy: user.id,
    }).returning();

    await createAuditLog({ userId: user.id, action: 'document_signed', entityType: 'eSignature', entityId: sig.id, newValue: { documentTitle, signerName, documentType } });

    return NextResponse.json({ signature: sig });
  } catch (error) {
    console.error('Create signature error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
