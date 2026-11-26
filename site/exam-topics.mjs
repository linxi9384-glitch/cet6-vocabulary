import { examQuestionCount, examSections, examSectionsFor, gradeExam, papers } from './exams.mjs';

export function renderExamTopics(id, state, { html, icon }) {
  const section = examSections.find(item => item.id === id) ?? examSections[0];
  const available = papers.filter(paper => examSectionsFor(paper).includes(section));
  const count = section.last - section.first + 1;
  const objective = section.first <= examQuestionCount;

  function row(paper) {
    const run = state.examTopics?.[paper.id + ':' + section.id];
    let progress = objective ? count + ' 道题' : '主观题';
    if (run && objective) {
      progress = run.submitted
        ? '答对 ' + gradeExam(paper, run, section.first, section.last).correct + ' / ' + count + ' 题'
        : '已作答 ' + Object.keys(run.answers).length + ' / ' + count + ' 题';
    } else if (run?.[section.id]) {
      progress = '已保存草稿';
    }
    const action = run?.submitted ? '查看结果' : run ? '继续练习' : '开始练习';
    return `<a class="exam-list-row" href="#topics/${section.id}/${paper.id}">
      <span class="stat-symbol green">${icon(section.icon)}</span>
      <span><strong>${html(paper.title)}</strong><small>${progress}</small></span>
      <span class="exam-row-action">${action} ${icon('chevron-right')}</span></a>`;
  }

  return `<section class="section-head"><h1>专题练习</h1><a class="button exam-topic-link" href="#exams">${icon('file-text')} 整套真题</a></section>
    <nav class="exam-practice-sections exam-topic-tabs" aria-label="专题题型">
      ${examSections.map(item => `<a class="button exam-practice-section" href="#topics/${item.id}"
        ${item === section ? 'aria-current="page"' : ''}>${icon(item.icon)} ${item.title}</a>`).join('')}
    </nav>
    <p class="muted exam-list-total">${available.length} 套 · ${section.title}</p>
    <div class="exam-list">${available.map(row).join('')}</div>`;
}
