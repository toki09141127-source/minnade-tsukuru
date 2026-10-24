/* eslint-disable @typescript-eslint/no-require-imports -- Offline browser test, never a deployed module. */
const assert = require('node:assert/strict');
assert.equal(process.env.AUTH_CALLBACK_OFFLINE_TEST, 'true');
const user = { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'callback@example.invalid', app_metadata: {}, user_metadata: {} };
const token = 'offline-callback-test';
const original = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return original(input, init);
  if (url.hostname === 'fwqucffxdmbdczspkcyr.supabase.co' && url.pathname === '/auth/v1/user') {
    const auth = new Headers(init?.headers || input.headers).get('authorization');
    return Response.json(auth === 'Bearer ' + token ? user : { code: 'bad_jwt', message: 'Offline test rejected' }, { status: auth === 'Bearer ' + token ? 200 : 401 });
  }
  throw new Error('OFFLINE_NETWORK_BLOCKED');
};
module.exports = { user, token };
