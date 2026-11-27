import { vocabularyMatches } from './reading.mjs';

export function normalizeLookup(value) {
  if (typeof value !== 'string') return '';
  const term = value.normalize('NFKC').toLowerCase().trim()
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u2010\u2011]/g, '-')
    .replace(/^[\p{P}\s]+|[\p{P}\s]+$/gu, '').replace(/\s+/g, ' ');
  return term.length <= 80 && /^[a-z]+(?:['-][a-z]+)*(?: [a-z]+(?:['-][a-z]+)*){0,5}$/.test(term) ? term : '';
}

export async function findDefinition(term, words, loadShard) {
  const key = normalizeLookup(term);
  if (!key) return null;
  const entries = Object.values(words);
  const exact = entries.find(word => [word.en, ...(word.variants ?? [])].some(form => normalizeLookup(form) === key));
  if (exact) return exact;
  if (key.includes(' ')) {
    const phrase = entries.find(word => word.en.includes(' ') && vocabularyMatches(key, word).some(hit => hit.text === key));
    if (phrase) return { en: normalizeLookup(phrase.en) || key, gloss: phrase.gloss, id: phrase.id };
  }
  const item = (await loadShard(key[0]))[key];
  if (!Array.isArray(item)) return { en: key, gloss: '' };
  const [en, gloss] = item;
  return entries.find(word => normalizeLookup(word.en) === en) ?? { en, gloss };
}

export function saveWord(state, word, added = new Date().toISOString()) {
  const en = normalizeLookup(word.en);
  if (!en || Object.hasOwn(state.wordbook, en)) return false;
  state.wordbook[en] = { en, gloss: word.gloss.slice(0, 600), added };
  return true;
}

export function validWordbook(book) {
  return book !== null && typeof book === 'object' && !Array.isArray(book)
    && Object.entries(book).every(([key, entry]) =>
      key && normalizeLookup(key) === key && entry?.en === key
      && typeof entry.gloss === 'string' && entry.gloss.length <= 600
      && typeof entry.added === 'string' && Number.isFinite(Date.parse(entry.added)));
}
