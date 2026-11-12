const STORAGE_KEY = 'insightx.session.v1';
const SESSION_VERSION = 1;

export function createEmptySession() {
  const now = new Date().toISOString();
  return {
    version: SESSION_VERSION,
    createdAt: now,
    updatedAt: now,
    source: null,
    sourceReference: null,
    dataset: null,
    config: null,
    prepared: false,
    activity: [],
    report: null,
  };
}

function isValidSession(value) {
  if (!value || typeof value !== 'object') return false;
  if (value.version !== SESSION_VERSION) return false;
  if (typeof value.createdAt !== 'string') return false;
  if (value.dataset !== null) {
    if (!value.dataset || !Array.isArray(value.dataset.rows) || !Array.isArray(value.dataset.columns)) {
      return false;
    }
  }
  if (value.config !== null && typeof value.config !== 'object') return false;
  return true;
}

export function loadSession() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isValidSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveSession(session) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    return { ok: true };
  } catch {
    return {
      ok: false,
      message:
        'This session is too large to save in browser storage. You can keep working in this tab, but reloading the page will lose the imported dataset. Browser storage is typically limited to about 5 MB.',
    };
  }
}

export function clearStoredSession() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable in privacy-restricted browsers.
  }
}

export { STORAGE_KEY };
