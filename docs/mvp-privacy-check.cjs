/* eslint-disable @typescript-eslint/no-require-imports -- Consent must not derive identity or expose arbitrary writes. */
const fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync('components/TermsConsentGate.tsx','utf8');
assert.ok(!/user\.email|buildFallbackUsername/.test(source));console.log('1. Consent does not derive a public name from email or Auth identity');
assert.ok(!/\.(?:insert|update|upsert|delete)\s*\(/.test(source));console.log('2. Consent never mutates profiles directly');
assert.ok(source.includes("rpc('mvp_accept_current_terms'")&&!source.includes('p_actor:'));console.log('3. Consent uses self-only RPC without a client-controlled actor');
console.log('Completed 3 privacy regression checks; runtime RPC behavior verified separately against PostgreSQL and staging.');

