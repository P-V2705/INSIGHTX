const SAFE_WORKSPACE_PATH = /^\/(?:setup|analysis|report)(?:[?#][^\s]*)?$/;

export function sanitizeNext(value, fallback = '/setup') {
  return typeof value === 'string' && SAFE_WORKSPACE_PATH.test(value) ? value : fallback;
}
