export function formatNumber(value, maximumFractionDigits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const digits = maximumFractionDigits ?? (abs >= 1000 ? 0 : abs >= 10 ? 1 : 2);
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(value);
}

export function formatMeasure(value, measureOrUnit) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const unit = measureOrUnit?.unit ?? measureOrUnit ?? { type: 'number' };
  let body;
  if (unit.type === 'percent') {
    body = formatNumber(value, 1);
    return `${body}%`;
  }
  body = formatNumber(value, Math.abs(value) >= 1000 ? 0 : Math.abs(value) >= 10 ? 1 : 2);
  if (unit.type === 'currency' && unit.symbol) return `${unit.symbol}${body}`;
  return body;
}

export function formatCompact(value, unit) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const formatted = new Intl.NumberFormat('en-US', {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(value);
  if (unit?.type === 'percent') return `${formatted}%`;
  if (unit?.type === 'currency' && unit.symbol) return `${unit.symbol}${formatted}`;
  return formatted;
}

export function formatCount(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatCountUnit(value, singular, plural = `${singular}s`) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${formatCount(value)} ${value === 1 ? singular : plural}`;
}

export function formatPercent(value, digits = 1) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(value)}%`;
}

export function formatBytes(bytes) {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDateTime(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatDate(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatClock(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatCell(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return formatNumber(value, Math.abs(value) < 10 ? 2 : 0);
  return String(value);
}

export function csvEscape(value) {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function filenameSlug(name, fallback = 'dataset') {
  const slug = String(name || '')
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || fallback;
}

export function todayStamp() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}
