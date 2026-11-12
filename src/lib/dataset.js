import { isBlankValue, normalizeCell, parseDateValue, parseNumber } from './values.js';
import { profileDataset } from './profile.js';

export const IMPORT_LIMITS = {
  maxRows: 5000,
  maxFileBytes: 15 * 1024 * 1024,
  maxColumns: 80,
};

export class DatasetError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DatasetError';
  }
}

function friendlyHeader(text) {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  if (/^[a-z0-9]+(?:_[a-z0-9]+)+$/.test(cleaned)) {
    const words = cleaned.split('_');
    return words
      .map((word, index) => (index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
      .join(' ');
  }
  if (/^[a-z][a-z0-9 ]*$/.test(cleaned)) {
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  return cleaned;
}

function slugify(text, index) {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return slug && slug !== '__proto__' ? slug : `field_${index + 1}`;
}

function buildColumns(rawHeaders) {
  const keyCounts = new Map();
  const nameCounts = new Map();
  return rawHeaders.map((raw, index) => {
    const sourceName = String(raw ?? '').replace(/\s+/g, ' ').trim() || `Column ${index + 1}`;
    const baseKey = slugify(sourceName, index);
    const keyCount = (keyCounts.get(baseKey) || 0) + 1;
    keyCounts.set(baseKey, keyCount);
    const key = keyCount === 1 ? baseKey : `${baseKey}_${keyCount}`;

    const baseName = friendlyHeader(sourceName) || `Column ${index + 1}`;
    const nameCount = (nameCounts.get(baseName) || 0) + 1;
    nameCounts.set(baseName, nameCount);
    const name = nameCount === 1 ? baseName : `${baseName} (${nameCount})`;

    return { key, name, sourceName, index };
  });
}

function looksHeaderless(headerRow, dataRows) {
  if (!dataRows.length) return false;
  const filled = headerRow.filter((value) => !isBlankValue(value));
  if (!filled.length) return true;
  const typed = filled.filter((value) => parseNumber(value) !== null || parseDateValue(value) !== null);
  return typed.length === filled.length;
}

function trimBodyRows(matrix, width) {
  return matrix
    .filter((row) => Array.isArray(row) && row.some((value) => !isBlankValue(value)))
    .map((row) => Array.from({ length: width }, (_, index) => normalizeCell(row[index])));
}

function finalizeDataset(headerRow, bodyMatrix, options = {}) {
  if (!Array.isArray(headerRow) || !Array.isArray(bodyMatrix)) {
    throw new DatasetError('The dataset could not be read as a table.');
  }

  let headers = headerRow;
  let dataMatrix = bodyMatrix;
  const warnings = [];

  if (options.detectHeaderless && looksHeaderless(headerRow, bodyMatrix)) {
    const width = Math.max(headerRow.length, ...bodyMatrix.map((row) => row.length));
    headers = Array.from({ length: width }, (_, index) => `Column ${index + 1}`);
    dataMatrix = [headerRow, ...bodyMatrix];
    warnings.push('No header row was detected, so columns were named automatically.');
  }

  const width = Math.max(
    headers.length,
    ...dataMatrix.map((row) => (Array.isArray(row) ? row.length : 0)),
  );

  if (width === 0) throw new DatasetError('The file has no readable columns.');
  if (width > IMPORT_LIMITS.maxColumns) {
    throw new DatasetError(
      `This dataset has ${width} columns. Insightx supports up to ${IMPORT_LIMITS.maxColumns} columns.`,
    );
  }

  const expandedHeaders = Array.from({ length: width }, (_, index) => {
    const value = headers[index];
    return isBlankValue(value) ? `Column ${index + 1}` : value;
  });
  const columns = buildColumns(expandedHeaders);
  const allRows = trimBodyRows(dataMatrix, width);

  if (allRows.length === 0) {
    throw new DatasetError('The file has column headers but no data rows to analyze.');
  }

  const truncated = allRows.length > IMPORT_LIMITS.maxRows;
  const rows = allRows.slice(0, IMPORT_LIMITS.maxRows);
  const sourceRowCount =
    options.sourceRowCount === null || options.sourceRowCount === undefined
      ? truncated
        ? null
        : allRows.length
      : Math.max(options.sourceRowCount, allRows.length);

  if (truncated) {
    warnings.push(
      `Only the first ${IMPORT_LIMITS.maxRows.toLocaleString()} rows were imported. Later rows were not included in this session.`,
    );
  }

  const profile = profileDataset(columns, rows);

  return {
    ...profile,
    columns: profile.columns,
    rows,
    sourceRowCount,
    truncated,
    warnings,
    importedAt: new Date().toISOString(),
  };
}

export function createDatasetFromMatrix(matrix, options = {}) {
  if (!Array.isArray(matrix) || matrix.length === 0) {
    throw new DatasetError('The file did not contain any rows.');
  }
  const headerRow = Array.isArray(matrix[0]) ? matrix[0] : [];
  const body = matrix.slice(1);
  if (!body.some((row) => Array.isArray(row) && row.length)) {
    throw new DatasetError('The file did not contain any data rows.');
  }
  return finalizeDataset(headerRow, body, {
    detectHeaderless: true,
    sourceRowCount: options.sourceRowCount ?? null,
  });
}

export function createDatasetFromObjects(records, options = {}) {
  if (!Array.isArray(records)) {
    throw new DatasetError('JSON datasets must be an array of records.');
  }
  const objectRecords = records.filter((record) => record !== null && typeof record === 'object' && !Array.isArray(record));
  if (!objectRecords.length) {
    throw new DatasetError('JSON records must be objects with named fields.');
  }

  const headerKeys = [];
  const seen = new Set();
  for (const record of objectRecords) {
    for (const key of Object.keys(record)) {
      if (!seen.has(key)) {
        seen.add(key);
        headerKeys.push(key);
      }
    }
  }
  if (!headerKeys.length) throw new DatasetError('The JSON records do not contain any fields.');
  if (headerKeys.length > IMPORT_LIMITS.maxColumns) {
    throw new DatasetError(
      `This dataset has ${headerKeys.length} fields. Insightx supports up to ${IMPORT_LIMITS.maxColumns} columns.`,
    );
  }

  const matrix = [
    headerKeys,
    ...objectRecords.map((record) => headerKeys.map((key) => normalizeCell(record[key]))),
  ];

  return finalizeDataset(headerKeys, matrix.slice(1), {
    detectHeaderless: false,
    sourceRowCount: Math.max(records.length, objectRecords.length),
  });
}

export function sourceRowLabel(dataset) {
  if (!dataset) return '';
  const label = dataset.rowCount === 1 ? 'row' : 'rows';
  if (dataset.truncated) {
    return dataset.sourceRowCount
      ? `First ${dataset.rowCount.toLocaleString()} of ${dataset.sourceRowCount.toLocaleString()} source rows`
      : `First ${dataset.rowCount.toLocaleString()} ${label} (file contains more)`;
  }
  return `${dataset.rowCount.toLocaleString()} ${label}`;
}
