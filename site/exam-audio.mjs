import { examAudio, listeningGroups } from './exam-audio-data.mjs';

export function examAudioPlayer(paper, { html, icon }, hidden = false) {
  const track = examAudio[paper.id];
  if (!track) return '';
  const groupButtons = track.segments ? `<div class="exam-listening-groups" role="group" aria-label="分段播放">${listeningGroups.map(({ title, first, last }, index) =>
    `<button class="button exam-listening-group" type="button" data-exam-audio-group="${index}">${icon('play')}
      <span>${title} <small>${first}&ndash;${last} 题</small></span></button>`
  ).join('')}</div>` : '';
  return `<section class="exam-listening-player" aria-label="听力音频" ${hidden ? 'hidden' : ''}>
    ${groupButtons}
    <audio controls preload="none" aria-label="听力音频播放器" src="${html(track.url)}"></audio>
    <div class="exam-listening-actions">
      <button class="button" type="button" data-exam-audio-all>${icon('play')} 播放整套</button>
      <label class="button exam-file-button">${icon('folder-open')} 选择本地音频
        <input type="file" accept="audio/*,.mp3,.m4a">
      </label>
      <button class="button" type="button" data-exam-audio-online hidden>${icon('rotate-ccw')} <span></span></button>
      <a class="exam-text-link" href="${html(track.sourceUrl)}" target="_blank" rel="noopener noreferrer">音频来源</a>
    </div>
    <p class="muted exam-listening-status" role="status" hidden></p>
  </section>`;
}

export function mountExamAudio(root, paper, { onSegment } = {}) {
  const panel = root.querySelector('.exam-listening-player');
  if (!panel) return null;
  const track = examAudio[paper.id];
  const audio = panel.querySelector('audio');
  const groups = panel.querySelector('.exam-listening-groups');
  const groupButtons = panel.querySelectorAll('[data-exam-audio-group]');
  const playAll = panel.querySelector('[data-exam-audio-all]');
  const input = panel.querySelector('input');
  const online = panel.querySelector('[data-exam-audio-online]');
  const status = panel.querySelector('[role="status"]');
  const events = new AbortController();
  const options = { signal: events.signal };
  let localUrl;
  let usingBackup = false;
  let activeGroup = -1;

  function showStatus(message = '') {
    status.textContent = message;
    status.hidden = !message;
  }

  function showOnlineButton(label) {
    online.querySelector('span').textContent = label;
    online.hidden = !label;
  }

  function changeSource(url, fileUrl) {
    const previous = localUrl;
    localUrl = fileUrl;
    audio.src = url;
    if (groups) groups.hidden = Boolean(localUrl);
    if (previous) URL.revokeObjectURL(previous);
  }

  function selectGroup(index = -1) {
    groupButtons[activeGroup]?.removeAttribute('aria-current');
    activeGroup = index;
    groupButtons[activeGroup]?.setAttribute('aria-current', 'true');
  }

  function playFrom(start) {
    showStatus();
    audio.currentTime = start;
    audio.play().catch(error => {
      if (!events.signal.aborted && error.name === 'NotAllowedError') showStatus('请点播放器上的播放键。');
    });
  }

  for (const [index, button] of groupButtons.entries()) {
    button.addEventListener('click', () => {
      selectGroup(index);
      playFrom(track.segments[index][0]);
      onSegment?.(listeningGroups[index]);
    }, options);
  }

  playAll.addEventListener('click', () => {
    selectGroup();
    playFrom(0);
  }, options);

  audio.addEventListener('timeupdate', () => {
    const segment = track.segments?.[activeGroup];
    if (segment && !audio.seeking && audio.currentTime >= segment[1]) {
      audio.pause();
      selectGroup();
    }
  }, options);

  audio.addEventListener('seeked', () => {
    const segment = track.segments?.[activeGroup];
    if (segment && (audio.currentTime < segment[0] - 0.5 || audio.currentTime > segment[1])) selectGroup();
  }, options);
  audio.addEventListener('ended', () => selectGroup(), options);

  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    selectGroup();
    changeSource(url, url);
    input.value = '';
    showOnlineButton('切换到在线音频');
    showStatus();
  }, options);

  online.addEventListener('click', () => {
    usingBackup = false;
    selectGroup();
    changeSource(track.url);
    showOnlineButton('');
    showStatus();
    audio.focus({ preventScroll: true });
  }, options);

  audio.addEventListener('error', () => {
    if (localUrl) {
      showStatus('无法播放此文件，请重新选择。');
    } else if (!usingBackup) {
      usingBackup = true;
      changeSource(track.fallbackUrl);
      if (activeGroup >= 0) audio.currentTime = track.segments[activeGroup][0];
      showStatus('已切换到备用音源，请点播放。');
    } else {
      showStatus('在线音频暂时无法加载。');
      showOnlineButton('重试在线音频');
    }
  }, options);
  audio.addEventListener('playing', () => showStatus(), options);

  return {
    setVisible(visible) {
      if (!visible && !panel.hidden) audio.pause();
      panel.hidden = !visible;
    },
    reset() {
      audio.pause();
      selectGroup();
      audio.currentTime = 0;
    },
    destroy() {
      events.abort();
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      if (localUrl) URL.revokeObjectURL(localUrl);
    },
  };
}
