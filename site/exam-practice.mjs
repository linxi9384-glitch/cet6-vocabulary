import { blankExam, examChoices, examExplanationGroup, examFirst, examPositionCount, examQuestionCount, examSectionsFor, gradeExam, validExamContent, writtenLimit } from './exams.mjs';
import { examAudioPlayer, mountExamAudio } from './exam-audio.mjs';
import { showExamExplanation } from './exam-explanation.mjs';

const writingPosition = examQuestionCount + 1;
const resultLabel = { correct: '答对', wrong: '答错', skipped: '未作答', answered: '已作答' };
const wordCount = text => text.trim().split(/\s+/u).filter(Boolean).length;

export function mountExamPractice(root, paper, state, { html, icon, persist, confirm, showDialog }, topic) {
  const available = examSectionsFor(paper);
  const sections = topic ? [topic] : available;
  const first = topic?.first ?? examFirst(paper);
  const last = topic?.last ?? examPositionCount;
  const objectiveCount = Math.max(0, Math.min(last, examQuestionCount) - first + 1);
  const storage = topic ? (state.examTopics ??= {}) : (state.exams ??= {});
  const runKey = topic ? paper.id + ':' + topic.id : paper.id;
  const submitLabel = topic ? '核对本题型' : '交卷核对';
  const restartLabel = topic ? '重做本题型' : '重做本套';
  let run = storage[runKey] ?? blankExam(paper);
  let position = run.position ?? first;
  let content;
  let materialKey;
  const lifecycle = new AbortController();

  root.innerHTML = `<div class="exam-practice">
    <a class="back" href="${topic ? '#topics/' + topic.id : '#exams'}">${icon('arrow-left')} ${topic ? '返回' + topic.title + '专题' : '返回真题目录'}</a>
    <header class="section-head exam-practice-head">
      <h1>${html(paper.title)}</h1>
      <a class="button" href="#exams/${paper.id}${topic ? '' : '/scan'}">${icon('file-text')} ${topic ? '整套试卷' : '试卷原页'}</a>
    </header>
    <div class="exam-practice-loading"></div>
    <div class="exam-practice-body" hidden>
      <div class="exam-practice-top">
        ${topic ? `<h2 class="exam-topic-title">${topic.title}专题</h2>` : `<nav class="exam-practice-sections" aria-label="题型">${sections.map(({ title, first }) =>
          `<button class="button exam-practice-section" type="button" data-exam-practice-go="${first}">${title}</button>`
        ).join('')}</nav>`}
        ${!topic && first > 1 ? `<p class="muted">原卷从选词填空开始 · <a class="exam-text-link" href="#topics/listening">查看听力专题</a></p>` : ''}
        <div class="exam-practice-progress" aria-live="polite" ${objectiveCount ? '' : 'hidden'}></div>
      </div>
      <details class="exam-practice-overview" ${objectiveCount ? '' : 'hidden'}>
        <summary>答题卡</summary>
        <div class="exam-practice-overview-body">${sections.filter(section => section.first <= examQuestionCount).map(({ title, first, last }) =>
          `<div class="exam-practice-number-group"><h3>${title}</h3><div class="exam-practice-numbers">
            ${Array.from({ length: last - first + 1 }, (_, index) => first + index).map(number =>
              `<button class="exam-practice-number" type="button" data-exam-practice-go="${number}" aria-label="第 ${number} 题">${number}</button>`
            ).join('')}</div></div>`
        ).join('')}</div>
      </details>
      ${first === 1 ? examAudioPlayer(paper, { html, icon }, true) : ''}
      <div class="exam-practice-layout">
        <section class="exam-practice-material" aria-labelledby="exam-practice-material-title" hidden></section>
        <div class="exam-practice-current">
          <section class="exam-practice-question" aria-labelledby="exam-practice-question-title"></section>
          <footer class="exam-practice-footer">
            <button class="button" type="button" data-exam-practice-action="previous">${icon('chevron-left')} 上一题</button>
            <button class="button" type="button" data-exam-practice-action="next">下一题 ${icon('chevron-right')}</button>
            <button class="button primary" type="button" data-exam-practice-action="submit">${icon('check')} ${submitLabel}</button>
            <button class="button" type="button" data-exam-practice-action="restart" hidden>${icon('rotate-ccw')} ${restartLabel}</button>
          </footer>
        </div>
      </div>
    </div>
  </div>`;

  const work = root.querySelector('.exam-practice');
  const loading = work.querySelector('.exam-practice-loading');
  const body = work.querySelector('.exam-practice-body');
  const progress = work.querySelector('.exam-practice-progress');
  const overview = work.querySelector('.exam-practice-overview');
  const numbers = work.querySelectorAll('.exam-practice-number');
  const sectionButtons = work.querySelectorAll('.exam-practice-section');
  const listeningAudio = mountExamAudio(work, paper);
  const layout = work.querySelector('.exam-practice-layout');
  const material = work.querySelector('.exam-practice-material');
  const question = work.querySelector('.exam-practice-question');
  const previous = work.querySelector('[data-exam-practice-action="previous"]');
  const next = work.querySelector('[data-exam-practice-action="next"]');
  const submit = work.querySelector('[data-exam-practice-action="submit"]');
  const restart = work.querySelector('[data-exam-practice-action="restart"]');
  const currentSection = () => sections.find(({ last }) => position <= last);
  const answeredCount = () => Object.keys(run.answers).length;
  const correctChoice = number => paper.key[number - 1];

  function save() {
    run.position = position;
    storage[runKey] = run;
    persist();
  }

  function questionResult(number) {
    const answer = run.answers[number];
    if (!answer) return 'skipped';
    if (!run.submitted) return 'answered';
    return answer === correctChoice(number) ? 'correct' : 'wrong';
  }

  function updateNumber(button, number) {
    const result = questionResult(number);
    button.dataset.result = result;
    button.setAttribute('aria-description', resultLabel[result]);
    button.title = resultLabel[result];
  }

  function updateProgress() {
    if (!objectiveCount) return;
    if (run.submitted) {
      const tally = gradeExam(paper, run, first, last);
      progress.innerHTML = `<div class="result-metrics" aria-label="客观题结果">${Object.entries(tally).map(([result, count]) =>
        `<span class="${result}"><strong>${count}</strong> ${resultLabel[result]}</span>`
      ).join('')}</div>`;
    } else {
      progress.textContent = `已作答 ${answeredCount()} / ${objectiveCount} 题`;
    }
  }

  function clozeParagraph(paragraph) {
    return paragraph.split(/(\[(?:2[6-9]|3[0-5])\])/g).map((part, index) => {
      if (!(index % 2)) return html(part);
      const number = part.slice(1, -1);
      return `<button class="exam-practice-blank" type="button" data-exam-practice-go="${number}" aria-label="第 ${number} 空">${number}</button>`;
    }).join('');
  }

  function updateMaterial() {
    const key = position < 26 || position > examQuestionCount ? '' :
      position <= 35 ? 'cloze' : position <= 45 ? 'matching' : position <= 50 ? 'reading-1' : 'reading-2';
    if (key !== materialKey) {
      materialKey = key;
      material.hidden = !key;
      layout.classList.toggle('exam-practice-layout--split', Boolean(key));
      let title;
      let paragraphs;
      if (key === 'cloze') {
        title = '选词填空原文';
        paragraphs = content.cloze.paragraphs.map(clozeParagraph);
      } else if (key === 'matching') {
        title = content.matching.title;
        paragraphs = content.matching.paragraphs.map((text, index) =>
          `<strong class="exam-practice-paragraph-letter">${examChoices(36, paper)[index]}</strong> ${html(text)}`);
      } else if (key) {
        const firstPassage = key === 'reading-1';
        title = firstPassage ? '第 1 篇' : '第 2 篇';
        paragraphs = content.reading[firstPassage ? 0 : 1].paragraphs.map(html);
      }
      material.innerHTML = key ? `<h2 class="exam-practice-material-title" id="exam-practice-material-title"
        ${key === 'matching' ? 'lang="en"' : ''}>${html(title)}</h2>
        <div class="exam-practice-scroll" tabindex="0" role="region" aria-labelledby="exam-practice-material-title">
          <div class="exam-practice-passage" lang="en">${paragraphs.map(text =>
            `<p class="exam-practice-paragraph">${text}</p>`).join('')}</div>
        </div>` : '';
    }
    if (key === 'cloze') updateBlanks(true);
  }

  function updateBlanks(reveal) {
    if (materialKey !== 'cloze') return;
    for (const blank of material.querySelectorAll('.exam-practice-blank')) {
      const number = Number(blank.dataset.examPracticeGo);
      updateNumber(blank, number);
      if (number !== position) {
        blank.removeAttribute('aria-current');
        continue;
      }
      blank.setAttribute('aria-current', 'step');
      if (!reveal) continue;
      const scroll = blank.closest('.exam-practice-scroll');
      const area = scroll.getBoundingClientRect();
      const bounds = blank.getBoundingClientRect();
      if (bounds.top < area.top) scroll.scrollTop += bounds.top - area.top;
      else if (bounds.bottom > area.bottom) scroll.scrollTop += bounds.bottom - area.bottom;
    }
  }

  function renderChoices(options, compact) {
    const selected = run.answers[position];
    const letters = examChoices(position, paper);
    return `<fieldset class="exam-practice-choices${compact ? ' exam-practice-choices--compact' : ''}" aria-labelledby="exam-practice-question-title">
      ${options.map((text, index) => {
        const letter = letters[index];
        const result = run.submitted && (letter === correctChoice(position) ? 'correct' : letter === selected ? 'wrong' : '');
        return `<label class="exam-practice-option"${result ? ` data-result="${result}"` : ''}>
          <input type="radio" name="exam-practice-answer" value="${letter}" ${selected === letter ? 'checked' : ''}
            ${run.submitted ? 'disabled' : ''} ${text ? '' : `aria-label="段落 ${letter}"`}>
          <span class="exam-practice-letter">${letter}</span>
          ${text ? `<span class="exam-practice-option-text" lang="en">${html(text)}</span>` : ''}
        </label>`;
      }).join('')}
    </fieldset>`;
  }

  function renderWritten(section) {
    const writing = position === writingPosition;
    const field = writing ? 'writing' : 'translation';
    const prompt = writing
      ? `<p class="exam-practice-prompt" lang="en">${html(content.writing)}</p>`
      : content.translation.map(text => `<p class="exam-practice-prompt" lang="zh-CN">${html(text)}</p>`).join('');
    question.innerHTML = `<div class="exam-practice-question-head">
      <h2 class="exam-practice-heading" id="exam-practice-question-title" tabindex="-1">${section.title}</h2>
      ${explanationButton()}
    </div>
      <div class="exam-practice-written-prompt">${prompt}</div>
      <div class="exam-practice-written">
        <label for="exam-practice-draft">${section.title}草稿</label>
        <textarea class="exam-practice-draft" id="exam-practice-draft" data-exam-practice-written="${field}"
          lang="en" maxlength="${writtenLimit}" autocomplete="off" autocorrect="off" autocapitalize="off"
          spellcheck="false" ${run.submitted ? 'readonly' : ''}>
${html(run[field])}</textarea>
        <p class="exam-practice-count muted">${wordCount(run[field])} 词</p>
      </div>`;
  }

  function explanationButton() {
    return `<button type="button" class="button exam-explanation-button" data-exam-practice-action="explanation">${icon('file-search')} 解析</button>`;
  }

  function renderObjective() {
    let options;
    let prompt;
    if (position <= 25) {
      options = content.listening[position - 1];
    } else if (position <= 35) {
      options = content.cloze.options;
    } else if (position <= 45) {
      options = content.matching.paragraphs.map(() => '');
      prompt = content.matching.prompts[position - 36];
    } else {
      const offset = position - 46;
      ({ prompt, options } = content.reading[Math.floor(offset / 5)].questions[offset % 5]);
    }
    const result = questionResult(position);
    const selected = run.answers[position];
    const oldChoice = !run.submitted && selected && !examChoices(position, paper).includes(selected);
    question.innerHTML = `<div class="exam-practice-question-head">
      <h2 class="exam-practice-heading" id="exam-practice-question-title" tabindex="-1">第 ${position} 题</h2>
      <div class="exam-practice-question-actions">${explanationButton()}
        <button class="square exam-practice-clear" type="button" data-exam-practice-action="clear"
          aria-label="清除作答" title="清除作答" ${run.submitted || !run.answers[position] ? 'hidden' : ''}>${icon('x')}</button>
      </div>
    </div>
    ${prompt ? `<p class="exam-practice-prompt" lang="en">${html(prompt)}</p>` : ''}
    ${run.submitted ? `<div class="exam-practice-review">
      <span class="result-tag ${result}">${resultLabel[result]}</span>
      <span>你的作答 <strong>${selected ?? '无'}</strong></span>
      <span>正确答案 <strong>${correctChoice(position)}</strong></span>
    </div>` : ''}
    ${oldChoice ? `<p class="muted exam-practice-invalid">旧记录选择了 ${html(selected)}，原卷没有这个选项。</p>` : ''}
    ${renderChoices(options, position >= 26 && position <= 45)}`;
  }

  function renderPosition() {
    const section = currentSection();
    for (const button of sectionButtons) {
      if (Number(button.dataset.examPracticeGo) === section.first) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    }
    for (const button of numbers) {
      if (Number(button.dataset.examPracticeGo) === position) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    }
    listeningAudio?.setVisible(section.first === 1);
    updateMaterial();
    if (position <= examQuestionCount) renderObjective();
    else renderWritten(section);
    previous.disabled = position === first;
    next.disabled = position === last;
    previous.hidden = next.hidden = first === last;
    submit.hidden = run.submitted || !objectiveCount;
    restart.hidden = !run.submitted || !objectiveCount;
  }

  function refreshRun() {
    updateProgress();
    for (const button of numbers) updateNumber(button, Number(button.dataset.examPracticeGo));
    renderPosition();
  }

  function focusQuestion() {
    const heading = question.querySelector('.exam-practice-heading');
    heading.scrollIntoView({ block: 'nearest' });
    heading.focus({ preventScroll: true });
  }

  function goTo(number) {
    if (!content || number < first || number > last) return;
    if (position !== number) {
      position = number;
      save();
      renderPosition();
    }
    focusQuestion();
  }

  function updateAnswer(value) {
    if (value) run.answers[position] = value;
    else delete run.answers[position];
    save();
    updateProgress();
    updateNumber(numbers[position - first], position);
    updateBlanks(false);
    question.querySelector('.exam-practice-invalid')?.remove();
    question.querySelector('.exam-practice-clear').hidden = !value;
  }

  async function loadContent(focus = false) {
    loading.innerHTML = '<p class="muted" role="status">正在加载试卷…</p>';
    try {
      const response = await fetch(`./exam-data/${paper.id}.json`, { signal: lifecycle.signal });
      if (!response.ok) throw new Error('Exam content unavailable');
      const data = await response.json();
      if (!validExamContent(paper, data)) throw new Error('Invalid exam content');
      if (lifecycle.signal.aborted) return;
      content = data;
      loading.hidden = true;
      body.hidden = false;
      refreshRun();
      if (focus) focusQuestion();
    } catch {
      if (lifecycle.signal.aborted) return;
      loading.innerHTML = `<p class="muted" role="status">无法加载在线试卷。</p>
        <button class="button" type="button" data-exam-practice-action="retry">${icon('rotate-ccw')} 重新加载</button>`;
    }
  }

  work.addEventListener('change', event => {
    const target = event.target;
    if (!run.submitted && target.name === 'exam-practice-answer' && target.checked) {
      updateAnswer(target.value);
    }
  });

  work.addEventListener('input', event => {
    const field = event.target.dataset.examPracticeWritten;
    if (!field || run.submitted) return;
    run[field] = event.target.value.slice(0, writtenLimit);
    save();
    question.querySelector('.exam-practice-count').textContent = `${wordCount(run[field])} 词`;
  });

  work.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.examPracticeGo) {
      if (overview.contains(button)) overview.open = false;
      goTo(Number(button.dataset.examPracticeGo));
      return;
    }
    const action = button.dataset.examPracticeAction;
    if (action === 'previous') goTo(position - 1);
    else if (action === 'next') goTo(position + 1);
    else if (action === 'retry') loadContent(true);
    else if (action === 'explanation') showExamExplanation(paper, content, examExplanationGroup(position), position, { html, icon, showDialog });
    else if (action === 'clear' && !run.submitted) {
      const checked = question.querySelector('input:checked');
      if (checked) checked.checked = false;
      updateAnswer('');
      question.querySelector('input').focus({ preventScroll: true });
    } else if (action === 'submit' && !run.submitted) {
      const skipped = objectiveCount - answeredCount();
      confirm(submitLabel, skipped ? `还有 ${skipped} 道客观题未作答。` : '核对客观题答案。', '确认交卷', () => {
        if (lifecycle.signal.aborted) return;
        run.submitted = true;
        save();
        refreshRun();
        focusQuestion();
      });
    } else if (action === 'restart' && run.submitted) {
      confirm(restartLabel, topic ? '本题型的作答将被清空。' : '本套试卷的作答和草稿将被清空。', '确认重做', () => {
        if (lifecycle.signal.aborted) return;
        run = blankExam(paper);
        position = first;
        overview.open = false;
        save();
        listeningAudio?.reset();
        refreshRun();
        focusQuestion();
      });
    }
  });

  loadContent();
  return () => {
    lifecycle.abort();
    listeningAudio?.destroy();
  };
}
