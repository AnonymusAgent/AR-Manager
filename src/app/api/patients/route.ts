import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { patients, claims } from '@/db/schema';
import { eq, and, or, ilike, desc, sql } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const sp = request.nextUrl.searchParams;
    const search = sp.get('search');
    const page = parseInt(sp.get('page') || '1');
    const limit = parseInt(sp.get('limit') || '20');

    const conditions = [eq(patients.isActive, true)];
    if (search) {
      conditions.push(or(
        ilike(patients.firstName, `%${search}%`),
        ilike(patients.lastName, `%${search}%`),
        ilike(patients.phone, `%${search}%`),
        ilike(patients.memberId, `%${search}%`),
        ilike(patients.email, `%${search}%`)
      )!);
    }

    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(patients).where(and(...conditions));
    const rows = await db.select().from(patients).where(and(...conditions)).orderBy(desc(patients.createdAt)).limit(limit).offset((page - 1) * limit);

    return NextResponse.json({ patients: rows, pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) } });
  } catch (error) {
    console.error('Get patients error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { firstName, lastName, middleName, dateOfBirth, gender, address, city, state, zip, phone, email, memberId, groupNumber, subscriberName, relationshipToSubscriber } = body;

    if (!firstName || !lastName) return NextResponse.json({ error: 'First and last name are required' }, { status: 400 });

    // Duplicate detection
    const dupeConditions = [ilike(patients.firstName, firstName), ilike(patients.lastName, lastName)];
    if (dateOfBirth) dupeConditions.push(eq(patients.dateOfBirth, dateOfBirth));
    const [dupe] = await db.select({ id: patients.id }).from(patients).where(and(...dupeConditions)).limit(1);
    
    const [patient] = await db.insert(patients).values({
      firstName, lastName, middleName, dateOfBirth, gender, address, city, state, zip, phone, email, memberId, groupNumber, subscriberName, relationshipToSubscriber,
    }).returning();

    await createAuditLog({ userId: user.id, action: 'patient_created', entityType: 'patient', entityId: patient.id, newValue: { firstName, lastName } });

    return NextResponse.json({ patient, duplicateWarning: dupe ? 'A similar patient record already exists. Please verify.' : null });
  } catch (error) {
    console.error('Create patient error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
