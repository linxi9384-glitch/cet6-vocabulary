import { addedPapers } from './exam-additions.mjs';

export const examFile = {
  bytes: 71082204,
  pages: 48,
  sha256: '2046461d764ea9eb42d13d647252d3a2139109fe85f258a74994ac8cdddfcd32',
};

const examFiles = {
  '2024-06': { name: '2024年6月真题.pdf', bytes: 78611830, pages: 24,
    sha256: '7c7f559bf8dfe03179560bd6b10f95779c8a04a882ed4c15954fee8664b8b833' },
  '2024-12': { name: '2024年12月真题.pdf', bytes: 69603934, pages: 24,
    sha256: '87af498e23629aa620ffc4ec68d87e96b373f8567fc6dd59458cf37ed91dd598' },
  '2025-06': { name: '2025年6月真题.pdf', bytes: 36847409, pages: 24,
    sha256: '2b42c661e4d965cc7ad7fad1555a22799370a7e2938fd198a6abaaa8255459fb' },
  '2025-12': { name: '2025年12月六级真题.pdf', bytes: 19423844, pages: 24,
    sha256: '2eb9fdc6af7227477a93e7d4546e58879556fbf73994b9d552384a5c3b70abc6' },
};
export const examScan = paper => examFiles[paper.source] ?? { ...examFile, name: '集训刷题卷(历年真题).pdf' };

// Page ranges, answer keys and cutoffs above the printed keys in the source scan.
export const papers = [
  ...addedPapers,
  { id: '2023-06-1', title: '2023 年 6 月第 1 套', first: 3, last: 9, cutoff: .827, matchingCount: 13,
    key: 'BBCAD CADAB DCDBC ACBDC BDADA NKOMA GDECI CGAIF KDMBH DAACB ABBCD' },
  { id: '2023-06-2', title: '2023 年 6 月第 2 套', first: 10, last: 16, cutoff: .822, matchingCount: 11,
    key: 'DABCC ADBDC BCBAA DBACD BDAAC HIJAK MGNEB EAFCH BIEKG ABAAD ADBDC' },
  { id: '2022-12-1', title: '2022 年 12 月第 1 套', first: 17, last: 24, cutoff: .81, matchingCount: 12,
    key: 'ABADC CDBBA CDDBA DABCA BBCCD FAEKG NBCIO EIDAF KHICG ABBAD BCACD' },
  { id: '2022-12-2', title: '2022 年 12 月第 2 套', first: 25, last: 32, cutoff: .827, matchingCount: 16,
    key: 'AADCC DBBAB CACDB CABBD ADDAC BDALI JOGME FAJCG PEMDN BBACC DAACD' },
  { id: '2022-09-1', title: '2022 年 9 月第 1 套', first: 33, last: 40, cutoff: .826, matchingCount: 15,
    key: 'CDABC BBDDC ADCBA DAABC DBCAB LAIMO BCHND LEKGD HBICN DCABC DBDAC' },
  { id: '2022-06-1', title: '2022 年 6 月第 1 套', first: 41, last: 48, cutoff: .787, matchingCount: 11,
    key: 'ABCAD DCDAB BCDAB ADCCB AADCB ABKHJ GLIEF EBJDK FCGAH BACDB ADACD' },
].map(paper => ({ ...paper, key: paper.key.replaceAll(' ', '') }));

export const examQuestionCount = 55;
export const examPositionCount = examQuestionCount + 2;
export const writtenLimit = 10000;
export const blankExam = paper => ({ page: paper.first, answers: {}, writing: '', translation: '', submitted: false });
export const examSections = [
  { id: 'listening', title: '听力', first: 1, last: 25, icon: 'headphones' },
  { id: 'cloze', title: '选词填空', first: 26, last: 35, icon: 'list-checks' },
  { id: 'matching', title: '段落匹配', first: 36, last: 45, icon: 'layers' },
  { id: 'reading', title: '仔细阅读', first: 46, last: 55, icon: 'book-open' },
  { id: 'writing', title: '写作', first: 56, last: 56, icon: 'notebook-pen' },
  { id: 'translation', title: '翻译', first: 57, last: 57, icon: 'file-text' },
];
export const examFirst = paper => paper.key.startsWith('-') ? 26 : 1;
export const examSectionsFor = paper => examSections.filter(section => section.first >= examFirst(paper));

