import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser, verifyPassword, hashPassword } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { currentPassword, newPassword, confirmPassword } = await request.json();

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: 'Current password, new password, and confirmation are all required.' },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: 'New password and confirmation do not match.' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'New password must be at least 8 characters long.' },
        { status: 400 }
      );
    }

    // Fetch user password hash
    const [userRecord] = await db
      .select({ id: users.id, passwordHash: users.passwordHash, email: users.email })
      .from(users)
      .where(eq(users.id, sessionUser.id))
      .limit(1);

    if (!userRecord) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const isMatch = await verifyPassword(currentPassword, userRecord.passwordHash);
    if (!isMatch) {
      return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 });
    }

    // Check that new password is not identical to current
    const isSame = await verifyPassword(newPassword, userRecord.passwordHash);
    if (isSame) {
      return NextResponse.json(
        { error: 'New password must be different from current password.' },
        { status: 400 }
      );
    }

    const newHash = await hashPassword(newPassword);

    await db
      .update(users)
      .set({
        passwordHash: newHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, sessionUser.id));

    await createAuditLog({
      userId: sessionUser.id,
      action: 'password_changed',
      entityType: 'user_security',
      entityId: sessionUser.id,
      newValue: { email: userRecord.email, action: 'password_updated' },
      ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully. Your account is secured.',
    });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json({ error: 'Failed to change password. Please try again.' }, { status: 500 });
  }
}
