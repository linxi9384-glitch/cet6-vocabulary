import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  blankState, checkAnswer, finishRun, lessonProgress, makeBackup,
  parseBackup, saveAnswer, shuffledIds, startRun,
} from '../site/study.mjs';

const word = { id: 1, en: 'take part', gloss: 'v. 参加；参与 / n. （正式）参与', variants: ['take part in'] };
const bank = JSON.parse(readFileSync(new URL('../site/bank.json', import.meta.url), 'utf8'));

test('the exported edition preserves the complete unit structure', () => {
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

test('English fill-ins tolerate iPad handwriting whitespace without forgiving misspellings', () => {
  const nutrition = bank.words[1];
  for (const direction of ['zh-en', 'dictation']) {
    assert.equal(checkAnswer(nutrition, direction, 'nu\u00a0tri\u3000tion'), 'correct');
    assert.equal(checkAnswer(word, direction, 'ta ke pa\u200brt in'), 'correct');
    assert.equal(checkAnswer(nutrition, direction, 'nutri ton'), 'wrong');
    assert.equal(checkAnswer(nutrition, direction, '\u200b\u3000'), 'skipped');
  }
});

test('English-to-Chinese selections grade directly and preserve old typed rounds', async () => {
  const { wordChoices } = await import('../site/study.mjs');
  const state = blankState();
  const ids = bank.chapters[0].units[0].blocks.flatMap(block => block.ids);
  const key = 'unit:1:en-zh';
  const run = startRun(state, key, 'en-zh', ids);
  const [rightId, wrongId] = ids;
  const options = wordChoices(bank.words, wrongId, run.choiceSeed);
  assert.equal(options.length, 4);
  assert.equal(new Set(options.map(option => option.gloss)).size, 4);
  assert.equal(options.filter(option => option.id === wrongId).length, 1);
  assert.deepEqual(wordChoices(bank.words, wrongId, run.choiceSeed), options);
  run.drafts[rightId] = rightId;
  const selected = options.find(option => option.id !== wrongId);
  run.drafts[wrongId] = selected.id;
  const restored = parseBackup(JSON.stringify(makeBackup(state, bank)), bank);
  const grades = finishRun(restored, restored.runs[key], bank.words, () => 1);
  assert.equal(grades[rightId], 'correct');
  assert.equal(grades[wrongId], 'wrong');
  assert.equal(restored.errors['en-zh:' + wrongId].lastAnswer, selected.gloss);
  run.drafts[wrongId] = 9999;
  assert.throws(() => parseBackup(JSON.stringify(makeBackup(state, bank)), bank));
  delete run.choiceSeed;
  run.drafts[rightId] = '营养';
  run.drafts[wrongId] = '待考证';
  const legacy = finishRun(state, run, bank.words, () => 1);
  assert.equal(legacy[rightId], 'correct');
  assert.equal(legacy[wrongId], 'pending');
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

test('shuffle samples across the selected scope without duplicates', () => {
  const chapter = bank.chapters[1].units.flatMap(unit => unit.blocks.flatMap(block => block.ids));
  const random = () => 0.9999;
  const sample = shuffledIds(bank, 2, 20, random);
  assert.equal(sample.length, 20);
  assert.equal(new Set(sample).size, 20);
  assert.equal(sample[0], chapter.at(-1));
  assert.ok(sample.every(id => chapter.includes(id)));
  const whole = shuffledIds(bank, 0, 40, random);
  assert.equal(new Set(whole).size, 40);
  assert.ok(whole.some(id => !chapter.includes(id)));
});

test('backup preserves shuffled IDs and rejects duplicates or wrong chapters', () => {
  const state = blankState();
  const key = 'shuffle:2:en-zh';
  const run = startRun(state, key, 'en-zh', shuffledIds(bank, 2, 10, () => 0.9999));
  run.index = 1;
  run.drafts[run.ids[1]] = 'draft';
  const parse = () => parseBackup(JSON.stringify(makeBackup(state, bank)), bank);
  assert.deepEqual(parse().runs[key], run);

  const first = run.ids[0];
  run.ids[0] = run.ids[1];
  assert.throws(parse);
  run.ids[0] = 1;
  assert.throws(parse);
  run.ids[0] = first;
  run.ids.pop();
  assert.throws(parse);
});

test('dictation grades English spelling and tracks its own mistakes', () => {
  const state = blankState();
  const ids = shuffledIds(bank, 0, 10, () => 0);
  const run = startRun(state, 'dictation:0:dictation', 'dictation', ids);
  const [first, second] = ids;
  run.drafts[first] = `  ${bank.words[first].en.toUpperCase()} `;
  run.drafts[second] = 'intentionally misspelled';
  assert.equal(checkAnswer(word, 'dictation', '  TAKE  PART IN  '), 'correct');
  assert.deepEqual(Object.values(finishRun(state, run, bank.words, () => 1)).sort(),
    ['correct', ...Array(8).fill('skipped'), 'wrong']);
  assert.deepEqual(Object.keys(state.errors), [`dictation:${second}`]);
  assert.equal(lessonProgress(state, ids, 'zh-en').answered, 0);
  assert.equal(lessonProgress(state, ids, 'dictation').correct, 1);

  const review = startRun(state, 'review:1:dictation', 'dictation', [second]);
  review.drafts[second] = bank.words[second].en;
  finishRun(state, review, bank.words, () => 1, true);
  assert.equal(state.errors[`dictation:${second}`].active, false);
  assert.deepEqual(parseBackup(JSON.stringify(makeBackup(state, bank)), bank), state);
});

test('backup rejects dictation rounds outside their chapter or under a translation route', () => {
  const state = blankState();
  const ids = shuffledIds(bank, 1, 10, () => 0);
  const read = () => parseBackup(JSON.stringify(makeBackup(state, bank)), bank);
  startRun(state, 'dictation:1:dictation', 'dictation', ids);
  assert.deepEqual(read(), state);
  startRun(state, 'dictation:2:dictation', 'dictation', ids);
  assert.throws(read);
  delete state.runs['dictation:2:dictation'];
  startRun(state, 'shuffle:1:dictation', 'dictation', ids);
  assert.throws(read);
});
