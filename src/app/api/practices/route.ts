import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { practices, userPracticeAssignments, users } from '@/db/schema';
import { eq, and, ilike, or, desc, sql } from 'drizzle-orm';
import { getCurrentUser, canAssignPractices } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');
    const isActive = searchParams.get('isActive');

    const conditions = [];

    if (search) {
      conditions.push(
        or(
          ilike(practices.name, `%${search}%`),
          ilike(practices.code, `%${search}%`)
        )
      );
    }

    if (isActive !== null && isActive !== undefined) {
      conditions.push(eq(practices.isActive, isActive === 'true'));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const result = await db
      .select()
      .from(practices)
      .where(whereClause)
      .orderBy(desc(practices.createdAt));

    return NextResponse.json({ practices: result });
  } catch (error) {
    console.error('Get practices error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch practices' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !canAssignPractices(currentUser.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { name, code, address, phone, email, npi, taxId, specialty } = body;

    if (!name || !code) {
      return NextResponse.json(
        { error: 'Name and code are required' },
        { status: 400 }
      );
    }

    // Check if code already exists
    const [existing] = await db
      .select()
      .from(practices)
      .where(eq(practices.code, code))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: 'Practice with this code already exists' },
        { status: 400 }
      );
    }

    const [newPractice] = await db
      .insert(practices)
      .values({
        name,
        code,
        address,
        phone,
        email,
        npi,
        taxId,
        specialty,
      })
      .returning();

    await createAuditLog({
      userId: currentUser.id,
      action: 'practice_created',
      entityType: 'practice',
      entityId: newPractice.id,
      newValue: { name, code },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({ practice: newPractice });
  } catch (error) {
    console.error('Create practice error:', error);
    return NextResponse.json(
      { error: 'Failed to create practice' },
      { status: 500 }
    );
  }
}
