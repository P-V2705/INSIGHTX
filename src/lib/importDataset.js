import Papa from 'papaparse';
import * as XLSX from '@e965/xlsx';
import {
  DatasetError,
  IMPORT_LIMITS,
  createDatasetFromMatrix,
  createDatasetFromObjects,
} from './dataset.js';
import { buildSampleDataset } from './sample.js';
import { formatBytes } from './format.js';

export const SUPPORTED_EXTENSIONS = ['csv', 'tsv', 'xlsx', 'xls', 'json'];

export class ImportError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ImportError';
  }
}

function extensionOf(name) {
  const match = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : '';
}

function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function addTruncation(dataset, sourceRowCount) {
  if (dataset.rowCount < sourceRowCount) {
    dataset.truncated = true;
    dataset.sourceRowCount = sourceRowCount;
    if (!dataset.warnings.some((warning) => warning.includes('first'))) {
      dataset.warnings.push(
        `Only the first ${IMPORT_LIMITS.maxRows.toLocaleString()} rows were imported. Later rows were not included in this session.`,
      );
    }
  }
  return dataset;
}

async function parseDelimited(file, extension) {
  const text = stripBom(await file.text());
  if (!text.trim()) throw new ImportError('This file is empty. Choose a file that contains a header row and data.');

  const result = Papa.parse(text, {
    header: false,
    skipEmptyLines: 'greedy',
    preview: IMPORT_LIMITS.maxRows + 3,
    delimiter: extension === 'tsv' ? '\t' : undefined,
    delimitersToGuess: [',', '\t', ';', '|'],
  });

  if (!result.data.length) {
    throw new ImportError('No readable rows were found. Check that the file is a valid delimited text file.');
  }

  const matrix = result.data.map((row) => (Array.isArray(row) ? row : [row]));
  let dataset;
  try {
    dataset = createDatasetFromMatrix(matrix, { sourceRowCount: null });
  } catch (error) {
    if (error instanceof DatasetError) throw new ImportError(error.message);
    throw error;
  }

  const widths = new Set(matrix.map((row) => row.length));
  if (widths.size > 1) {
    dataset.warnings.push('Some rows had a different number of fields; missing cells were treated as blank.');
  }
  const parserErrors = (result.errors || []).filter((error) => error.type !== 'FieldMismatch');
  if (parserErrors.length) {
    dataset.warnings.push('The CSV parser reported malformed quoting in part of the file. Review the preview before relying on the analysis.');
  }

  return {
    dataset,
    format: extension === 'tsv' ? 'TSV' : 'CSV',
    sheetName: null,
    details: [
      `Delimiter ${result.meta?.delimiter === '\t' ? 'tab' : `"${result.meta?.delimiter || ','}"`} · UTF-8 text`,
    ],
  };
}

async function parseWorkbook(file, extension) {
  let workbook;
  try {
    const buffer = await file.arrayBuffer();
    workbook = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true });
  } catch {
    throw new ImportError('This workbook could not be read. It may be corrupted, password-protected, or use an unsupported format.');
  }

  if (!workbook.SheetNames?.length) throw new ImportError('The workbook does not contain any sheets.');

  let chosen = null;
  let matrix = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet || !sheet['!ref']) continue;
    const range = XLSX.utils.decode_range(sheet['!ref']);
    const lastRow = Math.min(range.e.r, range.s.r + IMPORT_LIMITS.maxRows + 3);
    const limitedRange = {
      ...range,
      e: { ...range.e, r: lastRow },
    };
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: true,
      defval: null,
      blankrows: false,
      range: limitedRange,
    });
    if (rows.some((row) => row.some((value) => value !== null && value !== undefined && String(value).trim() !== ''))) {
      chosen = sheetName;
      matrix = rows;
      const hasMoreRows = range.e.r > lastRow;
      break;
    }
  }

  if (!chosen) throw new ImportError('The workbook does not contain any readable data in its sheets.');

  let dataset;
  try {
    dataset = createDatasetFromMatrix(matrix, { sourceRowCount: null });
  } catch (error) {
    if (error instanceof DatasetError) throw new ImportError(error.message);
    throw error;
  }

  const notes = [`Sheet "${chosen}"${workbook.SheetNames.length > 1 ? ' · first populated sheet' : ''}`];
  if (workbook.SheetNames.length > 1) {
    dataset.warnings.push(`This workbook has ${workbook.SheetNames.length} sheets. Insightx imported "${chosen}" only.`);
  }

  return {
    dataset,
    format: extension === 'xls' ? 'XLS' : 'XLSX',
    sheetName: chosen,
    details: notes,
  };
}

