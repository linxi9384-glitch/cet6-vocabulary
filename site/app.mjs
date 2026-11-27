import {
  assessAnswer, blankState, directions, draftText, finishRun, lessonProgress, makeBackup, parseBackup,
  practiceDirections, shuffledIds, shuffleSizes, startRun, wordChoices,
} from './study.mjs';
import { isReadingDate, readingDate, vocabularyMatches } from './reading.mjs';
import { mountExams } from './exam-view.mjs';
import { examSectionsFor, papers } from './exams.mjs';
import { mountExamPractice } from './exam-practice.mjs';
import { renderExamTopics } from './exam-topics.mjs';
import { findDefinition, normalizeLookup, saveWord } from './word-lookup.mjs';
import { mountStudyTimer } from './study-timer.mjs';

const storageKey = 'cet6.study.v1';
const recordingAccent = 'en-US';
const view = document.querySelector('#view');
const dialog = document.querySelector('#dialog');
const notice = document.querySelector('#notice');
const lookupButton = document.querySelector('#lookup-selection');
const dictionaryShards = new Map();
const chapterNames = ['第一章', '第二章', '第三章', '第四章'];
const mode = {
  'zh-en': { label: '中译英', title: '中译英默写', icon: 'pencil-line', input: '输入英文' },
  'en-zh': { label: '英译汉', title: '英译汉选择题', icon: 'languages' },
  dictation: { label: '听写', icon: 'headphones', input: '输入英文' },
};
const resultLabel = { correct: '答对', wrong: '答错', skipped: '未作答', pending: '待自评' };
const pad = value => String(value).padStart(2, '0');
const unitName = id => `第 ${pad(id)} 单元`;
const icon = name => `<i class="icon-${name}" aria-hidden="true"></i>`;
const html = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);
const idsOf = unit => unit.blocks.flatMap(block => block.ids);
const unitPath = (id, direction) => `#unit/${id}${direction ? `/${direction}` : ''}`;
const reviewPath = (unit, direction) => `#review/${unit}/${direction}`;
const drawMode = name => name === 'shuffle' || name === 'dictation';
const drawDirections = name => name === 'dictation' ? ['dictation'] : directions;
const drawPath = (name, chapter, direction) => `#${name}/${chapter}${name === 'shuffle' ? `/${direction}` : ''}`;
const shuffleScope = chapter => chapter ? chapterNames[chapter - 1] : '全词库';
const needsAssessment = run => Object.values(run.results).includes('pending');
const displayDate = value => new Date(value).toLocaleString('zh-CN', {
  month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
});
const meter = (value, max) => `<span class="meter"><span style="width:${max ? 100 * value / max : 0}%"></span></span>`;
const speechButton = word => `<button class="square audio" type="button" data-action="speak" data-id="${word.id}" aria-label="朗读 ${html(word.en)}" title="朗读 ${html(word.en)}">${icon('volume-2')}</button>`;

let bank;
let units;
let wordUnits;
let state;
let page;
let currentRun;
let toastTimer;
let requestedWord;
let storageProblem = false;
let recordedVoices = {};
let playingClip = null;
let filter = { unit: 0, direction: 'all', history: false };
let reading = null;
let highlightReading = false;
let unmountExam;

function loadState() {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? parseBackup(raw, bank) : blankState();
  } catch {
    storageProblem = true;
    return blankState();
  }
}

function persist() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(makeBackup(state, bank)));
    storageProblem = false;
  } catch {
    storageProblem = true;
    toast('本机保存失败，请导出备份。');
  }
}

function toast(text) {
  clearTimeout(toastTimer);
  notice.textContent = text;
  notice.hidden = false;
  toastTimer = setTimeout(() => { notice.hidden = true; }, 4500);
}

function route() {
  const [name, raw, direction] = location.hash.slice(1).split('/');
  const id = Number(raw);
  if (name === 'unit' && units.has(id)) return { name, id, direction: directions.includes(direction) ? direction : null };
  if (name === 'review' && (id === 0 || units.has(id)) && practiceDirections.includes(direction)) return { name, id, direction };
  if (drawMode(name)) {
    const roundDirection = name === 'dictation' ? 'dictation' : direction;
    const saved = raw === String(id) && drawDirections(name).includes(roundDirection) && state.runs[`${name}:${id}:${roundDirection}`];
    return saved ? { name, id, direction: roundDirection } : { name };
  }
  if (['errors', 'settings', 'wordbook'].includes(name)) return { name };
  if (name === 'reading') return { name, date: isReadingDate(raw) ? raw : null };
  if (name === 'exams') return { name, id: raw, scan: direction === 'scan' };
  if (name === 'topics') return { name, section: raw, id: direction };
  const lastChapter = units.get(state.lastUnit)?.chapter ?? 1;
  return { name: 'home', chapter: bank.chapters.some(chapter => chapter.id === id) ? id : lastChapter };
}

function mistakes() {
  return Object.entries(state.errors).map(([key, error]) => {
    const [direction, id] = key.split(':');
    return { ...error, direction, word: bank.words[id] };
  });
}

function activeErrors(unit = 0, direction = 'all') {
  return mistakes().filter(error => error.active && (!unit || error.unit === unit) && (direction === 'all' || error.direction === direction));
}

function summary() {
  let mastered = 0;
  for (const unit of units.values()) {
    const words = idsOf(unit);
    mastered += words.filter(id => directions.every(direction => state.attempts[`${direction}:${id}`]?.result === 'correct')).length;
  }
  return { mastered, errors: activeErrors().length, previews: Object.keys(state.preview).length };
}

