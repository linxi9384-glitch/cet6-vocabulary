import { blankExam, examChoices, examFirst, examQuestionCount, examScan, examSectionsFor, gradeExam, papers, writtenLimit } from './exams.mjs';
import { examAudioPlayer, mountExamAudio } from './exam-audio.mjs';
import { importExamPdf, restoreExamPdf } from './exam-pdf.mjs';

const status = { correct: '答对', wrong: '答错', skipped: '未作答' };
const objective = run => Object.keys(run.answers).length;
const questionCount = paper => examQuestionCount - examFirst(paper) + 1;

export function mountExams(root, id, state, { html, icon, persist, confirm }) {
  const paper = papers.find(item => item.id === id);
  if (!paper) {
    root.innerHTML = `<section class="section-head"><h1>六级真题</h1><a class="button exam-topic-link" href="#topics">${icon('layout-list')} 专题练习</a></section>
      <p class="muted exam-list-total">${papers.length} 套试卷</p>
      <div class="exam-list">${papers.map(item => {
        const run = state.exams?.[item.id];
        const count = questionCount(item);
        const progress = run?.submitted ? `答对 ${gradeExam(item, run).correct} / ${count} 题`
          : run ? `已作答 ${objective(run)} / ${count} 题` : `${count} 道客观题`;
        return `<a class="exam-list-row" href="#exams/${item.id}"><span class="stat-symbol green">${icon('file-text')}</span>
          <span><strong>${item.title}</strong><small>${progress}</small></span>
          <span class="exam-row-action">${run?.submitted ? '查看结果' : run ? '继续练习' : '开始练习'} ${icon('chevron-right')}</span></a>`;
      }).join('')}</div>`;
    return;
  }

  const sections = examSectionsFor(paper).filter(section => section.first <= examQuestionCount);
  const source = examScan(paper);
  const fileKey = paper.source ?? 'workbook';
  const count = questionCount(paper);
  let run = state.exams?.[id] ?? blankExam(paper);
  let sectionIndex = 0;
  let showWrong = false;
  let pdf;
  let revision = 0;
  let renderTask;
  let importing = false;
  let zoomed = false;

  root.innerHTML = `<a class="back" href="#exams">${icon('arrow-left')} 返回真题目录</a>
    <section class="section-head"><h1>${paper.title}</h1><a class="button" href="#exams/${paper.id}">${icon('list-checks')} 网页答题</a></section>
    <div class="exam-work">
      <section class="exam-document" aria-labelledby="exam-document-title">
        <div class="exam-surface-head"><h2 id="exam-document-title" tabindex="-1">试卷原页</h2>
          <label class="button exam-file-button">${icon('folder-open')} 选择 PDF<input type="file" id="exam-file" accept=".pdf,application/pdf"></label>
        </div>
        <p class="exam-file-status muted" role="status">正在检查本机试卷…</p>
        <p class="exam-file-hint muted">选用《${html(source.name)}》，试卷保存在当前设备。</p>
        <div class="exam-page-tools" hidden>
          <button class="square" type="button" data-exam-action="previous" title="上一页" aria-label="上一页">${icon('chevron-left')}</button>
          <label class="select-label">卷内页码 <select id="exam-page" aria-label="卷内页码">
            ${Array.from({ length: paper.last - paper.first + 1 }, (_, index) => `<option value="${paper.first + index}">第 ${index + 1} 页</option>`).join('')}
          </select></label>
          <button class="square" type="button" data-exam-action="next" title="下一页" aria-label="下一页">${icon('chevron-right')}</button>
          <button class="square" type="button" data-exam-action="zoom" title="放大试卷" aria-label="放大试卷" aria-pressed="false">${icon('zoom-in')}</button>
          <button class="button exam-jump" type="button" data-exam-action="sheet">${icon('list-checks')} 答题卡</button>
        </div>
        <div class="exam-scan" tabindex="0" aria-label="试卷预览" hidden></div>
        ${examAudioPlayer(paper, { html, icon })}
      </section>
      <section class="exam-sheet" aria-label="真题答题卡"></section>
    </div>`;

  const work = root.querySelector('.exam-work');
  const sheet = work.querySelector('.exam-sheet');
  const scan = work.querySelector('.exam-scan');
  const tools = work.querySelector('.exam-page-tools');
  const note = work.querySelector('.exam-file-status');
  const hint = work.querySelector('.exam-file-hint');
  const listeningAudio = mountExamAudio(work, paper);

  function save() {
    (state.exams ??= {})[id] = run;
    persist();
  }

  function sectionRows(section) {
    return Array.from({ length: section.last - section.first + 1 }, (_, index) => {
      const number = section.first + index;
      const selected = run.answers[number] ?? '';
      const correct = paper.key[number - 1];
      const result = !selected ? 'skipped' : selected === correct ? 'correct' : 'wrong';
      if (run.submitted) {
        if (showWrong && result === 'correct') return '';
        return `<div class="exam-answer-row"><strong>${number}</strong><span>作答 ${selected || '空'}</span>
          <span>答案 ${correct}</span><span class="result-tag ${result}">${status[result]}</span></div>`;
      }
      const choices = examChoices(number, paper);
      const oldChoice = selected && !choices.includes(selected)
        ? `<option value="${html(selected)}" selected disabled>${html(selected)}（旧记录）</option>` : '';
      return `<label class="exam-answer-row"><span>第 ${number} 题</span>
        <select data-exam-answer="${number}" aria-label="第 ${number} 题">
          <option value="">未作答</option>${oldChoice}${[...choices].map(letter => `<option value="${letter}" ${letter === selected ? 'selected' : ''}>${letter}</option>`).join('')}
        </select></label>`;
    }).join('') || '<p class="muted">本部分全部答对。</p>';
  }

  function renderSheet() {
    const section = sections[sectionIndex];
    const tally = run.submitted ? gradeExam(paper, run) : null;
    const written = sectionIndex === sections.length;
    sheet.innerHTML = `<div class="exam-surface-head"><h2 tabindex="-1">${run.submitted ? '交卷结果' : '答题卡'}</h2>
      <button class="button exam-jump" type="button" data-exam-action="document">${icon('file-text')} 试卷</button></div>
      ${tally ? `<div class="result-metrics">${Object.entries(tally).map(([key, count]) =>
        `<span class="${key}"><strong>${count}</strong> ${status[key]}</span>`).join('')}</div>`
        : `<p class="muted exam-progress" aria-live="polite">已作答 ${objective(run)} / ${count} 题</p>`}
      <div class="exam-sheet-tools">
        <label class="select-label">题型 <select id="exam-section" aria-label="题型">
          ${sections.map(({ title, first, last }, index) => `<option value="${index}" ${index === sectionIndex ? 'selected' : ''}>${title}（${first}–${last}）</option>`).join('')}
          <option value="${sections.length}" ${written ? 'selected' : ''}>写作与翻译</option>
        </select></label>
        ${tally && section ? `<label class="check-label"><input type="checkbox" id="exam-filter" ${showWrong ? 'checked' : ''}>错题和漏题</label>` : ''}
      </div>
      <div class="exam-section-body">${written ? [
        ['writing', '写作'], ['translation', '汉译英'],
      ].map(([field, title]) => `<div class="exam-written"><label for="exam-${field}">${title}</label>
        <textarea id="exam-${field}" lang="en" data-exam-written="${field}" maxlength="${writtenLimit}" autocomplete="off" autocorrect="off" spellcheck="false" ${run.submitted ? 'readonly' : ''}>${html(run[field])}</textarea></div>`).join('') : sectionRows(section)}</div>
      <div class="exam-sheet-footer">
        <button class="button ${tally ? '' : 'primary'}" type="button" data-exam-action="${tally ? 'restart' : 'submit'}">${icon(tally ? 'rotate-ccw' : 'check')} ${tally ? '重做本套' : '交卷核对'}</button>
      </div>`;
  }

  async function renderPage() {
    if (!work.isConnected || !pdf) return;
    const number = run.page;
    const current = ++revision;
    renderTask?.cancel();
    tools.hidden = false;
    scan.hidden = false;
    tools.querySelector('#exam-page').value = number;
    tools.querySelector('[data-exam-action="previous"]').disabled = number === paper.first;
    tools.querySelector('[data-exam-action="next"]').disabled = number === paper.last;
    scan.setAttribute('aria-busy', 'true');
    try {
      const page = await pdf.getPage(number);
      if (current !== revision || !work.isConnected) return;
      const width = Math.max(1, scan.clientWidth) * (zoomed ? 1.8 : 1);
      const pixels = Math.min(2100, Math.ceil(width * Math.min(devicePixelRatio, 2.5)));
      const viewport = page.getViewport({ scale: pixels / page.getViewport({ scale: 1 }).width });
      const canvas = document.createElement('canvas');
      const cutoff = number === paper.last && !run.submitted ? paper.cutoff ?? 1 : 1;
      canvas.width = pixels;
      canvas.height = Math.ceil(viewport.height * cutoff);
      canvas.style.width = `${width}px`;
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', `试卷第 ${number - paper.first + 1} 页`);
      renderTask = page.render({ canvas, viewport, annotationMode: 0 });
      await renderTask.promise;
      page.cleanup();
      if (current !== revision || !work.isConnected) return;
      scan.replaceChildren(canvas);
      scan.setAttribute('aria-busy', 'false');
    } catch {
      if (current !== revision || !work.isConnected) return;
      scan.setAttribute('aria-busy', 'false');
      note.textContent = '无法显示此页，请重选试卷。';
    }
  }

  function goToPage(number) {
    if (!pdf || run.page === number || number < paper.first || number > paper.last) return;
    run.page = number;
    save();
    scan.scrollTo(0, 0);
    renderPage();
  }

  work.addEventListener('change', async event => {
    const target = event.target;
    if (target.id === 'exam-section') {
      sectionIndex = Number(target.value);
      renderSheet();
      sheet.querySelector('#exam-section').focus({ preventScroll: true });
    } else if (target.id === 'exam-filter') {
      showWrong = target.checked;
      renderSheet();
      sheet.querySelector('#exam-filter').focus({ preventScroll: true });
    } else if (target.id === 'exam-page') {
      goToPage(Number(target.value));
    } else if (target.dataset.examAnswer && !run.submitted) {
      const number = Number(target.dataset.examAnswer);
      if (target.value && examChoices(number, paper).includes(target.value)) run.answers[number] = target.value;
      else delete run.answers[number];
      save();
      sheet.querySelector('.exam-progress').textContent = `已作答 ${objective(run)} / ${count} 题`;
    } else if (target.id === 'exam-file' && target.files[0]) {
      importing = true;
      target.disabled = true;
      note.textContent = '正在读取试卷…';
      try {
        const result = await importExamPdf(target.files[0], source, fileKey);
        if (!work.isConnected) return;
        pdf = result.pdf;
        hint.hidden = true;
        note.textContent = result.saved ? '试卷已保存在本机' : '已打开试卷，本次可用';
        renderPage();
      } catch (error) {
        if (work.isConnected) note.textContent = error.message || '无法读取试卷。';
      } finally {
        target.value = '';
        target.disabled = false;
      }
    }
  });

  work.addEventListener('input', event => {
    const field = event.target.dataset.examWritten;
    if (!field || run.submitted) return;
    run[field] = event.target.value.slice(0, writtenLimit);
    save();
  });

  work.addEventListener('click', event => {
    const button = event.target.closest('button[data-exam-action]');
    if (!button) return;
    const action = button.dataset.examAction;
    if (action === 'previous') goToPage(run.page - 1);
    else if (action === 'next') goToPage(run.page + 1);
    else if (action === 'zoom') {
      zoomed = !zoomed;
      const label = zoomed ? '适应宽度' : '放大试卷';
      button.setAttribute('aria-pressed', String(zoomed));
      button.setAttribute('aria-label', label);
      button.title = label;
      button.innerHTML = icon(zoomed ? 'zoom-out' : 'zoom-in');
      renderPage();
    } else if (action === 'sheet' || action === 'document') {
      const target = action === 'sheet' ? sheet : work.querySelector('.exam-document');
      target.scrollIntoView({ block: 'start' });
      target.querySelector('h2')?.focus({ preventScroll: true });
    } else if (action === 'submit' && !run.submitted) {
      const skipped = count - objective(run);
      confirm('交卷核对', skipped ? `还有 ${skipped} 道客观题未作答。` : '核对本套客观题答案。', '确认交卷', () => {
        run.submitted = true;
        save();
        renderSheet();
        sheet.querySelector('h2').focus({ preventScroll: true });
        renderPage();
      });
    } else if (action === 'restart') {
      confirm('重做本套', '本套试卷的作答和草稿将被清空。', '确认重做', () => {
        run = blankExam(paper);
        sectionIndex = 0;
        showWrong = false;
        listeningAudio?.reset();
        save();
        renderSheet();
        sheet.querySelector('h2').focus({ preventScroll: true });
        renderPage();
      });
    }
  });

  renderSheet();
  const resize = new ResizeObserver(entries => {
    const width = entries[0].contentRect.width;
    if (width && width !== lastWidth) {
      lastWidth = width;
      renderPage();
    }
  });
  let lastWidth;
  resize.observe(scan);
  restoreExamPdf(source, fileKey).then(saved => {
    if (!work.isConnected || importing) return;
    pdf = saved;
    hint.hidden = Boolean(pdf);
    note.textContent = pdf ? '试卷已保存在本机' : '';
    if (pdf) renderPage();
  }).catch(() => {
    if (work.isConnected && !importing) note.textContent = '本机试卷未能打开，请重新选择 PDF。';
  });

  return () => {
    revision += 1;
    renderTask?.cancel();
    resize.disconnect();
    listeningAudio?.destroy();
  };
}
