import { validExamRuns, validExamTopicRuns } from './exams.mjs';
import { validWordbook } from './word-lookup.mjs';

export const directions = ['zh-en', 'en-zh'];
export const practiceDirections = [...directions, 'dictation'];
export const shuffleSizes = [10, 20, 40];
const submitted = ['correct', 'wrong'];
const results = [...submitted, 'skipped', 'pending'];
const answerLimit = 300;
const keyFor = (direction, id) => `${direction}:${id}`;

export function blankState() {
  return { preview: {}, attempts: {}, errors: {}, runs: {}, exams: {}, examTopics: {}, wordbook: {}, lastUnit: 1, voice: 'en-US' };
}

const partOfSpeech = /(^|\s\/\s)([a-z][a-z./-]*\.)\s*/gi;
const english = value => value.normalize('NFKC').toLowerCase().replace(/[\p{White_Space}\u200b\ufeff]+/gu, '');
const chinese = value => value.normalize('NFKC').toLowerCase().replace(/[\s\p{P}…]+/gu, '');
const splitSenses = value => value.split(/[；;、，,\/\n]+/).map(sense => sense.trim()).filter(Boolean);

export function chineseSenses(gloss) {
  const senses = splitSenses(gloss.replace(partOfSpeech, '$1'));
  return new Set(senses.flatMap(sense => [
    chinese(sense),
    chinese(sense.replace(/（[^）]*）|\([^)]*\)/g, '')),
  ]).filter(Boolean));
}

export function checkAnswer(word, direction, answer) {
  if (direction === 'zh-en' || direction === 'dictation') {
    const given = english(answer);
    if (!given) return 'skipped';
    return [word.en, ...(word.variants ?? [])].some(value => english(value) === given) ? 'correct' : 'wrong';
  }
  if (!answer.trim()) return 'skipped';
  const accepted = chineseSenses(word.gloss);
  const given = splitSenses(answer).map(chinese).filter(Boolean);
  return given.length && given.every(sense => accepted.has(sense)) ? 'correct' : 'pending';
}

const glossTag = gloss => gloss.match(/^[a-z][a-z./-]*\.(?=\s)/i)?.[0];

export function wordChoices(words, id, seed = 0) {
  const correct = words[id];
  const all = Object.values(words);
  let cursor = (seed + Math.imul(id, 2654435761)) >>> 0;
  const next = count => {
    cursor = (Math.imul(cursor, 1664525) + 1013904223) >>> 0;
    return Math.floor(cursor / 0x100000000 * count);
  };
  const options = [correct];
  const senses = chineseSenses(correct.gloss);
  const start = next(all.length);
  const tag = glossTag(correct.gloss);
  for (const matchTag of [true, false]) {
    for (let offset = 0; offset < all.length && options.length < 4; offset += 1) {
      const candidate = all[(start + offset) % all.length];
      if (options.includes(candidate) || (matchTag && glossTag(candidate.gloss) !== tag)) continue;
      const meanings = chineseSenses(candidate.gloss);
      if ([...meanings].some(meaning => senses.has(meaning))) continue;
      for (const meaning of meanings) senses.add(meaning);
      options.push(candidate);
    }
  }
  for (let index = options.length - 1; index > 0; index -= 1) {
    const other = next(index + 1);
    [options[index], options[other]] = [options[other], options[index]];
  }
  return options;
}

export const draftText = (words, answer) => typeof answer === 'number' ? words[answer]?.gloss ?? '' : answer ?? '';

export function saveAnswer(state, word, unit, direction, result, answer, review = false, at = new Date().toISOString()) {
  if (!submitted.includes(result)) return;
  const key = keyFor(direction, word.id);
  const entry = { result, answer: answer.trim().slice(0, answerLimit), at };
  state.attempts[key] = entry;

  let error = state.errors[key];
  if (result === 'wrong') {
    error ??= { unit, count: 0, review: null };
    error.count += 1;
    error.lastAnswer = entry.answer;
    error.lastWrongAt = at;
    state.errors[key] = error;
  }
  if (error) {
    error.active = result === 'wrong';
    if (review) error.review = entry;
  }
}

export function lessonProgress(state, ids, direction) {
  const entries = ids.map(id => state.attempts[keyFor(direction, id)]).filter(Boolean);
  return { answered: entries.length, correct: entries.filter(entry => entry.result === 'correct').length };
}

export function startRun(state, key, direction, ids) {
  const run = { direction, ids: [...ids], index: 0, drafts: {}, results: null };
  if (direction === 'en-zh') run.choiceSeed = Math.floor(Math.random() * 0x100000000);
  state.runs[key] = run;
  return run;
}

export function shuffledIds(bank, chapterId, count, random = Math.random) {
  const chapters = chapterId === 0 ? bank.chapters : bank.chapters.filter(chapter => chapter.id === chapterId);
  const ids = chapters.flatMap(chapter => chapter.units.flatMap(unit => unit.blocks.flatMap(block => block.ids)));
  if (!shuffleSizes.includes(count) || count > ids.length) throw new RangeError('Invalid shuffle scope or size.');
  for (let index = 0; index < count; index += 1) {
    const other = index + Math.floor(random() * (ids.length - index));
    [ids[index], ids[other]] = [ids[other], ids[index]];
  }
  return ids.slice(0, count);
}