function updateShell() {
  const { mastered, errors } = summary();
  const percent = Math.round(100 * mastered / Object.keys(bank.words).length);
  document.querySelector('#overall-percent').textContent = `${percent}%`;
  document.querySelector('#overall-bar').style.width = `${percent}%`;
  document.querySelector('#overall-label').textContent = `${mastered} / ${Object.keys(bank.words).length} 条双向答对`;
  const navCount = document.querySelector('#nav-count');
  navCount.textContent = errors;
  navCount.hidden = errors === 0;
  const selected = page.name === 'unit' ? 'home' : page.name === 'review' ? 'errors' : page.name;
  for (const link of document.querySelectorAll('[data-nav]')) {
    if (link.dataset.nav === selected) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  const labels = { home: '单元目录', unit: unitName(page.id), shuffle: '乱序练习', dictation: '听写', reading: '每日阅读', exams: '六级真题', topics: '专题练习', wordbook: '生词本', errors: '错题本', review: '错题复测', settings: '设置与备份' };
  document.querySelector('#breadcrumb').innerHTML = `<span>学习空间</span> ${icon('chevron-right')} <strong>${labels[page.name]}</strong>`;
}

function stat(label, value, max, glyph, tone) {
  return `<div class="stat"><span class="stat-symbol ${tone}">${icon(glyph)}</span><div><span class="stat-label">${label}</span><strong>${value}</strong>${max !== null ? `<small> / ${max}</small>` : ''}</div></div>`;
}

function homeView() {
  const chapter = bank.chapters[page.chapter - 1];
  const last = units.get(state.lastUnit);
  const totals = summary();
  const pending = directions.find(direction => state.runs[`unit:${last.id}:${direction}`] && !state.runs[`unit:${last.id}:${direction}`].results);
  const resume = pending ? unitPath(last.id, pending) : unitPath(last.id);
  return `
    <section class="section-head home-heading"><div><p class="eyebrow">CET-6 / 学习空间</p><h1>单元目录</h1></div><span class="total-label">${icon('layers-3')} 4 章 · 64 单元 · 896 词</span></section>
    <section class="resume-band" aria-labelledby="resume-label">
      <div class="resume-copy">
        <p class="resume-label" id="resume-label"><span></span>${pending ? '练习进行中' : '继续学习'}</p>
        <h2>${unitName(last.id)}</h2>
        <p class="resume-meta">${chapterNames[last.chapter - 1]} <span>·</span> ${pending ? mode[pending].label : `${idsOf(last).length} 个词条`}</p>
        <a class="button light" href="${resume}">${pending ? '继续默写' : '进入单元'} ${icon('arrow-right')}</a>
      </div>
      <div class="resume-art" aria-hidden="true"><div class="book-back"></div><div class="book-front"><img src="./book-cover.png" alt=""></div><span class="book-tab"></span></div>
    </section>
    <section class="stats" aria-label="总学习进度">
      ${stat('已预习单元', totals.previews, units.size, 'book-open', 'green')}
      ${stat('双向答对词条', totals.mastered, Object.keys(bank.words).length, 'circle-check', 'blue')}
      ${stat('待复测错题', totals.errors, null, 'bookmark', 'orange')}
    </section>
    <section class="catalog" aria-labelledby="catalog-title">
      <div class="section-head catalog-heading"><h2 id="catalog-title">全部单元</h2><span class="muted">单元 ${pad(chapter.units[0].id)}–${pad(chapter.units.at(-1).id)}</span></div>
      <nav class="chapter-tabs" aria-label="章节">${bank.chapters.map(item => `<a href="#home/${item.id}" ${item.id === chapter.id ? 'aria-current="page"' : ''}>${chapterNames[item.id - 1]}</a>`).join('')}</nav>
      <div class="unit-grid">${chapter.units.map(unitCard).join('')}</div>
    </section>`;
}

function unitCard(unit) {
  const ids = idsOf(unit);
  const previewed = Boolean(state.preview[unit.id]);
  const issues = activeErrors(unit.id).length;
  return `<a class="unit-card" href="${unitPath(unit.id)}" aria-label="${unitName(unit.id)}">
    <div class="unit-card-head"><span class="unit-index">${pad(unit.id)}</span><div><h3>${unitName(unit.id)}</h3><span>${ids.length} 词${issues ? ` · ${issues} 道错题` : ''}</span></div>${icon('arrow-up-right')}</div>
    <div class="unit-lines">${directions.map(direction => {
      const count = lessonProgress(state, ids, direction).correct;
      return `<div><span>${mode[direction].label}</span>${meter(count, ids.length)}<small>${count}/${ids.length}</small></div>`;
    }).join('')}</div>
    <span class="unit-status ${previewed ? 'is-done' : ''}">${icon(previewed ? 'circle-check' : 'circle')}${previewed ? '已预习' : '未预习'}</span>
  </a>`;
}

function previewView() {
  const unit = units.get(page.id);
  const ids = idsOf(unit);
  const done = Boolean(state.preview[unit.id]);
  return `
    <a class="back" href="#home/${unit.chapter}">${icon('arrow-left')} 返回单元目录</a>
    <section class="section-head"><div><p class="eyebrow">${chapterNames[unit.chapter - 1]} / UNIT ${pad(unit.id)}</p><h1>${unitName(unit.id)}</h1></div>
      <button class="button ${done ? 'done-button' : ''}" data-action="preview" aria-pressed="${done}">${icon(done ? 'circle-check' : 'check')}${done ? '已完成预习' : '标记已预习'}</button>
    </section>
    <div class="directions" aria-label="练习方向">${directions.map(direction => {
      const tally = lessonProgress(state, ids, direction);
      const run = state.runs[`unit:${unit.id}:${direction}`];
      return `<a class="direction-link" href="${unitPath(unit.id, direction)}"><span class="stat-symbol ${direction === 'zh-en' ? 'green' : 'blue'}">${icon(mode[direction].icon)}</span><span><strong>${mode[direction].title}</strong><small>${run && !run.results ? '继续未交卷练习' : `已答对 ${tally.correct} / ${ids.length}`}</small></span>${icon('arrow-right')}</a>`;
    }).join('')}</div>
    <section class="word-section"><div class="section-head"><h2>词条预习</h2><span class="muted">${ids.length} 个词条</span></div>
      <div class="word-list">${unit.blocks.map(block => `<section class="word-block">
        ${block.tag ? `<div class="group-note"><strong>${html(block.tag)}</strong><span>${html(block.note)}</span></div>` : ''}
        ${block.ids.map(id => {
          const word = bank.words[id];
          return `<article id="word-${id}" class="word-row"><div class="word-name"><strong lang="en">${html(word.en)}</strong><small>#${String(id).padStart(3, '0')}</small></div><div class="word-detail">${html(word.gloss)}${word.notes ? `<small>${html(word.notes)}</small>` : ''}</div>${speechButton(word)}</article>`;
        }).join('')}
      </section>`).join('')}</div>
      <nav class="page-links" aria-label="相邻单元">
        ${units.has(unit.id - 1) ? `<a class="button" href="${unitPath(unit.id - 1)}">${icon('arrow-left')} 上一单元</a>` : '<span></span>'}
        ${units.has(unit.id + 1) ? `<a class="button" href="${unitPath(unit.id + 1)}">下一单元 ${icon('arrow-right')}</a>` : ''}
      </nav>
    </section>`;
}

function drawView() {
  const name = page.name;
  const listening = name === 'dictation';
  const scopes = [0, ...bank.chapters.map(chapter => chapter.id)];
  const rounds = scopes.flatMap(chapter => drawDirections(name).flatMap(direction => {
    const run = state.runs[`${name}:${chapter}:${direction}`];
    if (!run) return [];
    const label = !run.results ? (listening ? '继续听写' : '继续答题') : needsAssessment(run) ? '继续自评' : '查看结果';
    const status = !run.results ? `第 ${run.index + 1} / ${run.ids.length} 题` : `${run.ids.length} 题`;
    return `<div class="setting-row"><div><strong>${shuffleScope(chapter)}${listening ? '' : ` · ${mode[direction].label}`}</strong><small>${status}</small></div>
      <a class="button" href="${drawPath(name, chapter, direction)}">${label} ${icon('arrow-right')}</a></div>`;
  }));
  return `<section class="section-head"><h1>${listening ? '听写' : '乱序练习'}</h1></section>
    <form data-draw="${name}" class="shuffle-form" aria-labelledby="draw-form-title">
      <h2 id="draw-form-title">新一轮</h2>
      <div class="shuffle-options">
        <label for="draw-scope">出题范围 <select id="draw-scope" name="scope">${scopes.map(chapter => `<option value="${chapter}">${shuffleScope(chapter)}</option>`).join('')}</select></label>
        ${listening ? '' : `<label for="draw-direction">答题方向 <select id="draw-direction" name="direction">${directions.map(direction => `<option value="${direction}">${mode[direction].label}</option>`).join('')}</select></label>`}
        <label for="draw-size">题数 <select id="draw-size" name="size">${shuffleSizes.map(count => `<option value="${count}" ${count === 20 ? 'selected' : ''}>${count} 题</option>`).join('')}</select></label>
        <button class="button primary" type="submit">${icon(listening ? 'headphones' : 'shuffle')} ${listening ? '开始听写' : '开始练习'}</button>
      </div>
    </form>
    ${rounds.length ? `<section class="settings-section"><h2>最近练习</h2>${rounds.join('')}</section>` : ''}`;
}

const hasDraft = (run, id) => Boolean(draftText(bank.words, run.drafts[id]).trim());

function choicesView(word, run) {
  const draft = run.drafts[word.id];
  const options = wordChoices(bank.words, word.id, run.choiceSeed);
  return `<fieldset class="choice-list">
    <legend>选择中文释义</legend>
    ${options.map((option, index) => `<label class="choice-option">
      <input type="radio" name="word-choice" data-id="${word.id}" value="${option.id}" ${draft === option.id ? 'checked' : ''}>
      <span class="choice-letter" aria-hidden="true">${'ABCD'[index]}</span><span>${html(option.gloss)}</span>
    </label>`).join('')}
    ${typeof draft === 'string' && draft.trim() ? `<p class="muted">原作答 · ${html(draft)}</p>` : ''}
  </fieldset>`;
}

function runView() {
  const review = page.name === 'review';
  const drawn = drawMode(page.name);
  const direction = page.direction;
  const listening = direction === 'dictation';
  const picking = direction === 'en-zh';
  const key = `${page.name}:${page.id}:${direction}`;
  const existing = state.runs[key];
  if (!existing) {
    if (drawn) return drawView();
    const ids = review ? activeErrors(page.id, direction).map(error => error.word.id) : idsOf(units.get(page.id));
    if (!ids.length) return `<a class="back" href="#errors">${icon('arrow-left')} 返回错题本</a><h1>错题复测</h1><p class="empty">目前没有符合条件的错题。</p>`;
    startRun(state, key, direction, ids);
    persist();
  }
  currentRun = { key, review };
  const run = state.runs[key];
  const [back, backLabel, context] = drawn ? [`#${page.name}`, listening ? '返回听写' : '返回乱序练习', shuffleScope(page.id)]
    : review ? ['#errors', '返回错题本', '错题复测'] : [unitPath(page.id), '返回单元', unitName(page.id)];
  const title = listening ? (review ? '听写复测' : '单词听写') : drawn ? `${mode[direction].label}乱序练习` : mode[direction].title;
  const heading = `<a class="back" href="${back}">${icon('arrow-left')} ${backLabel}</a>
    <section class="section-head"><div><p class="eyebrow">${context}</p><h1>${title}</h1></div>
    ${review || drawn ? '' : `<nav class="segments" aria-label="练习方向">${directions.map(option => `<a href="${unitPath(page.id, option)}" ${option === direction ? 'aria-current="page"' : ''}>${mode[option].label}</a>`).join('')}</nav>`}</section>`;
  if (run.results) return heading + resultsView(run, drawn);
  const word = bank.words[run.ids[run.index]];
  const answered = run.ids.filter(id => hasDraft(run, id)).length;
  const prompt = listening
    ? `<div class="question dictation-prompt"><button class="button audio" type="button" data-action="hear">${icon('volume-2')} 播放发音</button></div>`
    : `<div class="question"><p class="eyebrow">${direction === 'zh-en' ? '中文释义' : '英文词条'}</p><div class="question-line"><h2 ${direction === 'en-zh' ? 'lang="en"' : ''}>${html(direction === 'zh-en' ? word.gloss : word.en)}</h2>${direction === 'en-zh' ? speechButton(word) : ''}</div></div>`;
  return heading + `
    <section class="exercise">
      <div class="exercise-progress"><span>第 <strong>${run.index + 1}</strong> / ${run.ids.length} 题</span><span id="answered">已作答 ${answered} 题</span></div>
      ${meter(run.index + 1, run.ids.length)}
      ${prompt}
      ${picking ? choicesView(word, run) : `<label for="answer">${mode[direction].input}</label>
      <input id="answer" data-id="${word.id}" type="text" maxlength="300" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" lang="en" value="${html(run.drafts[word.id])}">`}
      <div class="exercise-actions"><button class="button square" data-action="step" data-offset="-1" aria-label="上一题" title="上一题" ${run.index === 0 ? 'disabled' : ''}>${icon('arrow-left')}</button><button class="button" data-action="skip">跳过此题</button>
      ${run.index + 1 < run.ids.length ? `<button class="button primary" data-action="step" data-offset="1">下一题 ${icon('arrow-right')}</button>` : `<button class="button primary" data-action="submit">${icon('check')} 交卷核对</button>`}</div>
    </section>
    <div class="exercise-footer"><nav class="question-index" aria-label="题号">${run.ids.map((id, index) => `<button type="button" class="${hasDraft(run, id) ? 'filled' : ''}" data-action="question" data-index="${index}" ${index === run.index ? 'aria-current="step"' : ''} aria-label="第 ${index + 1} 题">${index + 1}</button>`).join('')}</nav>${run.index + 1 < run.ids.length ? `<button class="button" data-action="submit">${icon('check')} 交卷核对</button>` : ''}</div>`;
}

function resultsView(run, shuffle) {
  const tally = Object.values(run.results);
  return `<section class="result-section"><div class="section-head"><h2>交卷结果</h2><button class="button" data-action="restart">${icon(shuffle ? 'shuffle' : 'rotate-ccw')} ${shuffle ? '重新抽题' : '重练本组'}</button></div>
    <div class="result-metrics">${Object.entries(resultLabel).filter(([status]) => status !== 'pending' || tally.includes('pending')).map(([status, label]) => `<span class="${status}"><strong>${tally.filter(item => item === status).length}</strong> ${label}</span>`).join('')}</div>
    <div class="word-list">${run.ids.map(id => {
      const word = bank.words[id];
      const status = run.results[id];
      return `<article class="result-row"><div class="result-word"><span class="result-tag ${status}">${resultLabel[status]}</span><strong lang="en">${html(word.en)}</strong>${speechButton(word)}</div>
        <div><p>${html(word.gloss)}</p>${word.notes ? `<small>${html(word.notes)}</small>` : ''}<p class="your-answer">你的答案 <strong>${html(draftText(bank.words, run.drafts[id]).trim() || '未作答')}</strong></p></div>
        ${status === 'pending' ? `<div class="assessment" aria-label="自评 ${html(word.en)}"><button class="button" data-action="assess" data-id="${id}" data-result="wrong">${icon('x')} 判为错</button><button class="button primary" data-action="assess" data-id="${id}" data-result="correct">${icon('check')} 判为对</button></div>` : ''}
      </article>`;
    }).join('')}</div></section>`;
}

function errorsView() {
  const records = mistakes().filter(error => (filter.history || error.active) && (!filter.unit || error.unit === filter.unit) && (filter.direction === 'all' || error.direction === filter.direction));
  records.sort((left, right) => right.lastWrongAt.localeCompare(left.lastWrongAt));
  return `<section class="section-head"><div><p class="eyebrow">REVIEW / 错题复测</p><h1>错题本</h1></div><span class="total-label">${activeErrors().length} 道待复测</span></section>
    <div class="filter-row">
      <label class="select-label">单元 <select id="error-unit"><option value="0">全部单元</option>${[...units.keys()].map(id => `<option value="${id}" ${id === filter.unit ? 'selected' : ''}>${unitName(id)}</option>`).join('')}</select></label>
      <label class="select-label">方向 <select id="error-direction"><option value="all">全部方向</option>${practiceDirections.map(direction => `<option value="${direction}" ${direction === filter.direction ? 'selected' : ''}>${mode[direction].label}</option>`).join('')}</select></label>
      <label class="check-label"><input id="error-history" type="checkbox" ${filter.history ? 'checked' : ''}>含已掌握</label>
    </div>
    <div class="review-actions">${practiceDirections.filter(direction => filter.direction === 'all' || filter.direction === direction).map(direction => {
      const count = activeErrors(filter.unit, direction).length;
      const run = state.runs[`review:${filter.unit}:${direction}`];
      if (!count && !run) return '';
      return `<button class="button ${count ? 'primary' : ''}" data-action="review" data-direction="${direction}">${icon(count ? 'rotate-ccw' : 'list-checks')} ${mode[direction].label}${count ? `复测 (${count})` : '复测结果'}</button>`;
    }).join('')}</div>
    ${records.length ? `<div class="word-list">${records.map(error => {
      const latest = state.attempts[`${error.direction}:${error.word.id}`];
      return `<article class="result-row">
      <div class="result-word"><span class="result-tag ${error.active ? 'wrong' : 'correct'}">${error.active ? '待复测' : '已掌握'}</span><strong lang="en">${html(error.word.en)}</strong>${speechButton(error.word)}</div>
      <div><p>${html(error.word.gloss)}</p><small>${mode[error.direction].label} · <a href="${unitPath(error.unit)}">${unitName(error.unit)}</a> · 错 ${error.count} 次 · ${displayDate(error.lastWrongAt)}</small>
      <p class="your-answer">最近错答 <strong>${html(error.lastAnswer || '未作答')}</strong>${latest?.result === 'correct' && !error.active ? ` · 最近作答 <strong>${html(latest.answer)}</strong>` : ''}${error.review ? ` · 最近复测 ${resultLabel[error.review.result]} (${html(error.review.answer || '未作答')})` : ''}</p></div>
    </article>`;
    }).join('')}</div>` : `<div class="empty">${icon('bookmark-check')}<h2>当前没有错题</h2><a class="button" href="#home">返回单元目录 ${icon('arrow-right')}</a></div>`}`;
}

function readingParagraph(text, words) {
  if (!highlightReading) return html(text);
  const matches = words.flatMap(word => vocabularyMatches(text, word))
    .sort((a, b) => a.start - b.start || b.text.length - a.text.length);
  let cursor = 0;
  let output = '';
  for (const match of matches) {
    if (match.start < cursor) continue;
    output += `${html(text.slice(cursor, match.start))}<mark>${html(match.text)}</mark>`;
    cursor = match.start + match.text.length;
  }
  return output + html(text.slice(cursor));
}

function readingView() {
  const heading = '<section class="section-head"><h1>每日阅读</h1></section>';
  if (!reading) return `${heading}<p role="status">正在载入阅读…</p>`;
  if (reading.error) return `${heading}<p role="status">暂时无法载入阅读。</p><button class="button" type="button" data-action="retry-reading">${icon('rotate-ccw')} 重试</button>`;
  const { article, dates, today } = reading;
  if (!article) return `${heading}<p role="status">首篇阅读尚未发布。</p>`;
  const words = article.wordIds.map(id => bank.words[id]);
  const missingToday = !page.date && article.date !== today;
  return `${heading}
    <div class="reading-toolbar">
      <label class="select-label" for="reading-date">往期阅读
        <select id="reading-date"><option value="" ${page.date ? '' : 'selected'}>最新阅读</option>${dates.map(date => `<option value="${date}" ${page.date === date ? 'selected' : ''}>${date}</option>`).join('')}</select>
      </label>
      <label class="check-label"><input id="reading-highlight" type="checkbox" ${highlightReading ? 'checked' : ''}>高亮词库词汇</label>
    </div>
    ${missingToday ? '<p class="reading-status muted" role="status">今日阅读尚未发布，以下为最新一期。</p>' : ''}
    <article class="reading-article">
      <p class="eyebrow"><time datetime="${article.date}">${article.date}</time> · ${article.wordCount} 词</p>
      <h2 lang="en" data-lookup-text>${html(article.title)}</h2>
      <div class="reading-body">${article.paragraphs.map((text, index) => {
        const translation = article.translations?.[index];
        return `<div class="reading-pair">
          <p class="reading-original" lang="en" data-lookup-text>${readingParagraph(text, words)}</p>
          ${typeof translation === 'string' && translation.trim() ? `<p class="reading-translation" lang="zh-CN">${html(translation)}</p>` : ''}
        </div>`;
      }).join('')}</div>
    </article>
    <details class="reading-glossary"><summary>本篇词汇 · ${words.length} 个词条</summary>
      <dl>${words.map(word => `<div><dt lang="en">${html(word.en)}</dt><dd>${html(word.gloss)}</dd></div>`).join('')}</dl>
    </details>`;
}

async function loadReading(requestedPage) {
  try {
    const index = await fetch('./readings/index.json');
    if (!index.ok) throw new Error('Reading index unavailable.');
    const dates = (await index.json()).filter(isReadingDate).sort().reverse();
    const today = readingDate();
    const date = dates.includes(requestedPage.date) ? requestedPage.date : dates.find(day => day <= today);
    let article = null;
    if (date) {
      const response = await fetch(`./readings/${date}.json`);
      if (!response.ok) throw new Error('Passage unavailable.');
      article = await response.json();
      if (article.date !== date || typeof article.title !== 'string'
        || !Array.isArray(article.paragraphs) || !article.paragraphs.every(text => typeof text === 'string')
        || !Number.isInteger(article.wordCount) || !Array.isArray(article.wordIds) || article.wordIds.length !== 100
        || new Set(article.wordIds).size !== 100 || !article.wordIds.every(id => Number.isInteger(id) && bank.words[id])) {
        throw new Error('Invalid passage.');
      }
    }
    if (page === requestedPage) reading = { article, dates, today };
  } catch {
    if (page === requestedPage) reading = { error: true };
  }
  if (page === requestedPage) render();
}

function settingsView() {
  return `<section class="section-head"><div><p class="eyebrow">SETTINGS / 本机学习</p><h1>设置与备份</h1></div></section>
    <section class="settings-section"><h2>发音</h2><div class="setting-row"><div><strong>美式英语</strong><small id="voice-source">${voiceSource()}</small></div>
      <button class="button" data-action="sample">${icon('volume-2')} 试听</button></div></section>
    <section class="settings-section"><h2>学习记录</h2><div class="setting-row"><div><strong>导出备份</strong><small>练习进度、真题答题卡、错题和生词</small></div><button class="button" data-action="export">${icon('download')} 导出 JSON</button></div>
      <div class="setting-row"><div><strong>导入备份</strong><small>用备份替换当前记录</small></div><input id="import-file" type="file" accept="application/json,.json" hidden><button class="button" data-action="import">${icon('upload')} 选择备份</button></div></section>
    <section class="settings-section"><h2>离线使用</h2><div class="setting-row"><div><strong>页面与词库</strong><small id="offline-status">正在检查缓存状态…</small></div><span class="stat-symbol green">${icon('hard-drive')}</span></div></section>`;
}

function render({ top = false } = {}) {
  lookupButton.hidden = true;
  unmountExam?.();
  unmountExam = null;
  currentRun = null;
  updateShell();
  const renderView = {
    home: homeView,
    unit: page.direction ? runView : previewView,
    shuffle: page.direction ? runView : drawView,
    dictation: page.direction ? runView : drawView,
    reading: readingView,
    wordbook: wordbookView,
    review: runView,
    errors: errorsView,
    settings: settingsView,
  }[page.name];
  if (page.name === 'exams' || page.name === 'topics') {
    const controls = { html, icon, persist, showDialog,
      confirm: (title, message, label, action) => showDialog(title,
        `<p>${html(message)}</p><div class="dialog-actions"><button class="button" data-action="close">取消</button><button class="button primary" data-action="confirm">${html(label)}</button></div>`, action),
    };
    const paper = papers.find(item => item.id === page.id);
    if (page.name === 'topics') {
      const section = paper && examSectionsFor(paper).find(item => item.id === page.section);
      if (section) unmountExam = mountExamPractice(view, paper, state, controls, section);
      else view.innerHTML = renderExamTopics(page.section, state, controls);
    } else {
      unmountExam = paper && !page.scan ? mountExamPractice(view, paper, state, controls) : mountExams(view, page.id, state, controls);
    }
  } else {
    view.innerHTML = renderView();
  }
  updateOfflineLabel();
  const title = view.querySelector('h1');
  if (title) document.title = `${title.textContent} · 六级词本`;
  if (top) window.scrollTo(0, 0);
}

function openRoute() {
  if (page?.direction === 'dictation') stopSpeaking();
  page = route();
  if (page.name === 'reading') {
    reading = null;
    loadReading(page);
  }
  if (page.name === 'unit' && state.lastUnit !== page.id) {
    state.lastUnit = page.id;
    persist();
  }
  render({ top: true });
  if (requestedWord && page.name === 'unit' && !page.direction) {
    focusWord(requestedWord);
    requestedWord = null;
  }
}

function focusWord(id) {
  const row = document.getElementById(`word-${id}`);
  if (!row) return;
  row.scrollIntoView({ block: 'center' });
  row.classList.add('highlighted');
  setTimeout(() => row.classList.remove('highlighted'), 2000);
}

function activeRun() {
  return currentRun ? state.runs[currentRun.key] : null;
}

function moveQuestion(index) {
  const run = activeRun();
  if (!run || run.results) return;
  if (run.direction === 'dictation') stopSpeaking();
  run.index = Math.min(Math.max(index, 0), run.ids.length - 1);
  persist();
  const focusAnswer = document.activeElement?.id === 'answer';
  render();
  if (focusAnswer) document.querySelector('#answer')?.focus();
}

function submitRun() {
  const run = activeRun();
  if (!run || run.results) return;
  if (run.direction === 'dictation') stopSpeaking();
  finishRun(state, run, bank.words, id => wordUnits.get(id), currentRun.review);
  persist();
  render({ top: true });
}

function skipQuestion() {
  const run = activeRun();
  if (!run || run.results) return;
  delete run.drafts[run.ids[run.index]];
  if (run.index + 1 < run.ids.length) moveQuestion(run.index + 1);
  else {
    if (run.direction === 'dictation') stopSpeaking();
    persist();
    render();
  }
}

function beginDraw(name, chapter, direction, count) {
  const key = `${name}:${chapter}:${direction}`;
  const existing = state.runs[key];
  const start = () => {
    startRun(state, key, direction, shuffledIds(bank, chapter, count));
    persist();
    const target = drawPath(name, chapter, direction);
    if (location.hash === target) openRoute();
    else location.hash = target;
  };
  if (existing && (!existing.results || needsAssessment(existing))) {
    showDialog('开始新一轮', '<p>新一轮会替换本范围和方向下尚未完成的练习。</p><div class="dialog-actions"><button class="button" data-action="close">取消</button><button class="button primary" data-action="confirm">重新抽题</button></div>', start);
  } else {
    start();
  }
}

function voiceSource() {
  return Object.keys(recordedVoices[recordingAccent] ?? {}).length
    ? '豆包语音合成 3.0 · Jamie'
    : '系统美式英语语音';
}

function updateVoiceSource() {
  const target = document.querySelector('#voice-source');
  if (target) target.textContent = voiceSource();
}

function stopSpeaking() {
  playingClip?.pause();
  playingClip = null;
  window.speechSynthesis?.cancel();
}

function speak(word) {
  const digest = recordedVoices[recordingAccent]?.[word.id];
  stopSpeaking();
  if (navigator.onLine && typeof digest === 'string' && /^[a-f0-9]{12}$/.test(digest)) {
    const clip = new Audio(`./audio/${recordingAccent}/${word.id}-${digest}.mp3`);
    playingClip = clip;
    clip.play().catch(() => {
      if (playingClip !== clip) return;
      playingClip = null;
      speakWithSystem(word.en);
    });
    return;
  }
  speakWithSystem(word.en);
}

function speakWithSystem(text) {
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
    toast('此浏览器无法朗读。');
    return;
  }
  const americanVoices = speechSynthesis.getVoices().filter(voice => /^en[-_]US$/i.test(voice.lang));
  const voice = americanVoices.find(voice => voice.localService) ?? americanVoices[0];
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = recordingAccent;
  if (voice) utterance.voice = voice;
  utterance.rate = 0.88;
  utterance.onerror = event => {
    if (!['canceled', 'interrupted'].includes(event.error)) toast('未能朗读，请检查设备中的英语语音。');
  };
  speechSynthesis.speak(utterance);
}

let dialogAction;
function showDialog(title, content, action) {
  dialogAction = action;
  dialog.innerHTML = `<div class="dialog-head"><h2 id="dialog-title">${title}</h2><button class="square" data-action="close" aria-label="关闭" title="关闭">${icon('x')}</button></div>${content}`;
  dialog.scrollTop = 0;
  dialog.showModal();
  return dialog;
}

function wordbookView() {
  const entries = Object.values(state.wordbook).sort((a, b) => Date.parse(b.added) - Date.parse(a.added));
  return `<section class="section-head"><h1 tabindex="-1">生词本</h1><span class="muted">${entries.length} 个词条</span></section>
    ${entries.length ? `<ul class="wordbook-list">${entries.map(({ en, gloss }) => `<li class="wordbook-row">
      <div><h2 lang="en">${html(en)}</h2><p>${html(gloss || '暂无释义')}</p></div>
      <div class="wordbook-actions">
        <button class="square" type="button" data-action="speak-saved" data-word="${html(en)}" title="朗读" aria-label="朗读 ${html(en)}">${icon('volume-2')}</button>
        <button class="square" type="button" data-action="remove-word" data-word="${html(en)}" title="移除" aria-label="移除 ${html(en)}">${icon('trash-2')}</button>
      </div></li>`).join('')}</ul>` : `<div class="empty">${icon('book-marked')}<h2>还没有生词</h2><a class="button" href="#reading">每日阅读 ${icon('arrow-right')}</a></div>`}`;
}

function selectedLookup() {
  const selection = document.getSelection();
  if (!selection?.rangeCount || selection.isCollapsed || dialog.open) return null;
  const range = selection.getRangeAt(0);
  const block = node => (node.nodeType === 1 ? node : node.parentElement)?.closest('[data-lookup-text]');
  const start = block(range.startContainer);
  if (!start || start !== block(range.endContainer) || !view.contains(start)) return null;
  const text = selection.toString().trim().replace(/\s+/g, ' ');
  return normalizeLookup(text) ? text : null;
}

function updateLookupSelection() {
  const term = selectedLookup();
  lookupButton.hidden = !term;
  if (term) lookupButton.querySelector('bdi').textContent = term;
}

function loadDictionaryShard(letter) {
  if (!dictionaryShards.has(letter)) {
    dictionaryShards.set(letter, fetch(`./dictionary/${letter}.json`).then(response => {
      if (!response.ok) throw new Error('Dictionary unavailable');
      return response.json();
    }).catch(error => {
      dictionaryShards.delete(letter);
      throw error;
    }));
  }
  return dictionaryShards.get(letter);
}

async function showLookup(term) {
  lookupButton.hidden = true;
  document.getSelection()?.removeAllRanges();
  showDialog(`<span lang="en">${html(term)}</span>`, '<div class="lookup-result"><p role="status">正在查词…</p></div>');
  const result = dialog.querySelector('.lookup-result');
  let entry;
  let unavailable = false;
  try {
    entry = await findDefinition(term, bank.words, loadDictionaryShard);
  } catch {
    unavailable = true;
    entry = { en: normalizeLookup(term), gloss: '' };
  }
  if (!result.isConnected || !dialog.open) return;
  const key = normalizeLookup(entry.en);
  const saved = Object.hasOwn(state.wordbook, key);
  result.innerHTML = `${key !== normalizeLookup(term) ? `<p class="muted">原形 <strong lang="en">${html(entry.en)}</strong></p>` : ''}
    <p class="lookup-definition">${html(entry.gloss || (unavailable ? '词典暂时无法打开。' : '词典暂无这个词条的释义。'))}</p>
    <div class="dialog-actions">
      ${unavailable ? `<button class="button" type="button" data-lookup-retry>${icon('rotate-ccw')} 重试</button>` : ''}
      <button class="button primary" type="button" data-lookup-save ${saved ? 'disabled' : ''}>
        ${saved ? `${icon('check')} 已加入生词本` : `${icon('bookmark-plus')} 加入生词本`}</button>
    </div>`;
  result.querySelector('[data-lookup-retry]')?.addEventListener('click', () => {
    dialog.close();
    showLookup(term);
  });
  const save = result.querySelector('[data-lookup-save]');
  save.addEventListener('click', () => {
    if (!saveWord(state, entry)) return;
    persist();
    save.disabled = true;
    save.innerHTML = `${icon('check')} 已加入生词本`;
  });
}

document.addEventListener('selectionchange', updateLookupSelection);
lookupButton.addEventListener('pointerdown', event => {
  if (event.pointerType === 'mouse') event.preventDefault();
});
lookupButton.addEventListener('click', () => {
  const term = lookupButton.querySelector('bdi').textContent;
  if (bank && !dialog.open && normalizeLookup(term)) showLookup(term);
});

function searchResults() {
  const target = dialog.querySelector('#search-results');
  const query = dialog.querySelector('#search-term').value.trim().toLowerCase();
  if (!query) {
    target.innerHTML = '';
    return;
  }
  const words = Object.values(bank.words).filter(word => word.en.toLowerCase().includes(query) || word.gloss.includes(query) || word.notes?.toLowerCase().includes(query));
  words.sort((a, b) => Number(b.en.toLowerCase().startsWith(query)) - Number(a.en.toLowerCase().startsWith(query)));
  target.innerHTML = words.length ? words.slice(0, 25).map(word => `<button class="search-result" data-action="find-word" data-id="${word.id}"><span><strong lang="en">${html(word.en)}</strong><small>${html(word.gloss)}</small></span><small>${unitName(wordUnits.get(word.id))}</small>${icon('arrow-right')}</button>`).join('') : '<p class="muted">没有匹配的词条。</p>';
}

function exportData() {
  const file = new Blob([JSON.stringify(makeBackup(state, bank), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = `CET6-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function importData(file) {
  try {
    if (file.size > 12 * 1024 * 1024) throw new Error('备份文件过大。');
    const restored = parseBackup(await file.text(), bank);
    showDialog('恢复学习记录', '<p>导入会替换此浏览器中当前的学习记录和生词本。</p><div class="dialog-actions"><button class="button" data-action="close">取消</button><button class="button primary" data-action="confirm">确认恢复</button></div>', () => {
      state = restored;
      persist();
      render();
      if (!storageProblem) toast('学习记录已恢复。');
    });
  } catch (error) {
    toast(error.message || '无法读取备份。');
  }
}

const actions = {
  'force-refresh': forceRefresh,
  'remove-word': button => {
    delete state.wordbook[button.dataset.word];
    persist();
    render();
    view.querySelector('[data-action="remove-word"], h1')?.focus({ preventScroll: true });
    if (!storageProblem) toast('已移出生词本。');
  },
  'speak-saved': button => speakWithSystem(button.dataset.word),
  speak: button => speak(bank.words[button.dataset.id]),
  hear: () => {
    const run = activeRun();
    if (run?.direction === 'dictation' && !run.results) speak(bank.words[run.ids[run.index]]);
  },
  sample: () => speak(bank.words[1]),
  'retry-reading': () => openRoute(),
  preview: () => {
    if (state.preview[page.id]) delete state.preview[page.id];
    else state.preview[page.id] = new Date().toISOString();
    persist();
    render();
    view.querySelector('[data-action="preview"]')?.focus({ preventScroll: true });
  },
  step: button => moveQuestion(activeRun().index + Number(button.dataset.offset)),
  question: button => moveQuestion(Number(button.dataset.index)),
  skip: skipQuestion,
  submit: submitRun,
  assess: button => {
    assessAnswer(state, activeRun(), bank.words, id => wordUnits.get(id), Number(button.dataset.id), button.dataset.result, currentRun.review);
    persist();
    const scroll = window.scrollY;
    render();
    window.scrollTo(0, scroll);
  },
  restart: () => {
    const run = activeRun();
    if (!run?.results) return;
    if (drawMode(page.name)) {
      beginDraw(page.name, page.id, page.direction, run.ids.length);
      return;
    }
    const ids = currentRun.review ? activeErrors(page.id, page.direction).map(error => error.word.id) : run.ids;
    startRun(state, currentRun.key, page.direction, ids.length ? ids : run.ids);
    persist();
    render({ top: true });
  },
  review: button => {
    const direction = button.dataset.direction;
    const ids = activeErrors(filter.unit, direction).map(error => error.word.id);
    const key = `review:${filter.unit}:${direction}`;
    const run = state.runs[key];
    const awaitingAssessment = Object.values(run?.results ?? {}).includes('pending');
    if (ids.length && (!run || (run.results && !awaitingAssessment))) {
      startRun(state, key, direction, ids);
      persist();
    }
    location.hash = reviewPath(filter.unit, direction);
  },
  search: () => {
    showDialog('搜索词条', '<input id="search-term" type="search" placeholder="英文、中文或搭配" aria-label="搜索词条" autocomplete="off" autofocus><div id="search-results" class="search-results" aria-live="polite"></div>');
    dialog.querySelector('#search-term').focus();
  },
  'find-word': button => {
    const id = Number(button.dataset.id);
    const path = unitPath(wordUnits.get(id));
    dialog.close();
    if (path === location.hash) focusWord(id);
    else {
      requestedWord = id;
      location.hash = path;
    }
  },
  export: exportData,
  import: () => document.querySelector('#import-file').click(),
  close: () => dialog.close(),
  confirm: () => {
    dialog.close();
    dialogAction?.();
  },
};

document.addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (bank && button) actions[button.dataset.action]?.(button);
});

