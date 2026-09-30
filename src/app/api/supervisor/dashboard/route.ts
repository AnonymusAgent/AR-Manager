import { NextResponse } from 'next/server';
import { db } from '@/db';
import { claims, billingTasks, signoffs, users, taskDocuments, userPracticeAssignments, practices } from '@/db/schema';
import { eq, sql, and, gte, inArray } from 'drizzle-orm';
import { getCurrentUser, isSupervisorOrAbove } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || !isSupervisorOrAbove(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get claims summary
    const claimStats = await db
      .select({
        status: claims.status,
        count: sql<number>`count(*)::int`,
      })
      .from(claims)
      .groupBy(claims.status);

    const claimsByStatus: Record<string, number> = {};
    claimStats.forEach(s => {
      claimsByStatus[s.status] = s.count;
    });

    // Get tasks summary
    const taskStats = await db
      .select({
        status: billingTasks.status,
        count: sql<number>`count(*)::int`,
      })
      .from(billingTasks)
      .groupBy(billingTasks.status);

    const tasksByStatus: Record<string, number> = {};
    taskStats.forEach(s => {
      tasksByStatus[s.status] = s.count;
    });

    // Get tasks by category
    const tasksByCategory = await db
      .select({
        category: billingTasks.category,
        count: sql<number>`count(*)::int`,
      })
      .from(billingTasks)
      .groupBy(billingTasks.category);

    // Get pending signoffs
    const [pendingSignoffs] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(signoffs)
      .where(eq(signoffs.status, 'pending'));

    // Get pending document reviews
    const [pendingDocuments] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(taskDocuments)
      .where(eq(taskDocuments.status, 'pending'));

    // Get user productivity (tasks and claims completed today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const userProductivity = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
      })
      .from(users)
      .where(
        and(
          eq(users.isActive, true),
          inArray(users.role, ['ar_executive', 'billing_user'])
        )
      );

    const productivityData = await Promise.all(
      userProductivity.map(async (u) => {
        const [tasksCompleted] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(billingTasks)
          .where(
            and(
              eq(billingTasks.completedBy, u.id),
              gte(billingTasks.completedAt, today)
            )
          );

        const [totalAssignedTasks] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(billingTasks)
          .where(eq(billingTasks.assignedTo, u.id));

        const [totalAssignedClaims] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(claims)
          .where(eq(claims.assignedTo, u.id));

        const [practiceCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(userPracticeAssignments)
          .where(eq(userPracticeAssignments.userId, u.id));

        return {
          id: u.id,
          name: `${u.firstName} ${u.lastName}`,
          role: u.role,
          tasksCompletedToday: tasksCompleted.count,
          totalAssignedTasks: totalAssignedTasks.count,
          totalAssignedClaims: totalAssignedClaims.count,
          practiceCount: practiceCount.count,
        };
      })
    );

    // Get practice summary
    const [totalPractices] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(practices)
      .where(eq(practices.isActive, true));

    // Get recent signoffs pending review
    const recentPendingSignoffs = await db
      .select({
        id: signoffs.id,
        entityType: signoffs.entityType,
        submittedAt: signoffs.submittedAt,
        submittedBy: signoffs.submittedBy,
      })
      .from(signoffs)
      .where(eq(signoffs.status, 'pending'))
      .orderBy(sql`${signoffs.submittedAt} DESC`)
      .limit(5);

    const signoffsWithNames = await Promise.all(
      recentPendingSignoffs.map(async (s) => {
        const [submitter] = await db
          .select({ firstName: users.firstName, lastName: users.lastName })
          .from(users)
          .where(eq(users.id, s.submittedBy))
          .limit(1);

        return {
          ...s,
          submitterName: submitter ? `${submitter.firstName} ${submitter.lastName}` : 'Unknown',
        };
      })
    );

    return NextResponse.json({
      claims: {
        total: Object.values(claimsByStatus).reduce((a, b) => a + b, 0),
        byStatus: claimsByStatus,
      },
      tasks: {
        total: Object.values(tasksByStatus).reduce((a, b) => a + b, 0),
        byStatus: tasksByStatus,
        byCategory: tasksByCategory,
      },
      signoffs: {
        pending: pendingSignoffs.count,
      },
      documents: {
        pendingReview: pendingDocuments.count,
      },
      practices: {
        total: totalPractices.count,
      },
      userProductivity: productivityData,
      recentPendingSignoffs: signoffsWithNames,
    });
  } catch (error) {
    console.error('Supervisor dashboard error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