export function finishRun(state, run, words, unitFor, review = false) {
  if (run.results) return run.results;
  run.results = {};
  for (const id of run.ids) {
    const draft = run.drafts[id];
    const answer = draftText(words, draft);
    const result = run.direction === 'en-zh' && typeof draft === 'number'
      ? (draft === id ? 'correct' : 'wrong')
      : checkAnswer(words[id], run.direction, answer);
    run.results[id] = result;
    saveAnswer(state, words[id], unitFor(id), run.direction, result, answer, review);
  }
  return run.results;
}

export function assessAnswer(state, run, words, unitFor, id, result, review = false) {
  if (run.results?.[id] !== 'pending' || !submitted.includes(result)) return;
  run.results[id] = result;
  saveAnswer(state, words[id], unitFor(id), run.direction, result, draftText(words, run.drafts[id]), review);
}

export function makeBackup(state, bank) {
  return { format: 'cet6-study', version: 1, edition: bank.edition, exportedAt: new Date().toISOString(), state };
}

function validate(condition) {
  if (!condition) throw new Error('备份格式无效，或词库版本不匹配。');
}

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const answerText = value => typeof value === 'string' && value.length <= answerLimit;
const response = value => object(value) && submitted.includes(value.result) && answerText(value.answer) && date(value.at);

export function parseBackup(text, bank) {
  let backup;
  try {
    backup = JSON.parse(text);
  } catch {
    validate(false);
  }
  validate(object(backup) && backup.format === 'cet6-study' && backup.version === 1 && backup.edition === bank.edition);
  const { state } = backup;
  const unitIds = new Map();
  const unitChapters = new Map();
  const wordsByUnit = new Map();
  for (const chapter of bank.chapters) {
    for (const unit of chapter.units) {
      const ids = unit.blocks.flatMap(block => block.ids);
      wordsByUnit.set(unit.id, ids);
      unitChapters.set(unit.id, chapter.id);
      for (const id of ids) unitIds.set(id, unit.id);
    }
  }

  validate(object(state) && ['preview', 'attempts', 'errors', 'runs'].every(key => object(state[key])));
  validate(state.exams === undefined || validExamRuns(state.exams));
  validate(state.examTopics === undefined || validExamTopicRuns(state.examTopics));
  validate(state.wordbook === undefined || validWordbook(state.wordbook));
  validate(wordsByUnit.has(state.lastUnit) && ['en-US', 'en-GB'].includes(state.voice));
  for (const [unit, value] of Object.entries(state.preview)) validate(wordsByUnit.has(Number(unit)) && date(value));

  function wordFromKey(key) {
    const match = /^(zh-en|en-zh|dictation):([1-9]\d*)$/.exec(key);
    validate(match && unitIds.has(Number(match[2])));
    return Number(match[2]);
  }

  for (const [key, value] of Object.entries(state.attempts)) {
    wordFromKey(key);
    validate(response(value));
  }
  for (const [key, value] of Object.entries(state.errors)) {
    const id = wordFromKey(key);
    validate(object(value) && value.unit === unitIds.get(id) && Number.isSafeInteger(value.count) && value.count > 0);
    validate(typeof value.active === 'boolean' && answerText(value.lastAnswer) && date(value.lastWrongAt));
    validate(value.review === null || response(value.review));
  }
  for (const [key, run] of Object.entries(state.runs)) {
    const match = /^(unit|review|shuffle|dictation):(0|[1-9]\d*):(zh-en|en-zh|dictation)$/.exec(key);
    validate(match && object(run) && run.direction === match[3] && Array.isArray(run.ids) && run.ids.length > 0);
    const [, type, scope, direction] = match;
    const scopeId = Number(scope);
    const expected = wordsByUnit.get(scopeId);
    validate(new Set(run.ids).size === run.ids.length && run.ids.every(id => unitIds.has(id)));
    if (type !== 'review') validate((type === 'dictation') === (direction === 'dictation'));
    if (type === 'unit') {
      validate(expected && run.ids.length === expected.length && run.ids.every((id, i) => id === expected[i]));
    } else if (type === 'shuffle' || type === 'dictation') {
      validate(shuffleSizes.includes(run.ids.length) && (scopeId === 0 || run.ids.every(id => unitChapters.get(unitIds.get(id)) === scopeId)));
    } else {
      validate(scopeId === 0 || (expected && run.ids.every(id => unitIds.get(id) === scopeId)));
    }
    validate(Number.isInteger(run.index) && run.index >= 0 && run.index < run.ids.length && object(run.drafts));
    validate(run.choiceSeed === undefined || (direction === 'en-zh' && Number.isInteger(run.choiceSeed)
      && run.choiceSeed >= 0 && run.choiceSeed <= 0xffffffff));
    const idKeys = new Set(run.ids.map(String));
    for (const [id, draft] of Object.entries(run.drafts)) {
      validate(idKeys.has(id) && (answerText(draft) || (direction === 'en-zh' && Number.isInteger(draft)
        && wordChoices(bank.words, Number(id), run.choiceSeed).some(option => option.id === draft))));
    }
    if (run.results !== null) {
      validate(object(run.results) && Object.keys(run.results).length === run.ids.length);
      for (const [id, result] of Object.entries(run.results)) validate(idKeys.has(id) && results.includes(result));
    }
  }
  return { ...state, wordbook: state.wordbook ?? {} };
}
