import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { readingDate, vocabularyMatches, validatePassage } from '../site/reading.mjs';
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
