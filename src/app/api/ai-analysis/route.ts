import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { denialAnalyses, claims, denialCodes, claimNotes, claimStatusHistory } from '@/db/schema';
import { eq, desc, sql, and } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';

// ===== DENIAL ANALYSIS ENGINE =====
// Determines if a claim is denied based on all available status fields
function isDeniedClaim(claim: Record<string, unknown>): boolean {
  const status = String(claim.status || '').toLowerCase();
  const wfStatus = String(claim.workflowStatus || '').toLowerCase();
  const insStatus = String(claim.claimInsuranceStatus || '').toLowerCase();
  const denialReason = claim.denialReason || claim.denialCodeId;

  return status === 'denied' ||
    insStatus === 'denied' ||
    insStatus === 'rejected' ||
    status.includes('denied') ||
    status.includes('reject') ||
    !!denialReason;
}

// Comprehensive rule-based analysis using ALL available claim data
function analyzeDenial(
  claim: Record<string, unknown>,
  denialCode: { code: string; codeType: string; description: string; category: string | null } | null,
  claimHistory: Array<{ reason: string | null }>,
  claimNotesData: Array<{ note: string }>,
  historicalOutcomes: Array<{ outcome: string | null; actionTaken: string | null }>
) {
  // Gather all denial-related text for analysis
  const code = denialCode?.code || '';
  const codeDesc = denialCode?.description || '';
  const category = denialCode?.category || '';
  const denialReasonText = String(claim.denialReason || '');
  const insurance = String(claim.insurance || '');
  const cptCodes = String(claim.cptCodes || '');
  const balance = parseFloat(String(claim.balance || '0'));
  const billedAmount = parseFloat(String(claim.billedAmount || '0'));
  const paidAmount = parseFloat(String(claim.paidAmount || '0'));

  // Combine all available text for pattern matching
  const allText = `${codeDesc} ${denialReasonText} ${category} ${claimHistory.map(h => h.reason || '').join(' ')} ${claimNotesData.map(n => n.note).join(' ')}`.toLowerCase();

  // Build the analysis result
  let denialCategory = category || 'General';
  let denialReason = '';
  let rootCause = '';
  let severity: 'Critical' | 'High' | 'Medium' | 'Low' = 'Medium';
  const nextSteps: string[] = [];
  const requiredInfo: string[] = [];
  let recommendedAction = '';
  let resubmitRecommendation = '';
  let appealRecommendation = '';
  let payerFollowUp = '';
  let patientResponsibility = '';
  let confidence: 'High' | 'Medium' | 'Low' = 'Medium';
  let recoveryPotential: 'high' | 'medium' | 'low' = 'medium';
  let priorityScore = 50;

  // ===== PATTERN MATCHING AGAINST ALL AVAILABLE DATA =====

  if (category.includes('Authorization') || allText.includes('auth') || allText.includes('precertif') || allText.includes('precert')) {
    denialCategory = 'Authorization';
    denialReason = denialCode ? `${denialCode.codeType}-${denialCode.code}: ${codeDesc}` : 'Authorization was required but was not present or was invalid.';
    rootCause = 'The claim was submitted without the required prior authorization, or the authorization information was missing/invalid on the claim.';
    severity = 'High';
    recommendedAction = 'Verify authorization requirements and obtain the authorization documentation before correcting/resubmitting the claim.';
    nextSteps.push('Verify authorization requirements with the payer.', 'Check whether authorization was obtained before the date of service.', 'If authorization exists, add the authorization number to the claim and resubmit.', 'If not obtained, submit a retroactive authorization request with clinical documentation.', 'If retro-auth is denied, file a formal appeal with medical necessity documentation.');
    requiredInfo.push('Authorization number', 'Authorization effective dates', 'Authorized procedure codes', 'Clinical documentation supporting medical necessity');
    resubmitRecommendation = 'Yes — resubmit with valid authorization number after verification.';
    appealRecommendation = 'File appeal if retro-authorization is denied and clinical necessity is documented.';
    payerFollowUp = 'Contact payer to verify authorization requirements and check retro-auth policy.';
    recoveryPotential = 'medium';
    priorityScore = 75;
    confidence = 'High';

  } else if (category.includes('Eligibility') || allText.includes('eligib') || allText.includes('insured') || allText.includes('member') || allText.includes('coverage') || allText.includes('terminated')) {
    denialCategory = 'Eligibility';
    denialReason = denialCode ? `${denialCode.codeType}-${denialCode.code}: ${codeDesc}` : 'Patient was not eligible or could not be identified as insured on the date of service.';
    rootCause = 'The patient was not eligible for coverage on the date of service, or the member ID / subscriber information did not match payer records.';
    severity = 'High';
    recommendedAction = 'Verify patient eligibility for the date of service and update demographics/insurance information if needed.';
    nextSteps.push('Run a real-time eligibility verification for the date of service.', 'Verify the member ID, group number, and subscriber information.', 'Check if the patient has other/primary coverage (COB issue).', 'Update patient demographics and insurance information.', 'Resubmit with corrected member/subscriber information.');
    requiredInfo.push('Correct member ID', 'Group number', 'Subscriber information', 'Date of birth', 'Eligibility verification result');
    resubmitRecommendation = 'Yes — resubmit with corrected insurance/member information after eligibility verification.';
    payerFollowUp = 'Contact payer to verify member eligibility status for the DOS.';
    recoveryPotential = 'high';
    priorityScore = 80;
    confidence = 'High';

  } else if (category.includes('Coordination') || allText.includes('coordination') || allText.includes('cob') || allText.includes('another payer') || allText.includes('other payer') || allText.includes('primary')) {
    denialCategory = 'Coordination of Benefits';
    denialReason = denialCode ? `${denialCode.codeType}-${denialCode.code}: ${codeDesc}` : 'Claim may be covered by another payer per coordination of benefits.';
    rootCause = 'The payer identified that another insurance may be primary, or COB information is missing/incorrect.';
    severity = 'High';
    recommendedAction = 'Verify coordination of benefits and submit to the correct primary payer first.';
    nextSteps.push('Verify patient\'s primary and secondary insurance coverage.', 'Obtain the primary payer\'s EOB/ERA.', 'Submit to the primary payer first if not already done.', 'Resubmit to the secondary payer with the primary\'s EOB attached.', 'Update COB information in the patient\'s record.');
    requiredInfo.push('Primary insurance EOB', 'COB questionnaire', 'Insurance verification for all active policies');
    resubmitRecommendation = 'Yes — submit to primary payer first, then secondary with primary EOB.';
    payerFollowUp = 'Contact both payers to clarify COB order.';
    recoveryPotential = 'high';
    priorityScore = 78;
    confidence = 'High';

  } else if (category.includes('Coding') || allText.includes('coding') || allText.includes('modifier') || allText.includes('procedure') || allText.includes('cpt') || allText.includes('inconsistent') || allText.includes('bundl')) {
    denialCategory = 'Coding';
    denialReason = denialCode ? `${denialCode.codeType}-${denialCode.code}: ${codeDesc}` : 'Procedure code, modifier, or diagnosis linkage does not meet payer requirements.';
    rootCause = 'Coding error — the submitted CPT/HCPCS/ICD-10 codes, modifiers, or code combinations do not meet payer edit requirements (NCCI, LCD, NCD).';
    severity = 'High';
    recommendedAction = 'Review coding, modifiers, and diagnosis linkage. Send to coding team for correction before resubmission.';
    nextSteps.push('Review the denied CPT/HCPCS codes and modifiers.', 'Check NCCI edit pairs and modifier indicators.', 'Verify ICD-10 diagnosis supports medical necessity for the procedure.', 'Send to certified coder for review and correction.', 'Resubmit corrected claim with appropriate codes and modifiers.');
    requiredInfo.push('Correct CPT/HCPCS codes', 'Appropriate modifiers (25, 59, XE, XP, XS, XU)', 'Supporting ICD-10 diagnosis codes', 'Operative/procedure notes');
    resubmitRecommendation = 'Yes — resubmit with corrected codes after coding review.';
    recoveryPotential = 'high';
    priorityScore = 82;
    confidence = 'High';

  } else if (category.includes('Medical Necessity') || allText.includes('medical necessity') || allText.includes('not medically') || allText.includes('not deemed')) {
    denialCategory = 'Medical Necessity';
    denialReason = denialCode ? `${denialCode.codeType}-${denialCode.code}: ${codeDesc}` : 'Service was denied because medical necessity criteria were not met.';
    rootCause = 'The payer determined that the submitted documentation does not support medical necessity for the billed service.';
    severity = 'High';
    recommendedAction = 'Review clinical documentation and appeal with medical records supporting necessity.';
    nextSteps.push('Review clinical documentation for medical necessity support.', 'Check applicable LCD/NCD coverage criteria.', 'Gather supporting medical records, test results, and physician notes.', 'File a formal appeal with comprehensive clinical documentation.', 'Request peer-to-peer review with payer medical director if applicable.');
    requiredInfo.push('Progress notes', 'Test results/lab reports', 'Physician statement of medical necessity', 'LCD/NCD reference criteria');
    appealRecommendation = 'Yes — file appeal with comprehensive clinical documentation supporting medical necessity.';
    payerFollowUp = 'Request peer-to-peer review if initial appeal is denied.';
    recoveryPotential = 'medium';
    priorityScore = 70;
    confidence = 'High';

  } else if (category.includes('Timely') || allText.includes('timely') || allText.includes('time limit') || allText.includes('filing deadline') || allText.includes('late')) {
    denialCategory = 'Timely Filing';
    denialReason = denialCode ? `${denialCode.codeType}-${denialCode.code}: ${codeDesc}` : 'Claim was received after the payer\'s filing deadline.';
    rootCause = 'The claim was not submitted within the payer\'s timely filing limit, or proof of timely submission was not provided.';
    severity = balance > 500 ? 'High' : 'Medium';
    recommendedAction = 'Gather proof of original timely submission and file an appeal.';
    nextSteps.push('Check the payer\'s timely filing deadline for this claim type.', 'Gather clearinghouse submission reports and timestamps.', 'Check for any prior rejections that may have delayed resubmission.', 'File an appeal with proof of timely filing (clearinghouse report, rejection logs).', 'If no proof exists, determine if the claim should be written off.');
    requiredInfo.push('Clearinghouse submission receipt', 'Original submission date', 'Rejection/acknowledgment logs', 'Payer timely filing policy');
    appealRecommendation = 'Yes — if proof of timely submission exists.';
    recoveryPotential = balance > 500 ? 'medium' : 'low';
    priorityScore = 60;
    confidence = 'Medium';

  } else if (category.includes('Duplicate') || allText.includes('duplicate') || allText.includes('already processed') || allText.includes('previously paid')) {
    denialCategory = 'Duplicate';
    denialReason = denialCode ? `${denialCode.codeType}-${denialCode.code}: ${codeDesc}` : 'Payer identified the claim as a duplicate of a previously processed claim.';
    rootCause = 'The claim was previously submitted and processed. This submission was identified as a duplicate.';
    severity = 'Low';
    recommendedAction = 'Verify the original claim was processed and paid. If the original was denied, resubmit as a corrected claim.';
    nextSteps.push('Check claim history for the original submission.', 'Verify if the original claim was paid.', 'If paid, no further action needed — post the payment.', 'If the original was denied, submit as a corrected claim (frequency type 7) instead of a new submission.', 'Do not resubmit without verifying original claim status.');
    requiredInfo.push('Original claim reference number', 'Original claim adjudication status', 'Payment details if paid');
    resubmitRecommendation = 'Only as a corrected claim (frequency 7) if original was denied. Do not resubmit if already paid.';
    recoveryPotential = 'high';
    priorityScore = 40;
    confidence = 'High';

  } else if (category.includes('Non-Covered') || allText.includes('non-covered') || allText.includes('not covered') || allText.includes('exclusion') || allText.includes('benefit')) {
    denialCategory = 'Non-Covered Service';
    denialReason = denialCode ? `${denialCode.codeType}-${denialCode.code}: ${codeDesc}` : 'The service is not covered under the patient\'s current benefit plan.';
    rootCause = 'The patient\'s insurance plan does not cover this specific service, or the service does not meet the plan\'s coverage criteria.';
    severity = 'Medium';
    recommendedAction = 'Verify patient benefits and determine if patient responsibility or appeal is appropriate.';
    nextSteps.push('Verify the patient\'s benefit plan coverage for the billed service.', 'Check if an ABN (Advance Beneficiary Notice) was signed.', 'If ABN signed, bill the patient for the non-covered amount.', 'If coverage should apply, appeal with supporting documentation.', 'Update the patient\'s responsibility balance accordingly.');
    patientResponsibility = 'May be patient responsibility if the service is confirmed non-covered and ABN was obtained.';
    recoveryPotential = 'low';
    priorityScore = 35;
    confidence = 'Medium';

  } else if (category.includes('Patient Responsibility') || allText.includes('deductible') || allText.includes('coinsurance') || allText.includes('copay')) {
    denialCategory = 'Patient Responsibility';
    denialReason = denialCode ? `${denialCode.codeType}-${denialCode.code}: ${codeDesc}` : 'Amount applied to patient responsibility (deductible, coinsurance, or copay).';
    rootCause = 'The payer applied the amount to patient cost-sharing (deductible, coinsurance, or copay) per the benefit plan.';
    severity = 'Low';
    recommendedAction = 'Bill the patient for their responsibility amount.';
    nextSteps.push('Verify the patient responsibility amount matches the EOB.', 'Send a patient statement for the responsibility amount.', 'Ensure the contractual adjustment is properly posted.', 'Follow up on patient payment per the practice\'s collection policy.');
    patientResponsibility = 'Yes — this amount is confirmed patient responsibility per the benefit plan.';
    recoveryPotential = 'high';
    priorityScore = 25;
    confidence = 'High';

  } else if (category.includes('Documentation') || allText.includes('documentation') || allText.includes('information') || allText.includes('missing') || allText.includes('incomplete') || allText.includes('invalid')) {
    denialCategory = 'Documentation';
    denialReason = denialCode ? `${denialCode.codeType}-${denialCode.code}: ${codeDesc}` : 'Claim lacks required information or has submission/billing errors.';
    rootCause = 'Required information was missing, incomplete, or invalid on the claim submission.';
    severity = 'Medium';
    recommendedAction = 'Identify the specific missing information and resubmit with complete data.';
    nextSteps.push('Review the denial remark codes to identify exactly what information is missing.', 'Gather the required documentation or correct the invalid data.', 'Resubmit the claim with the complete/corrected information.', 'Verify all required fields are populated before resubmission.');
    requiredInfo.push('Check RARC codes for specific missing fields', 'Complete claim data per payer requirements');
    resubmitRecommendation = 'Yes — resubmit with complete and corrected information.';
    recoveryPotential = 'high';
    priorityScore = 65;
    confidence = 'High';

  } else if (category.includes('Fee Schedule') || allText.includes('fee schedule') || allText.includes('exceeds') || allText.includes('contractual') || allText.includes('allowable')) {
    denialCategory = 'Fee Schedule / Contractual';
    denialReason = denialCode ? `${denialCode.codeType}-${denialCode.code}: ${codeDesc}` : 'Charge exceeds fee schedule or contractual rate.';
    rootCause = 'The billed amount exceeds the payer\'s contracted or allowable rate. This is typically a contractual adjustment, not a true denial.';
    severity = 'Low';
    recommendedAction = 'Post as contractual adjustment. Verify payment matches contracted rate.';
    nextSteps.push('Compare the payment to the contracted fee schedule.', 'If payment matches the contracted rate, post the difference as a contractual adjustment.', 'If the payment is below the contracted rate, contact the payer about potential underpayment.', 'No resubmission or appeal is typically needed for contractual adjustments.');
    recoveryPotential = 'low';
    priorityScore = 15;
    confidence = 'High';

  } else {
    // Fallback: use whatever text we have
    denialCategory = category || 'General';
    denialReason = denialCode ? `${denialCode.codeType}-${denialCode.code}: ${codeDesc}` : (denialReasonText || 'Denial reason not specified. Review the remittance advice for detailed denial information.');
    rootCause = denialReasonText ? `Denial based on: ${denialReasonText}` : 'The specific root cause could not be determined from the available claim data. Review the complete remittance advice and any RARC codes for additional details.';
    severity = balance > 1000 ? 'High' : balance > 200 ? 'Medium' : 'Low';
    recommendedAction = 'Review the complete remittance advice, identify all CARC/RARC codes, and determine the appropriate corrective action.';
    nextSteps.push('Review the full remittance advice / EOB for this claim.', 'Identify all CARC and RARC codes on the denial.', 'Contact the payer for clarification if the denial reason is unclear.', 'Determine whether correction, resubmission, or appeal is appropriate.', 'Document all findings and follow-up actions.');
    requiredInfo.push('Complete EOB/ERA', 'All CARC and RARC codes', 'Payer contact information');
    payerFollowUp = 'Contact payer representative for clarification on the denial reason.';
    recoveryPotential = balance > 500 ? 'medium' : 'low';
    priorityScore = balance > 1000 ? 55 : 40;
    confidence = 'Low';
  }

  // Adjust priority by balance
  if (balance > 5000) priorityScore = Math.min(100, priorityScore + 20);
  else if (balance > 1000) priorityScore = Math.min(100, priorityScore + 10);

  // Historical learning
  const successfulOutcomes = historicalOutcomes.filter(h => h.outcome === 'recovered' || h.outcome === 'paid');
  const historicalSuccessRate = historicalOutcomes.length > 0 ? Math.round((successfulOutcomes.length / historicalOutcomes.length) * 100) : -1;

  return {
    denialDetected: true,
    denialCategory,
    denialReason,
    rootCause,
    severity,
    recommendedAction,
    nextSteps,
    requiredInformation: requiredInfo,
    resubmitRecommendation: resubmitRecommendation || 'Review denial details before determining resubmission approach.',
    appealRecommendation: appealRecommendation || 'Consider appeal if the denial appears incorrect based on payer policy.',
    payerFollowUp: payerFollowUp || 'Contact payer if additional clarification is needed.',
    patientResponsibility: patientResponsibility || 'Not applicable — balance should remain with payer/provider until resolved.',
    confidence,
    recoveryPotential,
    priorityScore,
    historicalMatchCount: historicalOutcomes.length,
    historicalSuccessRate,
    claimData: {
      claimNumber: claim.claimNumber, insurance, billedAmount, paidAmount, balance,
      cptCodes, denialCodeUsed: denialCode ? `${denialCode.codeType}-${denialCode.code}` : 'Not specified',
    },
    analyzedAt: new Date().toISOString(),
    disclaimer: 'This analysis is generated based on available claim data and denial code patterns. Recommendations should be verified against payer-specific policies and organizational procedures before action is taken.',
  };
}

