// Engine regression tests — run: node tests/denial-analysis.test.mjs
import assert from 'node:assert';
import { classifyDenialCategory, isDeniedClaim, analyzeDenial, toRecommendedActions } from '../src/lib/denial-analysis.ts';

const claim = (over = {}) => ({ status: 'denied', claimNumber: 'C1', balance: '800', billedAmount: '1000', paidAmount: '0', ...over });
const dc = (code, category, description) => ({ code, codeType: 'CARC', description, category });

// 1. Category is authoritative: a Timely Filing code whose note/description mentions
//    "procedure" must NOT be misclassified as Coding (the old text-OR bug).
assert.equal(classifyDenialCategory('Timely Filing', 'The time limit for filing has expired for this procedure', ''), 'Timely Filing');
// 2. Contractual adjustments (49 seeded codes) reach the fee/contractual branch, not General.
assert.equal(classifyDenialCategory('Contractual', 'Prompt-pay discount', ''), 'Fee Schedule / Contractual');
// 3. Bundling stays Bundling, not generic Coding.
assert.equal(classifyDenialCategory('Bundling', 'Benefit included in another service', ''), 'Bundling');
// 4. Patient-responsibility CARCs (deductible etc.)
assert.equal(classifyDenialCategory('Patient Responsibility', 'Deductible Amount', ''), 'Patient Responsibility');
// 5. Text fallback only when category is missing, and it is specific-first.
assert.equal(classifyDenialCategory(null, 'Exact duplicate claim/service', ''), 'Duplicate');
assert.equal(classifyDenialCategory(null, 'The authorization number is missing', ''), 'Authorization');
assert.equal(classifyDenialCategory(null, 'Some entirely novel payer wording', ''), 'General');
// 6. End-to-end: CARC 29 (timely filing) analyzes as Timely Filing even with a "procedure" description.
assert.equal(analyzeDenial(claim(), dc('29', 'Timely Filing', 'The time limit for filing has expired'), [], [], []).denialCategory, 'Timely Filing');
// 7. CARC 97 bundling analyzes as Bundling with coding-style steps.
const b = analyzeDenial(claim(), dc('97', 'Bundling', 'Benefit included in payment for another service/procedure'), [], [], []);
assert.equal(b.denialCategory, 'Bundling');
// 8. Paid/closed claims are not "denied" just because denial data is attached.
assert.equal(isDeniedClaim({ status: 'paid', denialCodeId: 5, denialReason: 'old denial' }), false);
assert.equal(isDeniedClaim({ status: 'closed', denialReason: 'x' }), false);
assert.equal(isDeniedClaim({ status: 'denied' }), true);
assert.equal(isDeniedClaim({ status: 'in_progress', claimInsuranceStatus: 'denied' }), true);
assert.equal(isDeniedClaim({ status: 'in_progress', denialReason: 'payer denied' }), true);
assert.equal(isDeniedClaim({ status: 'in_progress' }), false);
// 9. Structured recommended actions (the API page contract) with honest success rate.
const acts = toRecommendedActions(['Step one', 'Step two'], -1);
assert.equal(acts[0].priority, 1); assert.equal(acts[0].successRate, null);
assert.equal(toRecommendedActions(['x'], 75)[0].successRate, 75);
// 10. Historical success rate is computed from resolved outcomes.
const h = analyzeDenial(claim(), dc('15', 'Authorization', 'Authorization missing'), [], [], [{ outcome: 'recovered', actionTaken: 'appeal' }, { outcome: 'written_off', actionTaken: 'appeal' }]);
assert.equal(h.historicalSuccessRate, 50); assert.equal(h.historicalMatchCount, 2);
console.log('denial-analysis: all 10 regression checks passed');
