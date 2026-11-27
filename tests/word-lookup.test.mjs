import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeLookup, findDefinition, saveWord } from '../site/word-lookup.mjs';
import { blankState, makeBackup, parseBackup } from '../site/study.mjs';

const bank = {
  edition: 'test',
  words: { 1: { id: 1, en: 'nourishment', gloss: '\u8425\u517b' } },
  chapters: [{ id: 1, units: [{ id: 1, blocks: [{ ids: [1] }] }] }],
};

test('accepts selected words and phrases with typographic punctuation', () => {
  assert.equal(normalizeLookup('\u201cDidn\u2019t  give up!\u201d'), "didn't give up");
  assert.equal(normalizeLookup('take\n over'), 'take over');
  assert.equal(normalizeLookup('\u7b2c\u4e00\u9898'), '');
  assert.equal(normalizeLookup('a very long selection of several words in a sentence'), '');
});

test('prefers study glosses, accepts dictionary inflections, and distinguishes missing entries from offline', async () => {
  const shards = { s: { spacious: ['spacious', '\u5bbd\u655e\u7684'], spaces: ['space', '\u7a7a\u95f4'] } };
  const source = async key => shards[key] ?? {};
  assert.deepEqual(await findDefinition('Nourishment', bank.words, async () => assert.fail()), bank.words[1]);
  assert.deepEqual(await findDefinition('spaces', bank.words, source), { en: 'space', gloss: '\u7a7a\u95f4' });
  assert.deepEqual(await findDefinition('zzunknown', bank.words, source), { en: 'zzunknown', gloss: '' });
  await assert.rejects(findDefinition('spaces', bank.words, async () => { throw new Error('unavailable'); }), /unavailable/);
});

test('keeps one saved entry per word and restores it from current or older backups', () => {
  const state = blankState();
  assert.equal(saveWord(state, { en: 'Space', gloss: '\u7a7a\u95f4' }), true);
  assert.equal(saveWord(state, { en: 'space', gloss: '' }), false);
  assert.deepEqual(parseBackup(JSON.stringify(makeBackup(state, bank)), bank).wordbook, state.wordbook);
  const legacy = blankState();
  delete legacy.wordbook;
  assert.deepEqual(parseBackup(JSON.stringify(makeBackup(legacy, bank)), bank).wordbook, {});
  state.wordbook.space.gloss = [];
  assert.throws(() => parseBackup(JSON.stringify(makeBackup(state, bank)), bank), /备份/);
});