// ===== GET: List analyses =====
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20');
    const claimId = request.nextUrl.searchParams.get('claimId');

    const conditions = [];
    if (claimId) conditions.push(eq(denialAnalyses.claimId, claimId));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(denialAnalyses).where(whereClause);

    const rows = await db.select({
      id: denialAnalyses.id, claimId: denialAnalyses.claimId, denialCode: denialAnalyses.denialCode,
      likelyReason: denialAnalyses.likelyReason, recommendedActions: denialAnalyses.recommendedActions,
      recoveryPotential: denialAnalyses.recoveryPotential, priorityScore: denialAnalyses.priorityScore,
      confidenceScore: denialAnalyses.confidenceScore, status: denialAnalyses.status,
      analysisResult: denialAnalyses.analysisResult,
      outcome: denialAnalyses.outcome, createdAt: denialAnalyses.createdAt,
      claimNumber: claims.claimNumber, patientName: claims.patientName, balance: claims.balance,
    }).from(denialAnalyses).leftJoin(claims, eq(denialAnalyses.claimId, claims.id))
      .where(whereClause)
      .orderBy(desc(denialAnalyses.createdAt)).limit(limit).offset((page - 1) * limit);

    return NextResponse.json({ analyses: rows, pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) } });
  } catch (error) {
    console.error('Get analyses error:', error);
    return NextResponse.json({ error: 'Failed to retrieve analyses' }, { status: 500 });
  }
}

