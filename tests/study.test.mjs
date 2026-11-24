import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  blankState, checkAnswer, finishRun, lessonProgress, makeBackup,
  parseBackup, saveAnswer, startRun,
} from '../site/study.mjs';

const word = { id: 1, en: 'take part', gloss: 'v. 参加；参与 / n. （正式）参与', variants: ['take part in'] };

test('the exported edition preserves the complete unit structure', () => {
  const bank = JSON.parse(readFileSync(new URL('../site/bank.json', import.meta.url), 'utf8'));
  assert.equal(bank.chapters.length, 4);
  const units = bank.chapters.flatMap(chapter => chapter.units);
  assert.deepEqual(units.map(unit => unit.id), Array.from({ length: 64 }, (_, i) => i + 1));
  assert.ok(units.every(unit => unit.blocks.flatMap(block => block.ids).length === 14));
  const blocks = units.flatMap(unit => unit.blocks);
  assert.equal(blocks.filter(block => block.tag).length, 108);
  assert.deepEqual(blocks[0].ids, [1, 95, 552]);
  assert.equal(new Set(blocks.flatMap(block => block.ids)).size, 896);
  assert.equal(Object.values(bank.words).filter(entry => entry.notes).length, 367);
  assert.equal(bank.words[1].gloss, 'n. 营养；营养摄入；营养学');
});

test('normalizes English spacing and accepts only listed variants', () => {
  assert.equal(checkAnswer(word, 'zh-en', '  TAKE   PART  '), 'correct');
  assert.equal(checkAnswer(word, 'zh-en', 'take part in'), 'correct');
  assert.equal(checkAnswer(word, 'zh-en', 'take parts'), 'wrong');
});

test('accepts dictionary senses and asks for self-assessment on unmatched Chinese', () => {
  assert.equal(checkAnswer(word, 'en-zh', '参与。'), 'correct');
  assert.equal(checkAnswer(word, 'en-zh', '参加；参与'), 'correct');
  assert.equal(checkAnswer(word, 'en-zh', '加入其中'), 'pending');
  assert.equal(checkAnswer(word, 'en-zh', '  '), 'skipped');
});

test('a mistake in one direction is independent of progress in the other', () => {
  const state = blankState();
  saveAnswer(state, word, 1, 'zh-en', 'wrong', 'take parts');
  saveAnswer(state, word, 1, 'en-zh', 'correct', '参加');
  assert.deepEqual(Object.keys(state.errors), ['zh-en:1']);
  assert.equal(lessonProgress(state, [1, 2], 'zh-en').correct, 0);
  assert.equal(lessonProgress(state, [1, 2], 'en-zh').correct, 1);
  saveAnswer(state, word, 1, 'zh-en', 'correct', 'take part', true);
  assert.equal(state.errors['zh-en:1'].active, false);
  assert.equal(state.errors['zh-en:1'].count, 1);
  assert.equal(state.errors['zh-en:1'].review.result, 'correct');
});

test('skip and pending do not create mistakes or erase a prior response', () => {
  const state = blankState();
  saveAnswer(state, word, 1, 'zh-en', 'wrong', 'typo');
  saveAnswer(state, word, 1, 'zh-en', 'skipped', '');
  saveAnswer(state, word, 1, 'en-zh', 'pending', '加入');
  const progress = lessonProgress(state, [1, 2], 'zh-en');
  assert.equal(progress.answered, 1);
  assert.equal(state.errors['zh-en:1'].count, 1);
  assert.equal(state.errors['zh-en:1'].lastAnswer, 'typo');
  assert.equal(lessonProgress(state, [1, 2], 'en-zh').answered, 0);
});

test('a submitted run classifies drafts and saves each mistake once', () => {
  const state = blankState();
  const words = { 1: word, 2: { id: 2, en: 'work', gloss: 'v. 工作' } };
  const run = startRun(state, 'unit:1:zh-en', 'zh-en', [1, 2]);
  run.drafts[1] = 'typo';
  assert.deepEqual(finishRun(state, run, words, () => 1), { 1: 'wrong', 2: 'skipped' });
  finishRun(state, run, words, () => 1);
  assert.equal(state.errors['zh-en:1'].count, 1);
  assert.equal(state.attempts['zh-en:2'], undefined);
});

test('backup restores preview, drafts and errors and rejects mismatched data', () => {
  const bank = {
    edition: 'fixture', words: { 1: word },
    chapters: [{ units: [{ id: 1, blocks: [{ ids: [1] }] }] }],
  };
  const state = blankState();
  state.preview[1] = '2026-11-24T12:00:00.000Z';
  startRun(state, 'unit:1:en-zh', 'en-zh', [1]).drafts[1] = '参与';
  saveAnswer(state, word, 1, 'zh-en', 'wrong', 'typo');
  const backup = makeBackup(state, bank);
  assert.deepEqual(parseBackup(JSON.stringify(backup), bank), state);
  assert.throws(() => parseBackup(JSON.stringify({ ...backup, version: 2 }), bank));
  backup.state.errors['zh-en:1'].unit = 64;
  assert.throws(() => parseBackup(JSON.stringify(backup), bank));
});
