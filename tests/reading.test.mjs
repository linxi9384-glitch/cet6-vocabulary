import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { readingDate, vocabularyMatches, validatePassage, validateTranslations } from '../site/reading.mjs';
import { selectWords } from '../scripts/generate-reading.mjs';

const bank = JSON.parse(readFileSync(new URL('../site/bank.json', import.meta.url), 'utf8'));

test('dates switch at midnight in Shanghai', () => {
  assert.equal(readingDate(new Date('2026-11-24T15:59:59Z')), '2026-11-24');
  assert.equal(readingDate(new Date('2026-11-24T16:00:00Z')), '2026-11-25');
});

test('each date selects 100 unique bank entries and can resume the same selection', () => {
  const words = selectWords(bank, '2026-11-24');
  assert.equal(new Set(words.map(word => word.id)).size, 100);
  assert.ok(words.every(word => bank.words[word.id] === word));
  assert.deepEqual(selectWords(bank, '2026-11-24'), words);
  assert.notDeepEqual(selectWords(bank, '2026-11-25'), words);
});

test('recognizes inflections and usable forms of vocabulary phrases', () => {
  assert.equal(vocabularyMatches('She studied and took over. The animals feed off insects.', { en: 'study' })[0].text, 'studied');
  assert.equal(vocabularyMatches('She took over.', { en: 'take over' })[0].text, 'took over');
  assert.equal(vocabularyMatches('Animals feed off insects.', { en: 'feed on/off sth' })[0].text, 'feed off insects');
  assert.equal(vocabularyMatches('A catapult and a catalogue.', { en: 'cat' }).length, 0);
});

test('rejects passages with omitted vocabulary even if the title contains it', () => {
  const paragraphs = Array.from({ length: 4 }, () => 'garden '.repeat(110).trim());
  const draft = { title: 'A forgotten landmark', paragraphs };
  assert.throws(() => validatePassage(draft, [{ en: 'landmark' }]), /landmark/);
  draft.paragraphs[0] += ' There were two landmarks.';
  assert.equal(validatePassage(draft, [{ en: 'landmark' }]).wordCount, 444);
});

test('requires one Chinese translation for each English paragraph', () => {
  const paragraphs = ['The first paragraph.', 'The second paragraph.'];
  const translations = ['\u7b2c\u4e00\u6bb5\u3002', '\u7b2c\u4e8c\u6bb5\u3002'];
  assert.deepEqual(validateTranslations(paragraphs, translations.map(text => ' ' + text + ' ')), translations);
  for (const bad of [undefined, [translations[0]], [...translations, translations[0]], [translations[0], ' '], [translations[0], paragraphs[1]]]) {
    assert.throws(() => validateTranslations(paragraphs, bad), /Chinese translation/);
  }
});

test('every archived reading has a translation for all its English paragraphs', () => {
  const archive = new URL('../site/readings/', import.meta.url);
  const dates = readdirSync(archive).filter(name => /^\d{4}-\d{2}-\d{2}\.json$/.test(name));
  assert.ok(dates.length > 0);
  for (const name of dates) {
    const { paragraphs, translations } = JSON.parse(readFileSync(new URL(name, archive), 'utf8'));
    assert.deepEqual(validateTranslations(paragraphs, translations), translations, name);
  }
});
