import { test } from 'node:test';
import assert from 'node:assert/strict';
import type OpenAI from 'openai';
import { handleAppraisal, publicConfig } from '../server/appraise';
import { demoAppraisal } from '../src/lib/demo';

const image = `data:image/jpeg;base64,${Buffer.from([255,216,255,224,0,0,0,0,0,0,0,0]).toString('base64')}`;
let called = 0;
const fakeClient = () => ({ responses: { parse: async () => { called++; return { status: 'completed', output_parsed: demoAppraisal }; } } }) as unknown as OpenAI;

test('does not expose secrets in configuration', () => {
  assert.deepEqual(publicConfig({ apiKey: 'secret', accessToken: 'private' }), { aiAvailable: true, requiresAccessToken: true });
});
test('missing key, incorrect passphrase and invalid images never call AI', async () => {
  const before = called;
  assert.equal((await handleAppraisal({ image }, {}, 'missing', '', fakeClient)).status, 503);
  assert.equal((await handleAppraisal({ image }, { apiKey: 'test', accessToken: 'secret' }, 'unauthorized', 'wrong', fakeClient)).status, 401);
  assert.equal((await handleAppraisal({ image: 'bad' }, { apiKey: 'test' }, 'invalid', '', fakeClient)).status, 400);
  assert.equal(called, before);
});
test('returns validated structured appraisal', async () => {
  const result = await handleAppraisal({ image }, { apiKey: 'test' }, 'success', '', fakeClient);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.appraisal, demoAppraisal);
});
test('refusal and incomplete outputs do not become successful appraisals', async () => {
  for (const response of [{ status: 'completed', output_parsed: null }, { status: 'incomplete', output_parsed: demoAppraisal }]) {
    const stub = () => ({ responses: { parse: async () => response } }) as unknown as OpenAI;
    assert.equal((await handleAppraisal({ image }, { apiKey: 'test' }, `bad-${response.status}`, '', stub)).status, 502);
  }
});
test('rejects AI output outside application bounds', async () => {
  const stub = () => ({ responses: { parse: async () => ({ status: 'completed', output_parsed: { ...demoAppraisal, name: 'x'.repeat(61) } }) } }) as unknown as OpenAI;
  assert.equal((await handleAppraisal({ image }, { apiKey: 'test' }, 'bounds', '', stub)).status, 502);
});
test('sixth request in one minute is limited', async () => {
  for (let i = 0; i < 5; i++) assert.equal((await handleAppraisal({ image }, { apiKey: 'test' }, 'limited-client', '', fakeClient)).status, 200);
  assert.equal((await handleAppraisal({ image }, { apiKey: 'test' }, 'limited-client', '', fakeClient)).status, 429);
});
