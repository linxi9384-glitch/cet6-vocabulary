export const examFile = {
  bytes: 71082204,
  pages: 48,
  sha256: '2046461d764ea9eb42d13d647252d3a2139109fe85f258a74994ac8cdddfcd32',
};

// Page ranges, answer keys and cutoffs above the printed keys in the source scan.
export const papers = [
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

export function examChoices(number, paper) {
  if (!Number.isInteger(number) || number < 1 || number > examQuestionCount) return '';
  if (number >= 26 && number <= 35) return 'ABCDEFGHIJKLMNO';
  if (number >= 36 && number <= 45) return 'ABCDEFGHIJKLMNOP'.slice(0, paper?.matchingCount);
  return 'ABCD';
}

export function gradeExam(paper, run, first = 1, last = examQuestionCount) {
  const tally = { correct: 0, wrong: 0, skipped: 0 };
  for (let number = first; number <= last; number += 1) {
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
  if (id !== paper.id || !Array.isArray(listening) || listening.length !== 25 || !listening.every(choices)
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

export function validExamRuns(runs) {
  return record(runs) && Object.entries(runs).every(([id, run]) => {
    const paper = papers.find(item => item.id === id);
    return paper && record(run) && Number.isInteger(run.page) && run.page >= paper.first && run.page <= paper.last
      && (run.position === undefined || (Number.isInteger(run.position) && run.position >= 1 && run.position <= examPositionCount))
      && draft(run.writing) && draft(run.translation) && typeof run.submitted === 'boolean' && record(run.answers)
      && Object.entries(run.answers).every(([number, answer]) => number === String(Number(number))
        && typeof answer === 'string' && answer.length === 1 && examChoices(Number(number)).includes(answer));
  });
}
