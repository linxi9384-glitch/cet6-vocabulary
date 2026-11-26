export const examFile = {
  bytes: 71082204,
  pages: 48,
  sha256: '2046461d764ea9eb42d13d647252d3a2139109fe85f258a74994ac8cdddfcd32',
};

// Page ranges, answer keys and cutoffs above the printed keys in the source scan.
export const papers = [
  { id: '2023-06-1', title: '2023 年 6 月第 1 套', first: 3, last: 9, cutoff: .827,
    key: 'BBCAD CADAB DCDBC ACBDC BDADA NKOMA GDECI CGAIF KDMBH DAACB ABBCD' },
  { id: '2023-06-2', title: '2023 年 6 月第 2 套', first: 10, last: 16, cutoff: .822,
    key: 'DABCC ADBDC BCBAA DBACD BDAAC HIJAK MGNEB EAFCH BIEKG ABAAD ADBDC' },
  { id: '2022-12-1', title: '2022 年 12 月第 1 套', first: 17, last: 24, cutoff: .81,
    key: 'ABADC CDBBA CDDBA DABCA BBCCD FAEKG NBCIO EIDAF KHICG ABBAD BCACD' },
  { id: '2022-12-2', title: '2022 年 12 月第 2 套', first: 25, last: 32, cutoff: .827,
    key: 'AADCC DBBAB CACDB CABBD ADDAC BDALI JOGME FAJCG PEMDN BBACC DAACD' },
  { id: '2022-09-1', title: '2022 年 9 月第 1 套', first: 33, last: 40, cutoff: .826,
    key: 'CDABC BBDDC ADCBA DAABC DBCAB LAIMO BCHND LEKGD HBICN DCABC DBDAC' },
  { id: '2022-06-1', title: '2022 年 6 月第 1 套', first: 41, last: 48, cutoff: .787,
    key: 'ABCAD DCDAB BCDAB ADCCB AADCB ABKHJ GLIEF EBJDK FCGAH BACDB ADACD' },
].map(paper => ({ ...paper, key: paper.key.replaceAll(' ', '') }));

export const examQuestionCount = 55;
export const writtenLimit = 10000;
export const blankExam = paper => ({ page: paper.first, answers: {}, writing: '', translation: '', submitted: false });

export function examChoices(number) {
  if (!Number.isInteger(number) || number < 1 || number > examQuestionCount) return '';
  if (number >= 26 && number <= 35) return 'ABCDEFGHIJKLMNO';
  if (number >= 36 && number <= 45) return 'ABCDEFGHIJKLMNOP';
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

export function validExamRuns(runs) {
  return record(runs) && Object.entries(runs).every(([id, run]) => {
    const paper = papers.find(item => item.id === id);
    return paper && record(run) && Number.isInteger(run.page) && run.page >= paper.first && run.page <= paper.last
      && draft(run.writing) && draft(run.translation) && typeof run.submitted === 'boolean' && record(run.answers)
      && Object.entries(run.answers).every(([number, answer]) => number === String(Number(number))
        && typeof answer === 'string' && answer.length === 1 && examChoices(Number(number)).includes(answer));
  });
}
