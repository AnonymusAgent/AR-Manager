import { NextRequest, NextResponse } from 'next/server';
import { logout, getCurrentUser } from '@/lib/auth';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/audit';
import { cookies } from 'next/headers';
import { getSessionCookieOptions } from '@/lib/cookie-config';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;

    if (token) {
      await logout(token);
    }

    if (user) {
      await createAuditLog({
        userId: user.id,
        action: AUDIT_ACTIONS.USER_LOGOUT,
        entityType: 'user',
        entityId: user.id,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || undefined,
      });
    }

    const response = NextResponse.json({ success: true });

    // Clear session cookie with matching options
    response.cookies.set('session', '', {
      ...getSessionCookieOptions(),
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    const response = NextResponse.json({ success: true });
    response.cookies.set('session', '', {
      ...getSessionCookieOptions(),
      maxAge: 0,
    });
    return response;
  }
}