document.addEventListener('submit', event => {
  const name = event.target.dataset.draw;
  if (!drawMode(name)) return;
  event.preventDefault();
  const form = new FormData(event.target);
  const chapter = Number(form.get('scope'));
  const direction = name === 'dictation' ? 'dictation' : form.get('direction');
  const count = Number(form.get('size'));
  if (drawDirections(name).includes(direction) && shuffleSizes.includes(count) && (chapter === 0 || bank.chapters.some(item => item.id === chapter))) {
    beginDraw(name, chapter, direction, count);
  }
});

function updateDraft(id, answer) {
  const run = activeRun();
  if (!run || run.results || id !== run.ids[run.index]) return;
  run.drafts[id] = answer;
  persist();
  const count = run.ids.filter(wordId => hasDraft(run, wordId)).length;
  document.querySelector('#answered').textContent = `已作答 ${count} 题`;
  view.querySelector('[aria-current="step"]').classList.toggle('filled', hasDraft(run, id));
}

document.addEventListener('input', event => {
  if (event.target.id === 'search-term') searchResults();
  if (event.target.id === 'answer') updateDraft(Number(event.target.dataset.id), event.target.value.slice(0, 300));
});

document.addEventListener('keydown', event => {
  if (event.target.id !== 'answer' || event.key !== 'Enter' || event.isComposing || event.keyCode === 229) return;
  event.preventDefault();
  const run = activeRun();
  if (run.index + 1 < run.ids.length) moveQuestion(run.index + 1);
  else submitRun();
});