export function examExplanationGroup(position) {
  const section = examSections.find(item => position <= item.last);
  if (section?.id !== 'reading') return section;
  return position < 51
    ? { id: 'reading1', title: '仔细阅读 · 第 1 篇', first: 46, last: 50 }
    : { id: 'reading2', title: '仔细阅读 · 第 2 篇', first: 51, last: 55 };
}

export function examChoices(number, paper) {
  if (!Number.isInteger(number) || number < 1 || number > examQuestionCount) return '';
  if (paper && number < examFirst(paper)) return '';
  if (number >= 26 && number <= 35) return 'ABCDEFGHIJKLMNO';
  if (number >= 36 && number <= 45) return 'ABCDEFGHIJKLMNOPQR'.slice(0, paper?.matchingCount ?? 16);
  return 'ABCD';
}

export function gradeExam(paper, run, first = 1, last = examQuestionCount) {
  const tally = { correct: 0, wrong: 0, skipped: 0 };
  for (let number = Math.max(first, examFirst(paper)); number <= Math.min(last, examQuestionCount); number += 1) {
    const answer = run.answers[number];
    if (!answer) tally.skipped += 1;
    else if (answer === paper.key[number - 1]) tally.correct += 1;
    else tally.wrong += 1;
  }
  return tally;
}

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const draft = value => typeof value === 'string' && value.length <= writtenLimit;

export function validExamContent(paper, content) {
  const text = value => typeof value === 'string' && Boolean(value.trim());
  const texts = value => Array.isArray(value) && value.length > 0 && value.every(text);
  const choices = value => texts(value) && value.length === 4 && new Set(value).size === 4;
  const { id, listening, cloze, matching, reading, writing, translation } = content ?? {};
  const listeningValid = Array.isArray(listening) && listening.length === 25
    && (examFirst(paper) === 1 ? listening.every(choices) : listening.every(row => row === null));
  if (id !== paper.id || !listeningValid
    || !texts(cloze?.paragraphs) || !texts(cloze.options) || cloze.options.length !== 15 || new Set(cloze.options).size !== 15
    || !text(matching?.title) || !texts(matching.paragraphs) || !texts(matching.prompts) || matching.prompts.length !== 10
    || !Array.isArray(reading) || reading.length !== 2 || !text(writing) || !texts(translation)) return false;
  const blanks = cloze.paragraphs.join('\n').match(/\[\d+\]/g);
  if (blanks?.join() !== Array.from({ length: 10 }, (_, index) => '[' + (26 + index) + ']').join()) return false;
  const labels = examChoices(36, paper);
  if (matching.paragraphs.length !== labels.length || ![...paper.key.slice(35, 45)].every(letter => labels.includes(letter))) return false;
  return reading.every(passage => texts(passage?.paragraphs) && Array.isArray(passage.questions)
    && passage.questions.length === 5 && passage.questions.every(question => text(question?.prompt) && choices(question.options)));
}

function validRun(run, first, last, paper) {
  return record(run)
    && (run.position === undefined || (Number.isInteger(run.position) && run.position >= first && run.position <= last))
    && draft(run.writing) && draft(run.translation) && typeof run.submitted === 'boolean' && record(run.answers)
    && Object.entries(run.answers).every(([number, answer]) => {
      const index = Number(number);
      return number === String(index) && index >= first && index <= last
        && typeof answer === 'string' && answer.length === 1 && examChoices(index, paper).includes(answer);
    });
}

export function validExamRuns(runs) {
  return record(runs) && Object.entries(runs).every(([id, run]) => {
    const paper = papers.find(item => item.id === id);
    // Older scan answer cards allowed A-P for every matching section.
    return paper && validRun(run, examFirst(paper), examPositionCount, paper.source ? paper : undefined)
      && Number.isInteger(run.page) && run.page >= paper.first && run.page <= paper.last;
  });
}

export function validExamTopicRuns(runs) {
  return record(runs) && Object.entries(runs).every(([key, run]) => {
    const [id, sectionId, extra] = key.split(':');
    const paper = papers.find(item => item.id === id);
    const section = paper && examSectionsFor(paper).find(item => item.id === sectionId);
    return extra === undefined && section && validRun(run, section.first, section.last, paper);
  });
}
