import { NextResponse } from 'next/server';
import { db } from '@/db';
import { practices, userPracticeAssignments } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { getUserAuthorizedPracticeIds } from '@/lib/rbac';

/**
 * Returns only the practices the current user is authorized to access.
 * Regular users get their assigned practices.
 * Admins/Supervisors/Managers get all active practices.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const authorized = await getUserAuthorizedPracticeIds(user);

    let result: Array<{ id: string; name: string; code: string; specialty: string | null }> = [];
    if (authorized === 'all') {
      result = await db.select({ id: practices.id, name: practices.name, code: practices.code, specialty: practices.specialty })
        .from(practices).where(eq(practices.isActive, true)).orderBy(practices.name);
    } else if (authorized.length === 0) {
      result = [];
    } else {
      result = await db.select({ id: practices.id, name: practices.name, code: practices.code, specialty: practices.specialty })
        .from(practices).where(inArray(practices.id, authorized)).orderBy(practices.name);
    }

    return NextResponse.json({ practices: result });
  } catch (error) {
    console.error('Get my practices error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
