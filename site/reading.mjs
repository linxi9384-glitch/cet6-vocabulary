const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
});
const escapePattern = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const plainWord = "[a-z]+(?:[-'][a-z]+)*";
const irregular = {
  arise: ['arose', 'arisen'], bear: ['bore', 'borne'], bind: ['bound'],
  break: ['broke', 'broken'], come: ['came'], draw: ['drew', 'drawn'],
  feed: ['fed'], flee: ['fled'], forbid: ['forbade', 'forbidden'],
  foresee: ['foresaw', 'foreseen'], give: ['gave', 'given'], grow: ['grew', 'grown'],
  lay: ['laid'], lead: ['led'], lie: ['lay', 'lain'], make: ['made'], rise: ['rose', 'risen'],
  seek: ['sought'], shed: ['shed'], shrink: ['shrank', 'shrunk'], sink: ['sank', 'sunk'],
  spin: ['spun'], spring: ['sprang', 'sprung'], stick: ['stuck'],
  stride: ['strode', 'stridden'], strive: ['strove', 'striven'],
  swear: ['swore', 'sworn'], take: ['took', 'taken'], tear: ['tore', 'torn'],
  underlie: ['underlay', 'underlain'], undergo: ['underwent', 'undergone'],
  withdraw: ['withdrew', 'withdrawn'],
};

export const isReadingDate = date => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
  && Number.isFinite(Date.parse(`${date}T00:00:00Z`))
  && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;

export function readingDate(now = new Date()) {
  const parts = Object.fromEntries(dateFormatter.formatToParts(now).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function inflections(word) {
  const forms = [word, ...(irregular[word] ?? [])];
  if (/[^aeiou]y$/.test(word)) forms.push(`${word.slice(0, -1)}ies`, `${word.slice(0, -1)}ied`, `${word}ing`);
  else if (word.endsWith('ie')) forms.push(`${word}s`, `${word}d`, `${word.slice(0, -2)}ying`);
  else if (word.endsWith('e')) forms.push(`${word}s`, `${word}d`, `${word.slice(0, -1)}ing`);
  else forms.push(`${word}s`, `${word}es`, `${word}ed`, `${word}ing`);
  if (/[aeiou][bdgklmnprst]$/.test(word)) forms.push(`${word}${word.at(-1)}ed`, `${word}${word.at(-1)}ing`);
  return `(?:${forms.sort((a, b) => b.length - a.length).map(escapePattern).join('|')})`;
}

function wordPattern(entry) {
  return [entry.en, ...(entry.variants ?? [])].map(term => {
    const tokens = term.toLowerCase().split(/\s+/);
    return tokens.map((token, index) => {
      if (tokens.length > 1 && (token === 'sth' || token === 'sb')) return `${plainWord}(?:\\s+${plainWord}){0,2}`;
      if (token.includes('/')) return `(?:${token.split('/').map(escapePattern).join('|')})`;
      return index === 0 ? inflections(token) : escapePattern(token);
    }).join('\\s+');
  }).join('|');
}

export function vocabularyMatches(text, entry) {
  const pattern = new RegExp(`\\b(?:${wordPattern(entry)})\\b`, 'gi');
  return [...text.matchAll(pattern)].map(match => ({ start: match.index, text: match[0] }));
}

export function validateTranslations(paragraphs, translations) {
  if (!Array.isArray(translations) || translations.length !== paragraphs.length
    || translations.some(text => typeof text !== 'string' || !/\p{Script=Han}/u.test(text))) {
    throw new Error('Expected one Chinese translation for each paragraph.');
  }
  return translations.map(text => text.trim());
}

export function validatePassage(passage, words) {
  if (typeof passage?.title !== 'string' || !passage.title.trim() || passage.title.length > 140
    || !Array.isArray(passage.paragraphs) || passage.paragraphs.length < 3 || passage.paragraphs.length > 9
    || passage.paragraphs.some(paragraph => typeof paragraph !== 'string' || !paragraph.trim())) {
    throw new Error('Expected a title and three to nine paragraphs.');
  }
  const title = passage.title.trim();
  const paragraphs = passage.paragraphs.map(paragraph => paragraph.trim());
  const body = paragraphs.join('\n');
  const wordCount = body.match(/[a-z]+(?:[-'][a-z]+)*/gi)?.length ?? 0;
  if (wordCount < 380 || wordCount > 780) throw new Error(`Passage has ${wordCount} words. Use 380 to 780.`);
  const missing = words.filter(word => !paragraphs.some(paragraph => vocabularyMatches(paragraph, word).length));
  if (missing.length) throw new Error(`Missing vocabulary in the body: ${missing.map(word => word.en).join(', ')}`);
  return { title, paragraphs, wordCount };
}