// ===== POST: Run analysis =====
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { claimId } = await request.json();
    if (!claimId) return NextResponse.json({ error: 'Claim ID is required' }, { status: 400 });

    const [claim] = await db.select().from(claims).where(eq(claims.id, claimId)).limit(1);
    if (!claim) return NextResponse.json({ error: 'Claim not found' }, { status: 404 });

    // Verify claim is denied
    if (!isDeniedClaim(claim as Record<string, unknown>)) {
      return NextResponse.json({
        error: 'This claim is not denied. AI Denial Analysis is only available for denied claims.',
        claimStatus: claim.status,
      }, { status: 400 });
    }

    // Get denial code details
    let denialCodeData: { code: string; codeType: string; description: string; category: string | null } | null = null;
    if (claim.denialCodeId) {
      const [dc] = await db.select().from(denialCodes).where(eq(denialCodes.id, claim.denialCodeId)).limit(1);
      if (dc) denialCodeData = { code: dc.code, codeType: dc.codeType, description: dc.description, category: dc.category };
    }

    // Get claim history for context
    const history = await db.select({ reason: claimStatusHistory.reason })
      .from(claimStatusHistory).where(eq(claimStatusHistory.claimId, claimId)).orderBy(desc(claimStatusHistory.createdAt)).limit(10);

    // Get claim notes for context
    const notes = await db.select({ note: claimNotes.note })
      .from(claimNotes).where(eq(claimNotes.claimId, claimId)).orderBy(desc(claimNotes.createdAt)).limit(10);

    // Get historical outcomes for similar denials
    const denialCodeStr = denialCodeData?.code || '';
    const historicalOutcomes = denialCodeStr
      ? await db.select({ outcome: denialAnalyses.outcome, actionTaken: denialAnalyses.actionTaken })
          .from(denialAnalyses).where(and(eq(denialAnalyses.denialCode, denialCodeStr), eq(denialAnalyses.status, 'resolved'))).limit(50)
      : [];

    // Run analysis
    const analysis = analyzeDenial(
      claim as Record<string, unknown>,
      denialCodeData,
      history,
      notes,
      historicalOutcomes
    );

    // Save to database
    const [saved] = await db.insert(denialAnalyses).values({
      claimId,
      denialCodeId: claim.denialCodeId,
      denialCode: denialCodeData ? `${denialCodeData.codeType}-${denialCodeData.code}` : (claim.denialReason?.substring(0, 20) || 'unknown'),
      analysisResult: analysis,
      likelyReason: analysis.denialReason,
      recommendedActions: analysis.nextSteps,
      recoveryPotential: analysis.recoveryPotential,
      priorityScore: analysis.priorityScore,
      confidenceScore: String(analysis.confidence === 'High' ? 90 : analysis.confidence === 'Medium' ? 60 : 30),
      historicalMatchCount: analysis.historicalMatchCount,
      status: 'analyzed',
      analyzedBy: user.id,
    }).returning();

    await createAuditLog({
      userId: user.id, action: 'denial_analyzed', entityType: 'denialAnalysis', entityId: saved.id,
      newValue: { claimId, denialCategory: analysis.denialCategory, severity: analysis.severity, recoveryPotential: analysis.recoveryPotential },
    });

    return NextResponse.json({
      analysis: {
        id: saved.id,
        ...analysis,
        claimNumber: claim.claimNumber,
        patientName: claim.patientName,
        balance: claim.balance,
      },
    });
  } catch (error) {
    console.error('Analyze denial error:', error);
    return NextResponse.json({ error: 'Failed to analyze denial. Please try again.' }, { status: 500 });
  }
}
