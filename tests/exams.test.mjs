import assert from 'node:assert/strict';
import { test } from 'node:test';

test('the six scanned papers cover their original pages and have valid keys for all 55 objective questions', async () => {
  const { papers, examChoices } = await import('../site/exams.mjs');
  assert.deepEqual(papers.map(({ first, last }) => [first, last]), [[3, 9], [10, 16], [17, 24], [25, 32], [33, 40], [41, 48]]);
  for (const paper of papers) {
    assert.equal(paper.key.length, 55, paper.id);
    [...paper.key].forEach((letter, index) => assert.ok(examChoices(index + 1).includes(letter), paper.id));
    assert.equal(new Set(paper.key.slice(25, 35)).size, 10, paper.id);
  }
  assert.equal(papers[0].key.slice(25, 35), 'NKOMAGDECI');
  assert.equal(papers.at(-1).key.slice(45), 'BACDBADACD');
});

test('exam grading counts wrong and unanswered questions separately and excludes written drafts', async () => {
  const { blankExam, gradeExam, papers, validExamRuns } = await import('../site/exams.mjs');
  const paper = papers[0];
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
