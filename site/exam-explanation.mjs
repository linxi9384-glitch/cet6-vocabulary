import { examQuestionCount } from './exams.mjs';
import { explanationBreaks } from './exam-additions.mjs';

const groupOrder = ['writing', 'listening', 'cloze', 'matching', 'reading1', 'reading2', 'translation'];

function answerRecap(paper, content, group, position, html) {
  if (group.first > examQuestionCount) return '';
  const answers = [];
  for (let number = group.first; number <= group.last; number += 1) {
    const letter = paper.key[number - 1];
    const index = letter.charCodeAt(0) - 65;
    let text;
    if (group.id === 'listening') text = content.listening[number - 1][index];
    else if (group.id === 'cloze') text = content.cloze.options[index];
    else if (group.id === 'matching') text = `段落 ${letter}`;
    else text = content.reading[group.id === 'reading1' ? 0 : 1].questions[(number - 46) % 5].options[index];
    answers.push(`<li${number === position ? ' aria-current="true"' : ''}>
      <span>${number}</span><strong>${letter}</strong><span${group.id === 'matching' ? '' : ' lang="en"'}>${html(text)}</span>
    </li>`);
  }
  return `<ol class="exam-explanation-answers" start="${group.first}">${answers.join('')}</ol>`;
}

function practiceNotes(paper, content, group, position, html) {
  if (group.id === 'matching') {
    const index = paper.key.charCodeAt(position - 1) - 65;
    return `<blockquote class="exam-explanation-context" lang="en">${html(content.matching.paragraphs[index])}</blockquote>`;
  }
  if (group.id === 'cloze') {
    const filled = content.cloze.paragraphs.find(text => text.includes('[' + position + ']'));
    return `<blockquote class="exam-explanation-context" lang="en">${filled.split(/(\[\d+\])/).map((part, index) => {
      if (!(index % 2)) return html(part);
      const number = Number(part.slice(1, -1));
      const word = html(content.cloze.options[paper.key.charCodeAt(number - 1) - 65]);
      return number === position ? `<strong>${word}</strong>` : word;
    }).join('')}</blockquote>`;
  }
  if (group.id === 'writing') {
    return `<p>按题干要求开篇，明确论点，再用具体例子和原因展开，结尾回扣题目。核对字数、句子结构和段落衔接。</p>`;
  }
  if (group.id === 'translation') {
    return `<p>先理清每句的主语、动作和逻辑关系，再用英语重新组织。逐句对照原文，核对专有名词、数字和修饰语是否译全。</p>`;
  }
  return '';
}

export function showExamExplanation(paper, content, group, position, { html, icon, showDialog }) {
  const pages = paper.explanationPages?.[group.id] ?? [];
  const title = `${group.title}解析`;
  const recap = answerRecap(paper, content, group, position, html);
  if (!pages.length) {
    const context = practiceNotes(paper, content, group, position, html);
    const label = recap ? '原卷答案' : '练习提示';
    showDialog(html(title), `<div class="exam-explanation"><p class="muted">${label} · 原资料未附逐题讲解</p>${recap}${context}</div>`);
    return;
  }

  const control = (action, symbol, label) => `<button type="button" class="square" data-explanation-action="${action}"
    title="${label}" aria-label="${label}">${icon(symbol)}</button>`;
  const dialog = showDialog(html(title), `<div class="exam-explanation">
    <div class="exam-explanation-tools">
      <div class="exam-explanation-controls" ${pages.length === 1 ? 'hidden' : ''}>
        ${control('previous', 'chevron-left', '上一页解析')}
        <output class="exam-explanation-page" aria-label="解析页码"></output>
        ${control('next', 'chevron-right', '下一页解析')}
      </div>
      <div class="exam-explanation-controls">
        ${control('smaller', 'zoom-out', '缩小解析')}
        ${control('fit', 'maximize', '适应宽度')}
        ${control('larger', 'zoom-in', '放大解析')}
      </div>
    </div>
    <div class="exam-explanation-frame" role="region" tabindex="0" aria-label="解析原页">
      <p class="muted exam-explanation-loading" role="status">正在加载解析页…</p>
      <div class="exam-explanation-page-image" hidden>
        <img class="exam-explanation-image" alt="" draggable="false">
      </div>
      <div class="exam-explanation-error" hidden><p class="muted" role="status">无法加载解析页。</p>
        <button type="button" class="button" data-explanation-action="retry">${icon('rotate-ccw')} 重试</button>
      </div>
    </div>
    ${recap ? `<details class="exam-explanation-recap"><summary>答案速查</summary>${recap}</details>` : ''}
  </div>`);
  const viewer = dialog.querySelector('.exam-explanation');
  const frame = viewer.querySelector('.exam-explanation-frame');
  const pageImage = viewer.querySelector('.exam-explanation-page-image');
  const image = viewer.querySelector('.exam-explanation-image');
  const loading = viewer.querySelector('.exam-explanation-loading');
  const error = viewer.querySelector('.exam-explanation-error');
  const pageNumber = viewer.querySelector('.exam-explanation-page');
  const button = action => viewer.querySelector(`[data-explanation-action="${action}"]`);
  const zoomLevels = [1, 1.35, 1.75, 2.25, 3];
  const groups = groupOrder.filter(id => paper.explanationPages[id]?.length);
  const groupIndex = groups.indexOf(group.id);
  const previousGroup = paper.explanationPages[groups[groupIndex - 1]];
  const nextGroup = paper.explanationPages[groups[groupIndex + 1]];
  let index = 0;
  let zoom = 0;
  let loadNumber = 0;

  async function loadPage() {
    const currentLoad = ++loadNumber;
    const page = pages[index];
    error.hidden = true;
    pageImage.hidden = true;
    loading.hidden = false;
    image.alt = `${paper.title} · ${group.title}解析原册第 ${page} 页`;
    image.src = `./exam-explanations/${paper.source}/${page}.webp`;
    pageNumber.value = `${index + 1} / ${pages.length}`;
    button('previous').disabled = index === 0;
    button('next').disabled = index === pages.length - 1;
    try {
      await image.decode();
      if (currentLoad !== loadNumber) return;
      const boundary = explanationBreaks[paper.source]?.[page];
      const start = index === 0 && previousGroup?.at(-1) === page ? boundary ?? 0 : 0;
      const end = index === pages.length - 1 && nextGroup?.[0] === page ? boundary ?? 1 : 1;
      const portion = end - start;
      pageImage.style.aspectRatio = String(image.naturalWidth / (image.naturalHeight * portion));
      image.style.top = `${-100 * start / portion}%`;
      pageImage.hidden = false;
      frame.scrollTo(0, 0);
    } catch {
      if (currentLoad === loadNumber) error.hidden = false;
    } finally {
      if (currentLoad === loadNumber) loading.hidden = true;
    }
  }

  function setZoom(level) {
    zoom = level;
    pageImage.style.width = `${100 * zoomLevels[zoom]}%`;
    button('smaller').disabled = button('fit').disabled = zoom === 0;
    button('larger').disabled = zoom === zoomLevels.length - 1;
  }

  viewer.addEventListener('click', event => {
    const action = event.target.closest('button')?.dataset.explanationAction;
    if (action === 'previous' || action === 'next') {
      index += action === 'next' ? 1 : -1;
      loadPage();
    } else if (action === 'smaller' || action === 'larger') {
      setZoom(zoom + (action === 'larger' ? 1 : -1));
    } else if (action === 'fit') setZoom(0);
    else if (action === 'retry') {
      image.removeAttribute('src');
      loadPage();
    }
  });
  setZoom(0);
  loadPage();
}
