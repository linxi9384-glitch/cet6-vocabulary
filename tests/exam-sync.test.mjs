import assert from 'node:assert/strict';
import { test } from 'node:test';
import { blankExam, papers } from '../site/exams.mjs';
import { mergeExamProgress, createExamSync } from '../site/exam-sync.mjs';

const id = '2023-06-1';
const run = answers => ({ ...blankExam(papers.find(paper => paper.id === id)), answers });
const progress = answers => ({ exams: { [id]: run(answers) }, examTopics: {} });

test('first sign-in keeps answers from both devices and retains the account answer on conflict', () => {
  const result = mergeExamProgress(undefined, progress({ 1: 'A', 2: 'B' }), progress({ 1: 'C', 3: 'D' }));
  assert.deepEqual(result.exams[id].answers, { 1: 'C', 2: 'B', 3: 'D' });
});

test('a known baseline preserves independent edits, deletions and restarts', () => {
  const base = progress({ 1: 'A', 2: 'B' });
  const local = progress({ 2: 'C' });
  const remote = progress({ 1: 'A', 2: 'B', 3: 'D' });
  assert.deepEqual(mergeExamProgress(base, local, remote).exams[id].answers, { 2: 'C', 3: 'D' });
  const submitted = progress({ 1: 'A' });
  submitted.exams[id].submitted = true;
  assert.deepEqual(mergeExamProgress(submitted, progress({}), submitted), progress({}));
});

test('sign-in and resume synchronize two devices, retry concurrent writes and preserve a pending local edit', async () => {
  const url = 'https://example.supabase.co';
  const session = { access_token: 'synthetic', refresh_token: 'synthetic-refresh', expires_in: 3600,
    user: { id: '80e5ef34-cf06-488c-a0b9-50c9249cf702', email: 'whitemu@cet6.invalid' } };
  const store = new Map();
  let row;
  let injectConflict = true;
  const request = async (url, options) => {
    const path = new URL(url);
    const body = options.body && JSON.parse(options.body);
    const send = (value, status = 200) => new Response(JSON.stringify(value), { status });
    if (path.pathname === '/auth/v1/token') {
      assert.equal(body.email, session.user.email);
      return send(session);
    }
    assert.equal(options.headers.Authorization, 'Bearer synthetic');
    if (options.method === 'GET') return send(row ? [row] : []);
    if (options.method === 'POST' && injectConflict) {
      injectConflict = false;
      row = { revision: 1, progress: progress({ 2: 'B' }) };
      return send({}, 409);
    }
    if (options.method === 'PATCH' && path.searchParams.get('revision') !== 'eq.' + row.revision) return send([]);
    row = body;
    return send([row]);
  };
  const make = storage => createExamSync({ url, key: 'sb_publishable_test-key', request, storage: {
    getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key),
  } });
  let a = progress({ 1: 'A' });
  const one = make(store);
  await one.signIn('WhiteMu', 'test-password');
  await one.sync(() => a, value => { a = value; });
  assert.deepEqual(a.exams[id].answers, { 1: 'A', 2: 'B' });
  const resumed = make(store);
  assert.equal(resumed.signedIn, true);
  assert.ok(![...store.values()].join().includes('test-password'));
  let b = progress({ 3: 'C' });
  const two = make(new Map());
  await two.signIn('WhiteMu', 'test-password');
  await two.sync(() => b, value => { b = value; });
  a.exams[id].answers[4] = 'D';
  await resumed.sync(() => a, value => { a = value; });
  assert.deepEqual(a.exams[id].answers, { 1: 'A', 2: 'B', 3: 'C', 4: 'D' });
  await two.sync(() => b, value => { b = value; });
  assert.deepEqual(b, a);
});
