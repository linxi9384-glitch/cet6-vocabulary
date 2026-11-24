import {
  assessAnswer, blankState, directions, finishRun, lessonProgress, makeBackup, parseBackup, startRun,
} from './study.mjs';

const storageKey = 'cet6.study.v1';
const recordingAccent = 'en-US';
const view = document.querySelector('#view');
const dialog = document.querySelector('#dialog');
const notice = document.querySelector('#notice');
const chapterNames = ['第一章', '第二章', '第三章', '第四章'];
const mode = {
  'zh-en': { label: '中译英', icon: 'pencil-line', input: '输入英文' },
  'en-zh': { label: '英译中', icon: 'languages', input: '输入中文' },
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
  if (name === 'review' && (id === 0 || units.has(id)) && directions.includes(direction)) return { name, id, direction };
  if (name === 'errors' || name === 'settings') return { name };
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
  const labels = { home: '单元目录', unit: unitName(page.id), errors: '错题本', review: '错题复测', settings: '设置与备份' };
  document.querySelector('#breadcrumb').innerHTML = `学习空间 ${icon('chevron-right')} <strong>${labels[page.name]}</strong>`;
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
    <div class="directions" aria-label="默写方向">${directions.map(direction => {
      const tally = lessonProgress(state, ids, direction);
      const run = state.runs[`unit:${unit.id}:${direction}`];
      return `<a class="direction-link" href="${unitPath(unit.id, direction)}"><span class="stat-symbol ${direction === 'zh-en' ? 'green' : 'blue'}">${icon(mode[direction].icon)}</span><span><strong>${mode[direction].label}默写</strong><small>${run && !run.results ? '继续未交卷练习' : `已答对 ${tally.correct} / ${ids.length}`}</small></span>${icon('arrow-right')}</a>`;
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

function runView() {
  const review = page.name === 'review';
  const direction = page.direction;
  const key = `${page.name}:${page.id}:${direction}`;
  const existing = state.runs[key];
  const ids = review ? activeErrors(page.id, direction).map(error => error.word.id) : idsOf(units.get(page.id));
  if (!existing && !ids.length) return `<a class="back" href="#errors">${icon('arrow-left')} 返回错题本</a><h1>错题复测</h1><p class="empty">目前没有符合条件的错题。</p>`;
  currentRun = { key, review };
  if (!existing) {
    startRun(state, key, direction, ids);
    persist();
  }
  const run = state.runs[key];
  const back = review ? '#errors' : unitPath(page.id);
  const heading = `<a class="back" href="${back}">${icon('arrow-left')} ${review ? '返回错题本' : '返回单元'}</a>
    <section class="section-head"><div><p class="eyebrow">${review ? '错题复测' : unitName(page.id)}</p><h1>${mode[direction].label}默写</h1></div>
    ${review ? '' : `<nav class="segments" aria-label="默写方向">${directions.map(option => `<a href="${unitPath(page.id, option)}" ${option === direction ? 'aria-current="page"' : ''}>${mode[option].label}</a>`).join('')}</nav>`}</section>`;
  if (run.results) return heading + resultsView(run);
  const word = bank.words[run.ids[run.index]];
  const answered = run.ids.filter(id => run.drafts[id]?.trim()).length;
  return heading + `
    <section class="exercise">
      <div class="exercise-progress"><span>第 <strong>${run.index + 1}</strong> / ${run.ids.length} 题</span><span id="answered">已填写 ${answered} 题</span></div>
      ${meter(run.index + 1, run.ids.length)}
      <div class="question"><p class="eyebrow">${direction === 'zh-en' ? '中文释义' : '英文词条'}</p><div class="question-line"><h2 ${direction === 'en-zh' ? 'lang="en"' : ''}>${html(direction === 'zh-en' ? word.gloss : word.en)}</h2>${direction === 'en-zh' ? speechButton(word) : ''}</div></div>
      <label for="answer">${mode[direction].input}</label>
      <input id="answer" data-id="${word.id}" type="text" maxlength="300" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" lang="${direction === 'zh-en' ? 'en' : 'zh-CN'}" value="${html(run.drafts[word.id])}">
      <div class="exercise-actions"><button class="button square" data-action="step" data-offset="-1" aria-label="上一题" title="上一题" ${run.index === 0 ? 'disabled' : ''}>${icon('arrow-left')}</button><button class="button" data-action="skip">跳过此题</button>
      ${run.index + 1 < run.ids.length ? `<button class="button primary" data-action="step" data-offset="1">下一题 ${icon('arrow-right')}</button>` : `<button class="button primary" data-action="submit">${icon('check')} 交卷核对</button>`}</div>
    </section>
    <div class="exercise-footer"><nav class="question-index" aria-label="题号">${run.ids.map((id, index) => `<button type="button" class="${run.drafts[id]?.trim() ? 'filled' : ''}" data-action="question" data-index="${index}" ${index === run.index ? 'aria-current="step"' : ''} aria-label="第 ${index + 1} 题">${index + 1}</button>`).join('')}</nav>${run.index + 1 < run.ids.length ? `<button class="button" data-action="submit">${icon('check')} 交卷核对</button>` : ''}</div>`;
}

function resultsView(run) {
  const tally = Object.values(run.results);
  return `<section class="result-section"><div class="section-head"><h2>交卷结果</h2><button class="button" data-action="restart">${icon('rotate-ccw')} 重练本组</button></div>
    <div class="result-metrics">${Object.entries(resultLabel).map(([status, label]) => `<span class="${status}"><strong>${tally.filter(item => item === status).length}</strong> ${label}</span>`).join('')}</div>
    <div class="word-list">${run.ids.map(id => {
      const word = bank.words[id];
      const status = run.results[id];
      return `<article class="result-row"><div class="result-word"><span class="result-tag ${status}">${resultLabel[status]}</span><strong lang="en">${html(word.en)}</strong>${speechButton(word)}</div>
        <div><p>${html(word.gloss)}</p>${word.notes ? `<small>${html(word.notes)}</small>` : ''}<p class="your-answer">你的答案 <strong>${html(run.drafts[id]?.trim() || '未作答')}</strong></p></div>
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
      <label class="select-label">方向 <select id="error-direction"><option value="all">全部方向</option>${directions.map(direction => `<option value="${direction}" ${direction === filter.direction ? 'selected' : ''}>${mode[direction].label}</option>`).join('')}</select></label>
      <label class="check-label"><input id="error-history" type="checkbox" ${filter.history ? 'checked' : ''}>含已掌握</label>
    </div>
    <div class="review-actions">${directions.filter(direction => filter.direction === 'all' || filter.direction === direction).map(direction => {
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

function settingsView() {
  return `<section class="section-head"><div><p class="eyebrow">SETTINGS / 本机学习</p><h1>设置与备份</h1></div></section>
    <section class="settings-section"><h2>发音</h2><div class="setting-row"><div><strong>美式英语</strong><small id="voice-source">${voiceSource()}</small></div>
      <button class="button" data-action="sample">${icon('volume-2')} 试听</button></div></section>
    <section class="settings-section"><h2>学习记录</h2><div class="setting-row"><div><strong>导出备份</strong><small>预习、默写进度和错题</small></div><button class="button" data-action="export">${icon('download')} 导出 JSON</button></div>
      <div class="setting-row"><div><strong>导入备份</strong><small>用备份替换当前记录</small></div><input id="import-file" type="file" accept="application/json,.json" hidden><button class="button" data-action="import">${icon('upload')} 选择备份</button></div></section>
    <section class="settings-section"><h2>离线使用</h2><div class="setting-row"><div><strong>页面与词库</strong><small id="offline-status">正在检查缓存状态…</small></div><span class="stat-symbol green">${icon('hard-drive')}</span></div></section>`;
}

function render({ top = false } = {}) {
  currentRun = null;
  updateShell();
  const renderView = {
    home: homeView,
    unit: page.direction ? runView : previewView,
    review: runView,
    errors: errorsView,
    settings: settingsView,
  }[page.name];
  view.innerHTML = renderView();
  updateOfflineLabel();
  const title = view.querySelector('h1');
  if (title) document.title = `${title.textContent} · 六级词本`;
  if (top) window.scrollTo(0, 0);
}

function openRoute() {
  page = route();
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
  run.index = Math.min(Math.max(index, 0), run.ids.length - 1);
  persist();
  const focusAnswer = document.activeElement?.id === 'answer';
  render();
  if (focusAnswer) document.querySelector('#answer')?.focus();
}

function submitRun() {
  const run = activeRun();
  if (!run || run.results) return;
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
    persist();
    render();
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

function speak(word) {
  const digest = recordedVoices[recordingAccent]?.[word.id];
  playingClip?.pause();
  playingClip = null;
  window.speechSynthesis?.cancel();
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
  dialog.showModal();
}

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
    showDialog('恢复学习记录', '<p>导入会替换此浏览器中当前的预习、练习和错题记录。</p><div class="dialog-actions"><button class="button" data-action="close">取消</button><button class="button primary" data-action="confirm">确认恢复</button></div>', () => {
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
  speak: button => speak(bank.words[button.dataset.id]),
  sample: () => speak(bank.words[1]),
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

document.addEventListener('input', event => {
  if (event.target.id === 'search-term') searchResults();
  if (event.target.id !== 'answer') return;
  const run = activeRun();
  run.drafts[event.target.dataset.id] = event.target.value.slice(0, 300);
  persist();
  const count = run.ids.filter(id => run.drafts[id]?.trim()).length;
  document.querySelector('#answered').textContent = `已填写 ${count} 题`;
  view.querySelector('[aria-current="step"]').classList.toggle('filled', Boolean(event.target.value.trim()));
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
  if (input.id === 'error-unit') filter.unit = Number(input.value);
  else if (input.id === 'error-direction') filter.direction = input.value;
  else if (input.id === 'error-history') filter.history = input.checked;
  else if (input.id === 'import-file') {
    if (input.files[0]) importData(input.files[0]);
    input.value = '';
    return;
  } else return;
  render();
  document.getElementById(input.id)?.focus({ preventScroll: true });
});

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
  navigator.serviceWorker.register('./sw.js').then(registration => {
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

main();
