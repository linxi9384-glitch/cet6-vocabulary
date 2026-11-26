import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

test('the original workbook keeps its six scanned page ranges and answer keys', async () => {
  const { papers, examChoices } = await import('../site/exams.mjs');
  const original = papers.filter(paper => !paper.source);
  assert.deepEqual(original.map(({ first, last }) => [first, last]), [[3, 9], [10, 16], [17, 24], [25, 32], [33, 40], [41, 48]]);
  for (const paper of original) {
    assert.equal(paper.key.length, 55, paper.id);
    [...paper.key].forEach((letter, index) => assert.ok(examChoices(index + 1).includes(letter), paper.id));
    assert.equal(new Set(paper.key.slice(25, 35)).size, 10, paper.id);
  }
  assert.equal(original[0].key.slice(25, 35), 'NKOMAGDECI');
  assert.equal(original.at(-1).key.slice(45), 'BACDBADACD');
});

test('exam grading counts wrong and unanswered questions separately and excludes written drafts', async () => {
  const { blankExam, gradeExam, papers, validExamRuns } = await import('../site/exams.mjs');
  const paper = papers.find(item => item.id === '2023-06-1');
  const run = blankExam(paper);
  run.answers = { 1: 'B', 2: 'D', 26: 'N', 36: 'C', 55: 'D' };
  run.writing = 'A draft essay';
  assert.deepEqual(gradeExam(paper, run), { correct: 4, wrong: 1, skipped: 50 });
  assert.ok(validExamRuns({ [paper.id]: run }));
  assert.equal(validExamRuns({ unknown: run }), false);
  assert.equal(validExamRuns({ [paper.id]: { ...run, page: paper.last + 1 } }), false);
  assert.equal(validExamRuns({ [paper.id]: { ...run, answers: { 1: 'M' } } }), false);
  assert.equal(validExamRuns({ [paper.id]: { ...run, answers: { '001': 'B' } } }), false);
});

test('an omitted listening section is neither selectable nor scored as unanswered', async () => {
  const { blankExam, examChoices, examFirst, gradeExam, papers, validExamContent } = await import('../site/exams.mjs');
  const original = papers.find(paper => paper.id === '2023-06-1');
  const paper = { ...original, key: '-'.repeat(25) + original.key.slice(25) };
  const content = JSON.parse(readFileSync(new URL('../site/exam-data/2023-06-1.json', import.meta.url)));
  assert.ok(validExamContent(paper, { ...content, listening: Array(25).fill(null) }));
  assert.equal(validExamContent(paper, content), false);
  assert.equal(examFirst(paper), 26);
  assert.equal(examChoices(1, paper), '');
  assert.deepEqual(gradeExam(paper, blankExam(paper)), { correct: 0, wrong: 0, skipped: 30 });
});

test('recordings cover every playable listening section and match the source editions', async () => {
  const { examAudio } = await import('../site/exam-audio-data.mjs');
  const { examFirst, papers } = await import('../site/exams.mjs');
  const ids = papers.filter(paper => examFirst(paper) === 1).map(paper => paper.id);
  assert.deepEqual(Object.keys(examAudio).sort(), ids.sort());
  const hashes = new Set();
  for (const [id, track] of Object.entries(examAudio)) {
    assert.match(track.sha256, /^[a-f0-9]{64}$/, id);
    assert.ok(track.bytes > 0 && Number.isSafeInteger(track.bytes), id);
    assert.ok(!hashes.has(track.sha256), id);
    hashes.add(track.sha256);
    for (const url of [track.url, track.fallbackUrl, track.originalUrl, track.sourceUrl]) {
      assert.equal(new URL(url).protocol, 'https:', id);
    }
    assert.notEqual(track.url, track.fallbackUrl, id);
  }
  assert.match(examAudio['2024-06-1'].sourceUrl, /2024-06\/02\/meta\.json$/);
  assert.match(examAudio['2024-06-2'].sourceUrl, /2024-06\/01\/meta\.json$/);
  assert.equal(examAudio['2024-06-1'].sha256, 'fac9987f4ecb6ba750134dcb05e6553b8b8afb6d9da8febd3c31cdf0a435b74c');
  assert.equal(examAudio['2024-06-2'].sha256, '98f87cce756cf13824d13b3014b9d62294327d7d3d2784f01b8ba83483b73517');
  assert.match(examAudio['2022-09-1'].sourceUrl, /1e5e11\/CET46-Resources\//);
});

test('topic saves are restricted to one paper and question type', async () => {
  const { validExamTopicRuns } = await import('../site/exams.mjs');
  assert.ok(validExamTopicRuns({ '2023-06-1:matching': { position: 37, answers: { 36: 'C' }, writing: '', translation: '', submitted: true } }));
  assert.equal(validExamTopicRuns({ '2023-06-1:matching': { position: 37, answers: { 26: 'N' }, writing: '', translation: '', submitted: false } }), false);
  assert.equal(validExamTopicRuns({ '2023-06-1:matching': { position: 35, answers: {}, writing: '', translation: '', submitted: false } }), false);
});

test('the four new exam dates preserve every set, valid answer and explanation page', async () => {
  const { examChoices, examFirst, examScan, papers } = await import('../site/exams.mjs');
  const added = papers.filter(paper => paper.source);
  assert.equal(added.length, 12);
  assert.equal(papers.length, 18);
  for (const date of ['2024-06', '2024-12', '2025-06', '2025-12']) {
    assert.deepEqual(added.filter(paper => paper.source === date).map(paper => paper.id).sort(),
      [1, 2, 3].map(set => date + '-' + set));
  }
  for (const paper of added) {
    const first = examFirst(paper);
    assert.equal(first, paper.id.endsWith('-3') ? 26 : 1, paper.id);
    assert.ok(paper.first > 0 && paper.last >= paper.first && paper.last <= examScan(paper).pages, paper.id);
    assert.equal(paper.key.length, 55, paper.id);
    for (let number = 1; number <= 55; number += 1) {
      const valid = number < first ? '-' : examChoices(number, paper);
      assert.ok(valid.includes(paper.key[number - 1]), paper.id + ' Q' + number);
    }
    for (const id of ['listening', 'cloze', 'matching', 'reading1', 'reading2', 'writing', 'translation']) {
      const pages = paper.explanationPages[id];
      assert.equal(pages.length === 0, id === 'listening' && first === 26, paper.id + ' ' + id);
      for (const page of pages) {
        assert.ok(existsSync(new URL('../site/exam-explanations/' + paper.source + '/' + page + '.webp', import.meta.url)), paper.id + ' ' + id + ' ' + page);
      }
    }
  }
});

test('every paper has complete selectable questions and source material for all sections', async () => {
  const { examChoices, papers, validExamContent } = await import('../site/exams.mjs');
  for (const paper of papers) {
    const data = JSON.parse(readFileSync(new URL('../site/exam-data/' + paper.id + '.json', import.meta.url)));
    assert.ok(validExamContent(paper, data), paper.id);
    assert.equal(examChoices(36, paper).length, data.matching.paragraphs.length, paper.id);
    assert.equal(validExamContent(paper, { ...data, listening: data.listening.slice(1) }), false);
    assert.equal(validExamContent(paper, { ...data, cloze: { ...data.cloze, options: data.cloze.options.slice(1) } }), false);
    assert.equal(validExamContent(paper, { ...data, reading: data.reading.slice(1) }), false);
  }
});
