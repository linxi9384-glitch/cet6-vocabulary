const timerKey = 'cet6.timer.v1';
const emptyTimer = () => ({ elapsed: 0, startedAt: null });

function restoreTimer() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(timerKey));
    if (Number.isSafeInteger(saved?.elapsed) && saved.elapsed >= 0
      && (saved.startedAt === null || (Number.isSafeInteger(saved.startedAt) && saved.startedAt >= 0))) return saved;
  } catch {
    // The current page can still keep time when browser storage is unavailable.
  }
  return emptyTimer();
}

export function mountStudyTimer(root) {
  const display = root.querySelector('[role="timer"]');
  const toggle = root.querySelector('[data-timer-toggle]');
  const toggleIcon = toggle.querySelector('i');
  const reset = root.querySelector('[data-timer-reset]');
  let timer = restoreTimer();
  let tick;

  const elapsedAt = now => timer.elapsed + (timer.startedAt === null ? 0 : Math.max(0, now - timer.startedAt));

  function renderTime() {
    const seconds = Math.floor(elapsedAt(Date.now()) / 1000);
    const parts = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60];
    const text = parts.map(value => String(value).padStart(2, '0')).join(':');
    if (display.textContent !== text) display.textContent = text;
  }

  function renderControls() {
    const running = timer.startedAt !== null;
    const label = running ? '暂停计时' : timer.elapsed ? '继续计时' : '开始计时';
    toggle.title = label;
    toggle.setAttribute('aria-label', label);
    toggleIcon.className = running ? 'icon-pause' : 'icon-play';
    root.classList.toggle('is-running', running);
    reset.disabled = !running && timer.elapsed === 0;
    clearInterval(tick);
    if (running) tick = setInterval(renderTime, 200);
    renderTime();
  }

  function update(next) {
    timer = next;
    try { sessionStorage.setItem(timerKey, JSON.stringify(timer)); } catch {}
    renderControls();
  }

  toggle.addEventListener('click', () => {
    const now = Date.now();
    update(timer.startedAt === null ? { ...timer, startedAt: now } : { elapsed: elapsedAt(now), startedAt: null });
  });
  reset.addEventListener('click', () => update(emptyTimer()));
  document.addEventListener('visibilitychange', renderTime);
  renderControls();
}
