import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { apiKeys } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'administrator') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const keys = await db.select({
      id: apiKeys.id, name: apiKeys.name, keyPrefix: apiKeys.keyPrefix,
      permissions: apiKeys.permissions, lastUsedAt: apiKeys.lastUsedAt,
      expiresAt: apiKeys.expiresAt, isActive: apiKeys.isActive, createdAt: apiKeys.createdAt,
    }).from(apiKeys).orderBy(desc(apiKeys.createdAt));

    return NextResponse.json({ apiKeys: keys });
  } catch (error) {
    console.error('Get API keys error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'administrator') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const { name, permissions, expiresInDays } = await request.json();
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

    // Generate a secure API key
    const rawKey = `armgr_${randomUUID().replace(/-/g, '')}`;
    const keyPrefix = rawKey.substring(0, 8);
    const keyHash = await bcrypt.hash(rawKey, 10);

    const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : null;

    const [apiKey] = await db.insert(apiKeys).values({
      name, keyHash, keyPrefix, permissions: permissions || ['read'],
      createdBy: user.id, expiresAt,
    }).returning();

    await createAuditLog({ userId: user.id, action: 'api_key_created', entityType: 'apiKey', entityId: apiKey.id, newValue: { name, keyPrefix } });

    // Return the raw key ONLY on creation — it can never be retrieved again
    return NextResponse.json({ apiKey: { id: apiKey.id, name: apiKey.name, key: rawKey, keyPrefix, expiresAt }, warning: 'Save this key now. It cannot be retrieved again.' });
  } catch (error) {
    console.error('Create API key error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
