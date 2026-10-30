// Rule-based denial analysis engine (pure, dependency-free — unit tested in tests/denial-analysis.test.mjs).
export interface DenialCodeInfo { code: string; codeType: string; description: string; category: string | null }

export type CanonicalCategory =
  | 'Authorization' | 'Eligibility' | 'Coordination of Benefits' | 'Coding' | 'Bundling'
  | 'Medical Necessity' | 'Timely Filing' | 'Duplicate' | 'Non-Covered Service'
  | 'Patient Responsibility' | 'Documentation' | 'Fee Schedule / Contractual' | 'General';

/** Category-first classification. The CARC category assigned to the code is authoritative;
    free text (notes/history) is only a fallback — previously broad substrings like "procedure"
    or "coverage" in a note silently overrode the real category. */
export function classifyDenialCategory(category: string | null | undefined, description: string, denialReasonText: string): CanonicalCategory {
  const cat = (category || '').toLowerCase();
  const byCategory: [string, CanonicalCategory][] = [
    ['authorization', 'Authorization'], ['eligibility', 'Eligibility'], ['coordination', 'Coordination of Benefits'],
    ['bundling', 'Bundling'], ['bundl', 'Bundling'], ['coding', 'Coding'], ['medical necessity', 'Medical Necessity'],
    ['timely', 'Timely Filing'], ['duplicate', 'Duplicate'], ['non-covered', 'Non-Covered Service'],
    ['patient responsibility', 'Patient Responsibility'], ['documentation', 'Documentation'],
    ['fee schedule', 'Fee Schedule / Contractual'], ['contractual', 'Fee Schedule / Contractual'],
    ['coverage', 'Eligibility'],
  ];
  for (const [needle, result] of byCategory) if (cat.includes(needle)) return result;

  // Fallback: text patterns, most specific first, word-boundary aware.
  const text = `${description} ${denialReasonText}`.toLowerCase();
  const has = (...words: string[]) => words.some(w => new RegExp(`\\b${w}`).test(text));
  if (has('authorization', 'precertification', 'pre-certification', 'prior auth')) return 'Authorization';
  if (has('coordination of benefits', 'another payer', 'other payer is primary', 'primary payer')) return 'Coordination of Benefits';
  if (has('duplicate')) return 'Duplicate';
  if (has('timely filing', 'time limit for filing', 'filing deadline', 'late filing')) return 'Timely Filing';
  if (has('medical necessity', 'not medically necessary', 'not deemed a medical necessity')) return 'Medical Necessity';
  if (has('deductible', 'coinsurance', 'co-payment', 'copayment', 'copay')) return 'Patient Responsibility';
  if (has('non-covered', 'not covered', 'exclusion')) return 'Non-Covered Service';
  if (has('modifier', 'bundled', 'bundling', 'ncci')) return 'Coding';
  if (has('eligibility', 'eligible', 'not an insured', 'coverage terminated', 'member id')) return 'Eligibility';
  if (has('lacks information', 'missing information', 'incomplete information', 'submission/billing error')) return 'Documentation';
  if (has('fee schedule', 'exceeds fee', 'contractual')) return 'Fee Schedule / Contractual';
  return 'General';
}

const CANONICAL_TO_BRANCH: Record<CanonicalCategory, string> = {
  Authorization: 'Authorization', Eligibility: 'Eligibility', 'Coordination of Benefits': 'Coordination of Benefits',
  Coding: 'Coding', Bundling: 'Coding', 'Medical Necessity': 'Medical Necessity', 'Timely Filing': 'Timely Filing',
  Duplicate: 'Duplicate', 'Non-Covered Service': 'Non-Covered', 'Patient Responsibility': 'Patient Responsibility',
  Documentation: 'Documentation', 'Fee Schedule / Contractual': 'Fee Schedule', General: 'General',
};

// Comprehensive rule-based analysis using ALL available claim data
export function analyzeDenial(
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

  // Category-first classification (notes/history no longer override the code's category).
  const canonical = classifyDenialCategory(category, codeDesc, denialReasonText);
  const branch = CANONICAL_TO_BRANCH[canonical];

  void claimHistory; void claimNotesData;
  // Build the analysis result
  let denialCategory = canonical === 'General' ? (category || 'General') : canonical;
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

  if (branch === 'Authorization') {
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

  } else if (branch === 'Eligibility') {
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

  } else if (branch === 'Coordination of Benefits') {
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

  } else if (branch === 'Coding') {
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

  } else if (branch === 'Medical Necessity') {
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

  } else if (branch === 'Timely Filing') {
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

  } else if (branch === 'Duplicate') {
    denialCategory = 'Duplicate';
    denialReason = denialCode ? `${denialCode.codeType}-${denialCode.code}: ${codeDesc}` : 'Payer identified the claim as a duplicate of a previously processed claim.';
    rootCause = 'The claim was previously submitted and processed. This submission was identified as a duplicate.';
    severity = 'Low';
    recommendedAction = 'Verify the original claim was processed and paid. If the original was denied, resubmit as a corrected claim.';
    nextSteps.push('Check claim history for the original submission.', 'Verify if the original claim was paid.', 'If paid, no further action needed — post the payment.', 'If the original was denied, submit as a corrected claim (frequency type 7) instead of a new submission.', 'Do not resubmit without verifying original claim status.');
    requiredInfo.push('Original claim reference number', 'Original claim adjudication status', 'Payment details if paid');
    resubmitRecommendation = 'Only as a corrected claim (frequency 7) if original was denied. Do not resubmit if already paid.';
    recoveryPotential = paidAmount > 0 ? 'low' : 'medium';
    priorityScore = 40;
    confidence = 'High';

  } else if (branch === 'Non-Covered') {
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

  } else if (branch === 'Patient Responsibility') {
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

  } else if (branch === 'Documentation') {
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

  } else if (branch === 'Fee Schedule') {
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

  if (canonical === 'Bundling') denialCategory = 'Bundling';
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

export interface RecommendedAction { action: string; priority: number; description: string; successRate: number | null }
export function toRecommendedActions(nextSteps: string[], historicalSuccessRate: number): RecommendedAction[] {
  return nextSteps.map((step, i) => ({
    action: step.length > 90 ? step.slice(0, 90).trimEnd() + '…' : step,
    priority: i + 1,
    description: step,
    successRate: historicalSuccessRate >= 0 ? historicalSuccessRate : null,
  }));
}

const DENIED_VALUES = new Set(['denied', 'rejected', 'reject', 'denial']);
const SETTLED_VALUES = new Set(['paid', 'closed', 'approved']);
/** A claim counts as denied only when a status actually says so, or it carries denial
    data and has not since been paid/closed/approved (previously ANY claim with a stale
    denialCodeId/denialReason — including paid claims — was treated as denied). */
export function isDeniedClaim(claim: Record<string, unknown>): boolean {
  const status = String(claim.status || '').toLowerCase();
  const ins = String(claim.claimInsuranceStatus || '').toLowerCase();
  if (SETTLED_VALUES.has(status)) return false;
  if (DENIED_VALUES.has(status) || DENIED_VALUES.has(ins) || status.includes('denied')) return true;
  return Boolean(claim.denialCodeId || claim.denialReason);
}
