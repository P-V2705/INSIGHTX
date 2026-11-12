const NULLISH_TEXT = /^(?:n\/?a|na|null|none|nan|undefined|--?|—)$/i;

export function isBlankValue(value) {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}

/**
 * Parses business-style numeric strings (currency symbols, grouped thousands,
 * parenthesised negatives, trailing percent signs) without guessing units.
 */
export function parseNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || NULLISH_TEXT.test(trimmed)) return null;

  let text = trimmed.replace(/[\s\u00a0]/g, '');
  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  text = text.replace(/^[$€£¥₹]/, '');
  if (text.endsWith('%')) text = text.slice(0, -1);
  text = text.replace(/,/g, '');
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) return null;

  const digits = text.replace(/^[+-]/, '');
  // Preserve identifiers such as 00123 or long numeric keys as text.
  if (/^0\d+/.test(digits) && !digits.includes('.')) return null;
  if (/^\d{13,}$/.test(digits)) return null;

  let parsed = Number(text);
  if (!Number.isFinite(parsed)) return null;
  if (negative) parsed = -parsed;
  return parsed;
}

const MONTH_INDEX = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

function validUtcDate(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

/**
 * Date parsing is deliberately conservative: full ISO dates, numeric dates,
 * and month-name formats are accepted. Bare numbers are never treated as dates.
 */
export function parseDateValue(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  }
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text || text.length > 48) return null;
  if (/^\d+$/.test(text)) return null;

  let match = text.match(/^(\d{4})[-/](\d{1,2})(?:[-/](\d{1,2}))?(?:[T\s].*)?$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = match[3] ? Number(match[3]) : 1;
    return validUtcDate(year, month, day);
  }

  match = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (match) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    const year = Number(match[3]);
    // Prefer month/day; swap when the first value cannot be a month.
    const month = first > 12 && second <= 12 ? second : first;
    const day = first > 12 && second <= 12 ? first : second;
    return validUtcDate(year, month, day);
  }

  match = text.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})$/);
  if (match && MONTH_INDEX[match[2].toLowerCase()] !== undefined) {
    return validUtcDate(Number(match[3]), MONTH_INDEX[match[2].toLowerCase()] + 1, Number(match[1]));
  }

  match = text.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/);
  if (match && MONTH_INDEX[match[1].toLowerCase()] !== undefined) {
    return validUtcDate(Number(match[3]), MONTH_INDEX[match[1].toLowerCase()] + 1, Number(match[2]));
  }

  match = text.match(/^([A-Za-z]{3,9})\.?\s+(\d{4})$/);
  if (match && MONTH_INDEX[match[1].toLowerCase()] !== undefined) {
    return validUtcDate(Number(match[2]), MONTH_INDEX[match[1].toLowerCase()] + 1, 1);
  }

  return null;
}

export function isoDateValue(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function normalizeCell(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return isoDateValue(value);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') {
    const trimmed = value.replace(/\u0000/g, '').trim();
    return trimmed === '' ? null : trimmed;
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return null;
    }
  }
  return String(value);
}
