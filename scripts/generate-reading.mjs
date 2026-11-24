import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isReadingDate, readingDate, validatePassage, vocabularyMatches } from '../site/reading.mjs';

const endpoint = 'https://api.sudorelay.com/v1/chat/completions';
const model = 'deepseek-v4-1-flash';
const bankPath = new URL('../site/bank.json', import.meta.url);
const output = new URL('../site/readings/', import.meta.url);

export function selectWords(bank, date) {
  const ranked = Object.values(bank.words).map(word => ({
    word,
    score: createHash('sha256').update(`${bank.edition}/${date}/${word.id}`).digest('hex'),
  }));
  if (ranked.length < 100) throw new Error('The bank needs at least 100 entries.');
  ranked.sort((a, b) => a.score < b.score ? -1 : Number(a.score > b.score));
  return ranked.slice(0, 100).map(entry => entry.word);
}

async function writeJson(url, value) {
  const temporary = new URL(`${url.href}.tmp`);
  await writeFile(temporary, JSON.stringify(value, null, 2) + '\n', 'utf8');
  await rename(temporary, url);
}

async function readJson(url, fallback) {
  try {
    return JSON.parse(await readFile(url, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function completion(prompt, apiKey) {
  const result = await fetch(endpoint, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(150_000),
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model, messages: [{ role: 'user', content: prompt }], max_tokens: 2000,
      thinking: { type: 'disabled' },
      response_format: { type: 'json_object' },
    }),
  });
  if (!result.ok) throw new Error(`Sudorelay returned HTTP ${result.status}.`);
  const response = await result.json();
  const content = response.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content) throw new Error('Sudorelay returned no passage text.');
  return content;
}

async function planPassage(words, apiKey) {
  const content = await completion(`Plan an original five-paragraph CET-6 reading on a single accessible topic.
Choose a topic flexible enough to give every listed word a natural, literal context. Group related words
by meaning, in five sections of about 20 IDs each. Assign each ID exactly once. Give each section a distinct
one-sentence outline that moves the same story or argument forward. Return JSON only with this shape:
{"sections":[{"outline":"opening outline","ids":[123,456]}]}.
Word IDs and entries:\n${words.map(word => `${word.id} ${word.en}`).join('\n')}`, apiKey);
  try {
    const { sections } = JSON.parse(content);
    if (!Array.isArray(sections) || sections.length !== 5 || sections.some(section =>
      typeof section?.outline !== 'string' || !section.outline.trim()
      || !Array.isArray(section.ids) || section.ids.length < 15 || section.ids.length > 25)) throw new Error('Invalid outline.');
    const byId = new Map(words.map(word => [word.id, word]));
    const ids = sections.flatMap(section => section.ids);
    if (new Set(ids).size !== words.length || ids.some(id => !byId.has(id))) throw new Error('Invalid vocabulary groups.');
    return sections.map(section => ({ outline: section.outline, words: section.ids.map(id => byId.get(id)) }));
  } catch {
    return Array.from({ length: 5 }, (_, index) => ({ outline: '', words: words.slice(index * 20, (index + 1) * 20) }));
  }
}

async function writeSection({ words, outline }, previous, final, apiKey) {
  const prompt = [
    'Write one English paragraph of 90 to 140 words in an original CET-6 reading passage.',
    previous.length ? `Continue this same article naturally:\n${previous.join('\n\n')}` : 'Open a realistic story or account with room for a developing problem.',
    outline ? `Paragraph focus: ${outline}` : '',
    final ? 'Conclude the article in this paragraph.' : 'Keep the story open for the following paragraph.',
    'Use every required entry in natural English in this paragraph, inflecting only if necessary.',
    'Use plausible, direct meanings and ordinary word combinations. Develop the topic without repeating previous events.',
    'Treat sb and sth as placeholders, and choose one alternative for slash phrases.',
    'Return a JSON object with a short English title and a paragraph string.',
    `Required entries: ${words.map(word => word.en).join(', ')}.`,
  ].join('\n');
  let feedback = '';
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const content = await completion(`${prompt}\n${feedback}`, apiKey);
    try {
      const section = JSON.parse(content);
      if (typeof section.title !== 'string' || !section.title.trim() || section.title.length > 140
        || typeof section.paragraph !== 'string') throw new Error('Return both a title and a paragraph.');
      const missing = words.filter(word => !vocabularyMatches(section.paragraph, word).length);
      if (missing.length) throw new Error(`Include these missing entries: ${missing.map(word => word.en).join(', ')}.`);
      const count = section.paragraph.match(/[a-z]+(?:[-'][a-z]+)*/gi)?.length ?? 0;
      if (count < 80 || count > 156) throw new Error(`The paragraph had ${count} words. Aim for 105 to 125.`);
      return section;
    } catch (error) {
      if (attempt === 5) throw new Error(`Paragraph ${previous.length + 1} failed validation. ${error.message}`);
      feedback = `Revise this draft while using every required entry. ${error.message}\n${content}`;
      console.log(`Paragraph ${previous.length + 1} needs revision (${attempt}/5). ${error.message}`);
    }
  }
}

async function writePassage(words, apiKey) {
  const plan = await planPassage(words, apiKey);
  const paragraphs = [];
  let title;
  for (const [index, batch] of plan.entries()) {
    const section = await writeSection(batch, paragraphs, index + 1 === plan.length, apiKey);
    title ??= section.title;
    paragraphs.push(section.paragraph);
  }
  return validatePassage({ title, paragraphs }, words);
}

async function main(date = readingDate()) {
  if (!isReadingDate(date)) throw new Error('Expected a date in YYYY-MM-DD format.');
  const bank = await readJson(bankPath);
  const words = selectWords(bank, date);
  const articlePath = new URL(`${date}.json`, output);
  const indexPath = new URL('index.json', output);
  await mkdir(output, { recursive: true });
  let article = await readJson(articlePath, null);
  if (article) {
    validatePassage(article, words);
    if (article.date !== date || article.wordIds?.join() !== words.map(word => word.id).join()) {
      throw new Error('The saved reading does not match its date and word selection.');
    }
  } else {
    const apiKey = process.env.CET6_READING_API_KEY?.trim();
    if (!apiKey) throw new Error('CET6_READING_API_KEY is required to generate a reading.');
    const articleText = await writePassage(words, apiKey);
    article = { date, ...articleText, wordIds: words.map(word => word.id) };
    await writeJson(articlePath, article);
  }
  const dates = await readJson(indexPath, []);
  if (!dates.includes(date)) await writeJson(indexPath, [...dates, date].sort().reverse());
  console.log(`Reading ${date}: ${article.wordCount} words, ${article.wordIds.length} vocabulary entries.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv[2]).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
