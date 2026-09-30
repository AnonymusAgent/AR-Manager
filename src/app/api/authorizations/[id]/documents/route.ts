import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { authDocuments, authorizations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    const [auth] = await db.select().from(authorizations).where(eq(authorizations.id, id)).limit(1);
    if (!auth) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'File required' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const [doc] = await db.insert(authDocuments).values({
      authId: id, fileName: file.name, fileData: buffer.toString('base64'),
      mimeType: file.type, fileSize: file.size, uploadedBy: user.id,
    }).returning();

    return NextResponse.json({ document: { id: doc.id, fileName: doc.fileName, mimeType: doc.mimeType, createdAt: doc.createdAt } });
  } catch (error) {
    console.error('Upload auth document error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