function extractJsonRecords(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object') {
    const preferred = ['data', 'rows', 'records', 'items', 'results'];
    for (const key of preferred) {
      if (Array.isArray(parsed[key])) return parsed[key];
    }
    const firstArray = Object.values(parsed).find((value) => Array.isArray(value));
    if (firstArray) return firstArray;
  }
  return null;
}

async function parseJson(file) {
  const text = stripBom(await file.text());
  if (!text.trim()) throw new ImportError('This JSON file is empty.');

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ImportError('This JSON file is not valid. Check for missing commas, unclosed brackets, or trailing characters.');
  }

  const records = extractJsonRecords(parsed);
  if (!records) {
    throw new ImportError('JSON datasets must be an array of records, or an object containing an array of records.');
  }
  if (!records.length) throw new ImportError('The JSON array does not contain any records.');

  const sourceRowCount = records.length;
  const limited = records.slice(0, IMPORT_LIMITS.maxRows);
  let dataset;
  try {
    dataset = createDatasetFromObjects(limited, { sourceRowCount });
  } catch (error) {
    if (error instanceof DatasetError) throw new ImportError(error.message);
    throw error;
  }
  addTruncation(dataset, sourceRowCount);

  return {
    dataset,
    format: 'JSON',
    sheetName: null,
    details: ['Records parsed from a JSON array'],
  };
}

function makeActivity(source, dataset, details = []) {
  const base = new Date(dataset.importedAt).getTime();
  const at = (offset) => new Date(base + offset).toISOString();
  const entries = [];
  const push = (level, text) => entries.push({ level, text, at: at(entries.length * 600) });

  const size = source.sizeBytes ? ` · ${formatBytes(source.sizeBytes)}` : '';
  push(
    'info',
    source.kind === 'sample'
      ? `Sample dataset loaded · ${source.fileName}`
      : `File received · ${source.fileName}${size}`,
  );
  if (details.length) push('info', details.join(' · '));

  push(
    'ok',
    `Parsed ${dataset.rowCount.toLocaleString()} rows × ${dataset.columnCount.toLocaleString()} columns`,
  );

  const { numeric, date, category, text } = dataset.typeCounts;
  const typeParts = [
    numeric ? `${numeric} numeric` : null,
    date ? `${date} date` : null,
    category ? `${category} categorical` : null,
    text ? `${text} text` : null,
  ].filter(Boolean);
  push('info', `Detected ${typeParts.join(' · ') || 'no populated fields'}`);

  push(
    dataset.missingCells > 0 ? 'warn' : 'ok',
    `Completeness ${dataset.completeness}% · ${dataset.missingCells.toLocaleString()} blank of ${dataset.cellCount.toLocaleString()} cells`,
  );

  for (const warning of dataset.warnings) push('warn', warning);

  push(
    'ok',
    numeric
      ? 'Dataset ready · choose an analysis focus and primary measure'
      : 'Dataset loaded · no numeric field was detected, so a measure cannot be prepared',
  );

  return entries;
}

export async function importDatasetFile(file) {
  if (!(file instanceof File)) throw new ImportError('No file was selected.');
  const extension = extensionOf(file.name);

  if (!SUPPORTED_EXTENSIONS.includes(extension)) {
    throw new ImportError(
      `".${extension || 'unknown'}" is not supported. Import a CSV, TSV, XLSX, XLS, or JSON file.`,
    );
  }
  if (file.size === 0) throw new ImportError('This file is empty.');
  if (file.size > IMPORT_LIMITS.maxFileBytes) {
    throw new ImportError(
      `This file is ${formatBytes(file.size)}. Insightx accepts files up to ${formatBytes(IMPORT_LIMITS.maxFileBytes)} and ${IMPORT_LIMITS.maxRows.toLocaleString()} rows.`,
    );
  }

  let parsed;
  if (extension === 'csv' || extension === 'tsv') {
    parsed = await parseDelimited(file, extension);
  } else if (extension === 'xlsx' || extension === 'xls') {
    parsed = await parseWorkbook(file, extension);
  } else {
    parsed = await parseJson(file);
  }

  const source = {
    kind: 'file',
    fileName: file.name,
    format: parsed.format,
    sizeBytes: file.size,
    sheetName: parsed.sheetName,
    addedAt: new Date().toISOString(),
  };

  return {
    source,
    dataset: parsed.dataset,
    activity: makeActivity(source, parsed.dataset, parsed.details),
  };
}

export function loadSampleDataset() {
  const { source, dataset } = buildSampleDataset();
  return {
    source,
    dataset,
    activity: makeActivity(source, dataset, ['Deterministic 24-month B2B sales fixture']),
  };
}
