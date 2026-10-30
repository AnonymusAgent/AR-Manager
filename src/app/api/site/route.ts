import { NextResponse } from 'next/server';
import { getSiteContent } from '@/lib/site-content';
export const dynamic = 'force-dynamic';
export async function GET() { return NextResponse.json({ content: await getSiteContent() }); }
