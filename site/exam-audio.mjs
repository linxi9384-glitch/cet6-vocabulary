import { examAudio } from './exam-audio-data.mjs';

export function examAudioPlayer(paper, { html, icon }, hidden = false) {
  const track = examAudio[paper.id];
  if (!track) return '';
  return `<section class="exam-listening-player" aria-label="听力音频" ${hidden ? 'hidden' : ''}>
    <audio controls preload="none" aria-label="听力音频播放器" src="${html(track.url)}"></audio>
    <div class="exam-listening-actions">
      <label class="button exam-file-button">${icon('folder-open')} 选择本地音频
        <input type="file" accept="audio/*,.mp3,.m4a">
      </label>
      <button class="button" type="button" data-exam-audio-online hidden>${icon('rotate-ccw')} <span></span></button>
      <a class="exam-text-link" href="${html(track.sourceUrl)}" target="_blank" rel="noopener noreferrer">音频来源</a>
    </div>
    <p class="muted exam-listening-status" role="status" hidden></p>
  </section>`;
}

export function mountExamAudio(root, paper) {
  const panel = root.querySelector('.exam-listening-player');
  if (!panel) return null;
  const track = examAudio[paper.id];
  const audio = panel.querySelector('audio');
  const input = panel.querySelector('input');
  const online = panel.querySelector('[data-exam-audio-online]');
  const status = panel.querySelector('[role="status"]');
  const events = new AbortController();
  const options = { signal: events.signal };
  let localUrl;
  let usingBackup = false;

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
    if (previous) URL.revokeObjectURL(previous);
  }

  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    changeSource(url, url);
    input.value = '';
    showOnlineButton('切换到在线音频');
    showStatus();
  }, options);

  online.addEventListener('click', () => {
    usingBackup = false;
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
      if (audio.readyState) audio.currentTime = 0;
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