document.addEventListener('change', event => {
  const input = event.target;
  if (input.name === 'word-choice' && input.checked) {
    const id = Number(input.dataset.id);
    updateDraft(id, Number(input.value));
    input.closest('.choice-list').querySelector('.muted')?.remove();
    return;
  }
  if (input.id === 'error-unit') filter.unit = Number(input.value);
  else if (input.id === 'error-direction') filter.direction = input.value;
  else if (input.id === 'error-history') filter.history = input.checked;
  else if (input.id === 'reading-highlight') highlightReading = input.checked;
  else if (input.id === 'reading-date') {
    const date = input.value;
    location.hash = isReadingDate(date) ? `#reading/${date}` : '#reading';
    return;
  }
  else if (input.id === 'import-file') {
    if (input.files[0]) importData(input.files[0]);
    input.value = '';
    return;
  } else return;
  render();
  document.getElementById(input.id)?.focus({ preventScroll: true });
});

async function forceRefresh(button) {
  if (!navigator.onLine) {
    toast('请联网后再刷新。');
    return;
  }
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  toast('正在联网刷新…');
  const lifetime = new AbortController();
  let channel;
  let timeout;
  try {
    const workers = navigator.serviceWorker;
    const registration = await workers?.getRegistration();
    const worker = workers?.controller;
    if (registration && worker) {
      const updated = new Promise(resolve => {
        workers.addEventListener('controllerchange', () => {
          if (workers.controller && workers.controller !== worker) resolve();
        }, { signal: lifetime.signal });
      });
      const refreshed = (async () => {
        await registration.update();
        if (lifetime.signal.aborted || workers.controller !== worker) return;
        channel = new MessageChannel();
        await new Promise((resolve, reject) => {
          channel.port1.onmessage = ({ data }) => data?.ok ? resolve() : reject(new Error('Refresh failed'));
          worker.postMessage({ type: 'refresh-site' }, [channel.port2]);
        });
      })();
      const deadline = new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Refresh timed out')), 30000);
      });
      await Promise.race([updated, refreshed, deadline]);
    } else {
      const response = await fetch('./index.html', { cache: 'reload', signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error('Page unavailable');
    }
    location.reload();
  } catch {
    toast('刷新失败，请检查网络后重试。');
    button.disabled = false;
    button.removeAttribute('aria-busy');
  } finally {
    lifetime.abort();
    clearTimeout(timeout);
    channel?.port1.close();
  }
}

