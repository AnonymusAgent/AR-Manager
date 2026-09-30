import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { authorizations, authDocuments, users } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    const [auth] = await db.select().from(authorizations).where(eq(authorizations.id, id)).limit(1);
    if (!auth) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    let assignee = null;
    if (auth.assignedTo) {
      const [u] = await db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.id, auth.assignedTo)).limit(1);
      assignee = u;
    }

    const docs = await db.select({ id: authDocuments.id, fileName: authDocuments.fileName, mimeType: authDocuments.mimeType, fileSize: authDocuments.fileSize, createdAt: authDocuments.createdAt }).from(authDocuments).where(eq(authDocuments.authId, id)).orderBy(desc(authDocuments.createdAt));

    return NextResponse.json({ authorization: { ...auth, assignee }, documents: docs });
  } catch (error) {
    console.error('Get authorization error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const body = await request.json();

    const [existing] = await db.select().from(authorizations).where(eq(authorizations.id, id)).limit(1);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (body.status !== undefined) {
      updateData.status = body.status;
      if (body.status === 'completed') {
        updateData.completedAt = new Date();
        updateData.completedBy = user.id;
        if (body.authNumber) updateData.authNumber = body.authNumber;
        if (body.dateObtained) updateData.dateObtained = body.dateObtained;
      }
    }
    if (body.patientName !== undefined) updateData.patientName = body.patientName;
    if (body.insuranceName !== undefined) updateData.insuranceName = body.insuranceName;
    if (body.authNumber !== undefined) updateData.authNumber = body.authNumber;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.dateObtained !== undefined) updateData.dateObtained = body.dateObtained;
    if (body.expirationDate !== undefined) updateData.expirationDate = body.expirationDate;

    const [updated] = await db.update(authorizations).set(updateData).where(eq(authorizations.id, id)).returning();

    await createAuditLog({ userId: user.id, action: 'authorization_updated', entityType: 'authorization', entityId: id, previousValue: { status: existing.status }, newValue: { status: updated.status } });

    return NextResponse.json({ authorization: updated });
  } catch (error) {
    console.error('Update authorization error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
