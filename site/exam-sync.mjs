import { validExamRuns, validExamTopicRuns } from './exams.mjs';

const collections = ['exams', 'examTopics'];
const fields = ['page', 'position', 'writing', 'translation', 'submitted'];
const empty = () => ({ exams: {}, examTopics: {} });
const keys = (...records) => new Set(records.flatMap(record => Object.keys(record ?? {})));
const validProgress = value => validExamRuns(value?.exams) && validExamTopicRuns(value?.examTopics);
const sameRun = (a, b) => a === b || Boolean(a && b
  && fields.every(key => a[key] === b[key])
  && [...keys(a.answers, b.answers)].every(key => a.answers[key] === b.answers[key]));

export function sameExamProgress(a, b) {
  return collections.every(group => [...keys(a[group], b[group])].every(id => sameRun(a[group]?.[id], b[group]?.[id])));
}

function mergeRun(base, local, remote) {
  if (sameRun(remote, base)) return local;
  if (sameRun(local, base)) return remote;
  if (!local || !remote) return remote ?? local;
  if (base?.submitted && !remote.submitted) return remote;
  if (base?.submitted && !local.submitted) return local;
  const resolve = (before, here, there) => there === before ? here : there;
  const run = { ...remote, answers: {} };
  for (const key of keys(base?.answers, local.answers, remote.answers)) {
    const answer = resolve(base?.answers[key], local.answers[key], remote.answers[key]);
    if (answer !== undefined) run.answers[key] = answer;
  }
  for (const field of fields) {
    const fallback = field === 'writing' || field === 'translation' ? '' : undefined;
    const value = field === 'submitted' && !base ? local.submitted || remote.submitted
      : resolve(base?.[field] ?? fallback, local[field], remote[field]);
    if (value === undefined) delete run[field];
    else run[field] = value;
  }
  return run;
}

export function mergeExamProgress(base, local, remote) {
  const result = empty();
  for (const group of collections) {
    for (const id of keys(base?.[group], local[group], remote[group])) {
      const run = mergeRun(base?.[group]?.[id], local[group]?.[id], remote[group]?.[id]);
      if (run) result[group][id] = structuredClone(run);
    }
  }
  return result;
}

const accountName = 'WhiteMu';
const accountEmail = 'whitemu@cet6.invalid';
const uuid = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;

