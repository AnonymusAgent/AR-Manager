import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { payments, paymentAllocations, claims, claimStatusHistory } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20');

    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(payments);
    const rows = await db.select().from(payments).orderBy(desc(payments.createdAt)).limit(limit).offset((page - 1) * limit);

    return NextResponse.json({ payments: rows, pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) } });
  } catch (error) {
    console.error('Get payments error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { paymentType, payerName, paymentDate, checkNumber, totalAmount, notes, allocations } = body;

    if (!paymentType || !paymentDate || !totalAmount) return NextResponse.json({ error: 'Payment type, date, and amount are required' }, { status: 400 });
    if (parseFloat(totalAmount) <= 0) return NextResponse.json({ error: 'Payment amount must be positive' }, { status: 400 });

    // Create payment
    const [payment] = await db.insert(payments).values({
      paymentType, payerName, paymentDate, checkNumber, totalAmount: String(totalAmount),
      allocatedAmount: '0', unallocatedAmount: String(totalAmount),
      notes, status: 'pending', postedBy: user.id,
    }).returning();

    // Process allocations if provided
    let totalAllocated = 0;
    if (allocations && Array.isArray(allocations)) {
      for (const alloc of allocations) {
        if (!alloc.claimId) continue;
        const insPayment = parseFloat(alloc.insurancePayment || '0');
        const contractAdj = parseFloat(alloc.contractualAdjustment || '0');
        const patResp = parseFloat(alloc.patientResponsibility || '0');

        totalAllocated += insPayment;

        // Prevent over-allocation
        if (totalAllocated > parseFloat(totalAmount)) {
          return NextResponse.json({ error: `Allocated amount ($${totalAllocated.toFixed(2)}) exceeds payment amount ($${parseFloat(totalAmount).toFixed(2)})` }, { status: 400 });
        }

        await db.insert(paymentAllocations).values({
          paymentId: payment.id, claimId: alloc.claimId,
          insurancePayment: String(insPayment), contractualAdjustment: String(contractAdj),
          patientResponsibility: String(patResp), otherAdjustment: String(alloc.otherAdjustment || '0'),
          carcCode: alloc.carcCode, rarcCode: alloc.rarcCode, remarks: alloc.remarks,
          postedBy: user.id,
        });

        // Update claim
        const [claim] = await db.select().from(claims).where(eq(claims.id, alloc.claimId)).limit(1);
        if (claim) {
          const currentPaid = parseFloat(String(claim.paidAmount || '0'));
          const billed = parseFloat(String(claim.billedAmount || '0'));
          const newPaid = currentPaid + insPayment;
          const newBalance = billed - newPaid - contractAdj;
          const newStatus = newBalance <= 0 ? 'paid' : claim.status;

          await db.update(claims).set({
            paidAmount: String(newPaid), balance: String(Math.max(0, newBalance)),
            status: newStatus as typeof claim.status, updatedAt: new Date(),
          }).where(eq(claims.id, alloc.claimId));

          await db.insert(claimStatusHistory).values({
            claimId: alloc.claimId, previousStatus: claim.status, newStatus: newStatus as typeof claim.status,
            changedBy: user.id, reason: `Payment posted: $${insPayment.toFixed(2)} (Check: ${checkNumber || 'N/A'})`,
          });
        }
      }
    }

    // Update payment totals
    await db.update(payments).set({
      allocatedAmount: String(totalAllocated),
      unallocatedAmount: String(parseFloat(totalAmount) - totalAllocated),
      status: totalAllocated > 0 ? 'posted' : 'pending',
    }).where(eq(payments.id, payment.id));

    await createAuditLog({ userId: user.id, action: 'payment_created', entityType: 'payment', entityId: payment.id, newValue: { paymentType, totalAmount, allocations: allocations?.length || 0 } });

    return NextResponse.json({ payment });
  } catch (error) {
    console.error('Create payment error:', error);
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
  }
}
