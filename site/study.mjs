export const directions = ['zh-en', 'en-zh'];
const submitted = ['correct', 'wrong'];
const results = [...submitted, 'skipped', 'pending'];
const answerLimit = 300;
const keyFor = (direction, id) => `${direction}:${id}`;

export function blankState() {
  return { preview: {}, attempts: {}, errors: {}, runs: {}, lastUnit: 1, voice: 'en-US' };
}

const partOfSpeech = /(^|\s\/\s)([a-z][a-z./-]*\.)\s*/gi;
const english = value => value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
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
  if (!answer.trim()) return 'skipped';
  if (direction === 'zh-en') {
    return [word.en, ...(word.variants ?? [])].some(value => english(value) === english(answer)) ? 'correct' : 'wrong';
  }
  const accepted = chineseSenses(word.gloss);
  const given = splitSenses(answer).map(chinese).filter(Boolean);
  return given.length && given.every(sense => accepted.has(sense)) ? 'correct' : 'pending';
}

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
  state.runs[key] = run;
  return run;
}

export function finishRun(state, run, words, unitFor, review = false) {
  if (run.results) return run.results;
  run.results = {};
  for (const id of run.ids) {
    const answer = run.drafts[id] ?? '';
    const result = checkAnswer(words[id], run.direction, answer);
    run.results[id] = result;
    saveAnswer(state, words[id], unitFor(id), run.direction, result, answer, review);
  }
  return run.results;
}

export function assessAnswer(state, run, words, unitFor, id, result, review = false) {
  if (run.results?.[id] !== 'pending' || !submitted.includes(result)) return;
  run.results[id] = result;
  saveAnswer(state, words[id], unitFor(id), run.direction, result, run.drafts[id] ?? '', review);
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
  const wordsByUnit = new Map();
  for (const chapter of bank.chapters) {
    for (const unit of chapter.units) {
      const ids = unit.blocks.flatMap(block => block.ids);
      wordsByUnit.set(unit.id, ids);
      for (const id of ids) unitIds.set(id, unit.id);
    }
  }

  validate(object(state) && ['preview', 'attempts', 'errors', 'runs'].every(key => object(state[key])));
  validate(wordsByUnit.has(state.lastUnit) && ['en-US', 'en-GB'].includes(state.voice));
  for (const [unit, value] of Object.entries(state.preview)) validate(wordsByUnit.has(Number(unit)) && date(value));

  function wordFromKey(key) {
    const match = /^(zh-en|en-zh):([1-9]\d*)$/.exec(key);
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
    const match = /^(unit|review):(\d+):(zh-en|en-zh)$/.exec(key);
    validate(match && object(run) && run.direction === match[3] && Array.isArray(run.ids) && run.ids.length > 0);
    const unit = Number(match[2]);
    const expected = wordsByUnit.get(unit);
    validate(new Set(run.ids).size === run.ids.length && run.ids.every(id => unitIds.has(id)));
    if (match[1] === 'unit') {
      validate(expected && run.ids.length === expected.length && run.ids.every((id, i) => id === expected[i]));
    } else {
      validate(unit === 0 || (expected && run.ids.every(id => unitIds.get(id) === unit)));
    }
    validate(Number.isInteger(run.index) && run.index >= 0 && run.index < run.ids.length && object(run.drafts));
    const idKeys = new Set(run.ids.map(String));
    for (const [id, draft] of Object.entries(run.drafts)) validate(idKeys.has(id) && answerText(draft));
    if (run.results !== null) {
      validate(object(run.results) && Object.keys(run.results).length === run.ids.length);
      for (const [id, result] of Object.entries(run.results)) validate(idKeys.has(id) && results.includes(result));
    }
  }
  return state;
}