export function createExamSync({ url, key, request = fetch, storage }) {
  const configured = /^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(url ?? '') && /^sb_publishable_[\w-]+$/.test(key ?? '');
  const sessionKey = 'cet6.account.v1:' + url;
  const baselineKey = 'cet6.exam-baseline.v1:' + url;
  let generation = 0;
  let inFlight;

  function read(name) {
    try { return JSON.parse(storage?.getItem(name) ?? 'null'); } catch { return null; }
  }

  function write(name, value) {
    try {
      if (value === null) storage?.removeItem(name);
      else storage?.setItem(name, JSON.stringify(value));
    } catch {
      // The current session still works with browser storage disabled.
    }
  }

  const validSession = value => value?.user?.email === accountEmail && uuid.test(value.user.id)
    && typeof value.access_token === 'string' && typeof value.refresh_token === 'string'
    && Number.isFinite(value.expiresAt);
  const stored = configured ? read(sessionKey) : null;
  let session = validSession(stored) ? stored : null;
  const getBaseline = () => {
    const saved = read(baselineKey);
    return session && saved?.user === session.user.id && validProgress(saved.progress) ? saved.progress : undefined;
  };
  let baseline = getBaseline();

  function setSession(value) {
    session = value;
    write(sessionKey, value);
  }

  function api(path, { method = 'GET', token, body, signal } = {}) {
    const headers = { apikey: key };
    if (token) headers.Authorization = 'Bearer ' + token;
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      headers.Prefer = 'return=representation';
    }
    return request(url + path, { method, headers, body: JSON.stringify(body), cache: 'no-store', signal });
  }

  async function authenticate(grant, body, signal) {
    const response = await api('/auth/v1/token?grant_type=' + grant, { method: 'POST', body, signal });
    if (!response.ok) {
      const error = new Error(response.status === 429 ? '操作太频繁，请稍后再试。'
        : response.status >= 500 ? '账号服务暂时不可用。' : '账号、密码或登录状态无效。');
      error.status = response.status;
      throw error;
    }
    const result = await response.json();
    const value = {
      access_token: result.access_token, refresh_token: result.refresh_token, user: result.user,
      expiresAt: Date.now() + result.expires_in * 1000,
    };
    if (!validSession(value)) throw new Error('账号服务返回了无效的会话。');
    return value;
  }

  async function signIn(name, password) {
    if (!configured) throw new Error('账号服务尚未开通。');
    if (name.trim().toLowerCase() !== accountName.toLowerCase() || !password) throw new Error('账号或密码有误。');
    const attempt = ++generation;
    const value = await authenticate('password', { email: accountEmail, password }, AbortSignal.timeout(15000));
    if (attempt !== generation) return;
    setSession(value);
    baseline = getBaseline();
  }

  async function signOut() {
    const token = session?.access_token;
    generation++;
    inFlight?.abort();
    setSession(null);
    baseline = undefined;
    if (token) await api('/auth/v1/logout?scope=local', { method: 'POST', token, signal: AbortSignal.timeout(5000) }).catch(() => {});
  }

  async function freshToken(signal, force = false) {
    const storedSession = read(sessionKey);
    if (validSession(storedSession) && storedSession.user.id === session.user.id
      && storedSession.expiresAt > session.expiresAt) session = storedSession;
    if (force || session.expiresAt - Date.now() < 60000) {
      const refreshToken = session.refresh_token;
      try {
        const value = await authenticate('refresh_token', { refresh_token: refreshToken }, signal);
        signal.throwIfAborted();
        setSession(value);
      } catch (error) {
        if (!signal.aborted && [400, 401, 403].includes(error.status)) setSession(null);
        throw error;
      }
    }
    return session.access_token;
  }

  async function synchronize(readLocal, apply, signal) {
    let token = await freshToken(signal);
    const table = '/rest/v1/exam_progress';
    const path = table + '?user_id=eq.' + session.user.id;
    for (let attempt = 0; attempt < 4; attempt++) {
      signal.throwIfAborted();
      let response = await api(path + '&select=revision,progress', { token, signal });
      if (response.status === 401 && attempt === 0) {
        token = await freshToken(signal, true);
        continue;
      }
      if (!response.ok) throw new Error('无法读取云端作答。');
      const [row] = await response.json();
      if (row && (!Number.isSafeInteger(row.revision) || row.revision < 1 || !validProgress(row.progress))) {
        throw new Error('云端作答格式无效。');
      }
      signal.throwIfAborted();
      const remote = row?.progress ?? empty();
      const snapshot = structuredClone(readLocal());
      const merged = mergeExamProgress(baseline, snapshot, remote);
      if (!sameExamProgress(remote, merged)) {
        const target = row ? path + '&revision=eq.' + row.revision : table;
        response = await api(target, { method: row ? 'PATCH' : 'POST', token, signal, body: {
          user_id: session.user.id, revision: (row?.revision ?? 0) + 1, progress: merged,
        } });
        if (!row && response.status === 409) continue;
        if (!response.ok) throw new Error('无法保存云端作答。');
        if (!(await response.json()).length) continue;
      }
      signal.throwIfAborted();
      // Keep edits made while the upload was in flight and sync them on the next pass.
      const latest = readLocal();
      const next = mergeExamProgress(snapshot, merged, latest);
      if (!sameExamProgress(latest, next)) apply(next);
      baseline = merged;
      write(baselineKey, { user: session.user.id, progress: merged });
      return !sameExamProgress(merged, next);
    }
    throw new Error('云端记录正在更新，请重试。');
  }

  return {
    configured,
    get signedIn() { return Boolean(session); },
    get name() { return session ? accountName : null; },
    signIn, signOut,
    async sync(readLocal, apply) {
      if (!session || inFlight) return false;
      const controller = new AbortController();
      inFlight = controller;
      try {
        return await synchronize(readLocal, apply, AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]));
      } finally {
        if (inFlight === controller) inFlight = undefined;
      }
    },
  };
}
