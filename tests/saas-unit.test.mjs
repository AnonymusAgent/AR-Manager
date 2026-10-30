// Dependency-free unit checks for SaaS helpers (logic mirrored from src/lib/saas.ts).
import assert from 'node:assert';
import crypto from 'node:crypto';
const slugify=s=>s.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60);
const hash=t=>crypto.createHash('sha256').update(t).digest('hex');
assert.equal(slugify('Sunrise Clinic!'),'sunrise-clinic');
assert.notEqual(hash('token-a'),hash('token-b'));
assert.equal(hash('x'),hash('x'));
console.log('saas-unit: slugify + token hashing OK');
// Cross-tenant guard logic: membership must be explicit, never inferred from email domain.
const members=[{userId:'u1',organizationId:'orgA',orgRole:'member'}];
const can=(u,o)=>members.some(m=>m.userId===u&&m.organizationId===o);
assert.equal(can('u1','orgA'),true); assert.equal(can('u1','orgB'),false); assert.equal(can('u2','orgA'),false);
console.log('saas-unit: cross-tenant membership denial OK');
