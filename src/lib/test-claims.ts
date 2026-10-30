/** Deterministic synthetic test claims (no real patient data) — exactly 50.
    Pure generator so it can be unit-tested without a database. */
export interface TestClaim {
  claimNumber: string; accountNumber: string; patientName: string; dateOfService: string;
  cptCodes: string; diagnosisCode: string; provider: string; insurance: string; payer: string;
  billedAmount: string; paidAmount: string; balance: string;
  status: string; workflowStatus: string; claimInsuranceStatus: string | null;
  priority: string; denialReason: string | null; followUpDate: string | null;
}
const PAYERS = ['Aetna', 'Blue Cross Blue Shield', 'Cigna', 'UnitedHealthcare', 'Medicare', 'Humana'];
const PROVIDERS = ['Dr. Test Alpha', 'Dr. Test Beta', 'Dr. Test Gamma', 'Dr. Test Delta'];
const CPTS = ['99213', '99214', '99203', '93000', '36415', '71046', '97110', '20610'];
const DIAGS = ['I10', 'E11.9', 'M54.5', 'J06.9', 'K21.9', 'M25.511'];
const FLOW: [string, string, string | null][] = [
  // status, workflowStatus, insuranceStatus — spread so every queue/tab has data
  ['new', 'unworked', 'in_process'], ['new', 'unworked', null], ['assigned', 'unworked', 'in_process'],
  ['in_progress', 'working', 'in_process'], ['pending', 'working', null],
  ['submitted_for_review', 'pending_approval', 'in_process'], ['approved', 'approved', 'processed'],
  ['rework_required', 'rework', 'rejected'], ['denied', 'working', 'denied'], ['denied', 'unworked', 'denied'],
  ['paid', 'approved', 'processed'], ['closed', 'approved', 'closed'],
  ['sent_to_coding', 'working', 'denied'], ['in_progress', 'working', 'in_process'], ['denied', 'working', 'denied'],
];
const isoDaysAgo = (days: number) => { const d = new Date(); d.setDate(d.getDate() - days); return d.toISOString().slice(0, 10); };

export function generateTestClaims(count = 50): TestClaim[] {
  const out: TestClaim[] = [];
  for (let i = 0; i < count; i++) {
    const n = i + 1;
    const [status, workflowStatus, claimInsuranceStatus] = FLOW[i % FLOW.length];
    const billed = 120 + ((i * 137) % 2400);
    const paid = status === 'paid' ? billed : status === 'approved' ? Math.round(billed * 0.8) : status === 'denied' || status === 'closed' ? 0 : Math.round(billed * (i % 3) * 0.2);
    out.push({
      claimNumber: `TEST-CLM-${String(n).padStart(3, '0')}`,
      accountNumber: `TEST-ACCT-${String(n).padStart(3, '0')}`,
      patientName: `Test Patient ${String(n).padStart(2, '0')}`,
      dateOfService: isoDaysAgo(5 + (i * 3) % 110),
      cptCodes: CPTS[i % CPTS.length], diagnosisCode: DIAGS[i % DIAGS.length],
      provider: PROVIDERS[i % PROVIDERS.length], insurance: PAYERS[i % PAYERS.length], payer: PAYERS[i % PAYERS.length],
      billedAmount: billed.toFixed(2), paidAmount: paid.toFixed(2), balance: (billed - paid).toFixed(2),
      status, workflowStatus, claimInsuranceStatus,
      priority: i % 7 === 0 ? 'high' : i % 3 === 0 ? 'low' : 'normal',
      denialReason: status === 'denied' || status === 'sent_to_coding' ? 'Test denial — see denial code library' : null,
      followUpDate: workflowStatus === 'working' ? isoDaysAgo(-((i % 5) + 1)) : null,
    });
  }
  return out;
}