let offlineLabel = '正在准备离线缓存…';
function updateOfflineLabel() {
  const target = document.querySelector('#offline-status');
  if (target) target.textContent = offlineLabel;
  document.querySelector('#connection-label').textContent = navigator.onLine ? '本机学习' : '离线模式';
}

function prepareOffline() {
  if (!('serviceWorker' in navigator)) {
    offlineLabel = '当前访问地址无法启用离线缓存。';
    updateOfflineLabel();
    return;
  }
  const setReady = () => {
    offlineLabel = '已缓存，可离线打开。离线发音取决于系统语音。';
    updateOfflineLabel();
  };
  const failed = () => {
    offlineLabel = '离线缓存未就绪，请联网重新打开。';
    updateOfflineLabel();
  };
  const inspect = worker => {
    if (!worker) return;
    if (worker.state === 'activated') setReady();
    else worker.addEventListener('statechange', () => {
      if (worker.state === 'activated') setReady();
      if (worker.state === 'redundant') failed();
    });
  };
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(registration => {
    inspect(registration.active ?? registration.waiting ?? registration.installing);
    registration.addEventListener('updatefound', () => inspect(registration.installing));
  }).catch(failed);
}

async function main() {
  try {
    const response = await fetch('./bank.json');
    if (!response.ok) throw new Error('词库读取失败');
    bank = await response.json();
    units = new Map(bank.chapters.flatMap(chapter => chapter.units.map(unit => [unit.id, { ...unit, chapter: chapter.id }])));
    wordUnits = new Map([...units.values()].flatMap(unit => idsOf(unit).map(id => [id, unit.id])));
    state = loadState();
    openRoute();
    if (storageProblem) toast('无法读取本机学习记录，请检查浏览器存储或恢复备份。');
    window.addEventListener('hashchange', openRoute);
    window.addEventListener('online', updateOfflineLabel);
    window.addEventListener('offline', updateOfflineLabel);
    window.addEventListener('storage', event => {
      if (event.key !== storageKey && event.key !== null) return;
      state = loadState();
      render();
    });
    prepareOffline();
    window.speechSynthesis?.getVoices();
    fetch('./audio/manifest.json').then(response => response.ok ? response.json() : null).then(audio => {
      if (audio?.edition === bank.edition && audio.clips) {
        recordedVoices = audio.clips;
        updateVoiceSource();
      }
    }).catch(() => {});
  } catch (error) {
    console.error(error);
    view.innerHTML = '<h1>词库暂时无法打开</h1><p>请检查网络后重新加载。</p><a class="button" href="./">重新加载</a>';
  }
}

mountStudyTimer(document.querySelector('#study-timer'));
main();
