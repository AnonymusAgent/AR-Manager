import { NextResponse } from 'next/server';
import { db } from '@/db';
import { claims, users } from '@/db/schema';
import { eq, sql, and, inArray, gte } from 'drizzle-orm';
import { getCurrentUser, isSupervisorOrAbove } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const isSuper = isSupervisorOrAbove(user.role) || user.role === 'team_lead';

    // Workflow counts
    const wfCounts = await db.select({
      workflowStatus: claims.workflowStatus,
      count: sql<number>`count(*)::int`,
    }).from(claims).where(
      !isSuper ? eq(claims.assignedTo, user.id) : undefined
    ).groupBy(claims.workflowStatus);

    const wf: Record<string, number> = {};
    wfCounts.forEach(c => { wf[c.workflowStatus || 'unworked'] = c.count; });

    // Insurance status counts (for Record tab)
    const insCounts = await db.select({
      claimInsuranceStatus: claims.claimInsuranceStatus,
      count: sql<number>`count(*)::int`,
    }).from(claims).where(
      !isSuper ? eq(claims.assignedTo, user.id) : undefined
    ).groupBy(claims.claimInsuranceStatus);

    const ins: Record<string, number> = {};
    insCounts.forEach(c => { ins[c.claimInsuranceStatus || 'none'] = c.count; });

    // Today's stats for the user
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const [todayWorked] = await db.select({ count: sql<number>`count(*)::int` }).from(claims)
      .where(and(eq(claims.workedBy, user.id), gte(claims.workedDate, today)));
    const [todaySubmitted] = await db.select({ count: sql<number>`count(*)::int` }).from(claims)
      .where(and(eq(claims.workedBy, user.id), gte(claims.submittedForApprovalAt, today)));
    const [todayApproved] = await db.select({ count: sql<number>`count(*)::int` }).from(claims)
      .where(and(eq(claims.approvedBy, user.id), gte(claims.approvedAt, today)));

    return NextResponse.json({
      workflow: {
        unworked: wf['unworked'] || 0,
        working: wf['working'] || 0,
        pending_approval: wf['pending_approval'] || 0,
        rework: wf['rework'] || 0,
        approved: wf['approved'] || 0,
        dead: wf['dead'] || 0,
      },
      insuranceStatus: ins,
      today: {
        worked: todayWorked.count,
        submitted: todaySubmitted.count,
        approved: todayApproved.count,
      },
    });
  } catch (error) {
    console.error('Counts error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
