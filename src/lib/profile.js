import { isBlankValue, parseDateValue, parseNumber } from './values.js';

const DISTINCT_TRACK_LIMIT = 60;

const MEASURE_HINTS = [
  [/revenue|turnover|sales|income|mrr|arr|gmv|billing/i, 16],
  [/profit|earnings|ebitda|margin/i, 13],
  [/amount|value|total|spend|cost|price|balance|budget/i, 9],
  [/units|quantity|qty|orders|count|volume|visits|clicks|sessions|users|customers/i, 6],
  [/score|satisfaction|rating|sentiment|index/i, 4],
];

const CATEGORY_HINTS = [
  [/region|market|geo|country|territory|location/i, 14],
  [/category|product|service|plan|sku/i, 12],
  [/channel|source|medium|platform/i, 11],
  [/segment|tier|group|type|class/i, 10],
  [/status|stage|state|outcome/i, 8],
  [/department|team|owner|rep|manager/i, 6],
];

const IDENTIFIER_NAME = /(^|[_\s-])(id|uuid|guid|code|zip|postal|phone|year|month|day|quarter)([_\s-]|$)/i;
const PERCENT_NAME = /pct|percent|rate|share|margin|ratio/i;

function nameScore(hints, name) {
  let score = 0;
  for (const [pattern, weight] of hints) {
    if (pattern.test(name)) score = Math.max(score, weight);
  }
  return score;
}

export function completenessBand(pct) {
  if (pct >= 98) return { label: 'Excellent', tone: 'good' };
  if (pct >= 95) return { label: 'Strong', tone: 'good' };
  if (pct >= 90) return { label: 'Good', tone: 'ok' };
  if (pct >= 75) return { label: 'Fair', tone: 'warn' };
  return { label: 'Needs review', tone: 'bad' };
}

function detectUnit(name, numericStrings, numericTotal) {
  if (PERCENT_NAME.test(name)) return { type: 'percent', symbol: null };
  if (numericTotal > 0) {
    const percentSamples = numericStrings.filter((value) => /%\s*$/.test(value)).length;
    if (percentSamples / numericTotal >= 0.6) return { type: 'percent', symbol: null };
    const symbols = numericStrings
      .map((value) => value.trim().match(/^[$€£¥₹]/)?.[0])
      .filter(Boolean);
    if (symbols.length / numericTotal >= 0.6) {
      const counts = symbols.reduce((map, symbol) => {
        map[symbol] = (map[symbol] || 0) + 1;
        return map;
      }, {});
      const [symbol] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      if (symbol) return { type: 'currency', symbol };
    }
  }
  return { type: 'number', symbol: null };
}

export function profileDataset(columns, rows) {
  const rowCount = rows.length;
  let missingCells = 0;

  const profiledColumns = columns.map((column, index) => {
    let nonEmpty = 0;
    let numericCount = 0;
    let dateCount = 0;
    let numericSum = 0;
    let numericMin = Infinity;
    let numericMax = -Infinity;
    let dateMin = null;
    let dateMax = null;
    const numericStrings = [];
    const distinct = new Set();
    let distinctCapped = false;
    let samples = [];

    for (const row of rows) {
      const value = row[index];
      if (isBlankValue(value)) continue;
      nonEmpty += 1;
      if (samples.length < 3) samples.push(value);

      const numeric = parseNumber(value);
      if (numeric !== null) {
        numericCount += 1;
        numericSum += numeric;
        if (numeric < numericMin) numericMin = numeric;
        if (numeric > numericMax) numericMax = numeric;
        if (typeof value === 'string') {
          numericStrings.push(value);
        } else {
          numericStrings.push(String(value));
        }
      }

      const date = parseDateValue(value);
      if (date) {
        dateCount += 1;
        if (!dateMin || date < dateMin) dateMin = date;
        if (!dateMax || date > dateMax) dateMax = date;
      }

      if (!distinctCapped) {
        const distinctKey = typeof value === 'string' ? value.trim().toLowerCase() : String(value);
        distinct.add(distinctKey);
        if (distinct.size > DISTINCT_TRACK_LIMIT) {
          distinctCapped = true;
          distinct.clear();
        }
      }
    }

    const missingCount = rowCount - nonEmpty;
    missingCells += missingCount;
    const completeness = rowCount > 0 ? (nonEmpty / rowCount) * 100 : 0;
    const numericRatio = nonEmpty > 0 ? numericCount / nonEmpty : 0;
    const dateRatio = nonEmpty > 0 ? dateCount / nonEmpty : 0;
    const distinctCount = distinctCapped ? DISTINCT_TRACK_LIMIT + 1 : distinct.size;

    let kind = 'text';
    if (nonEmpty === 0) {
      kind = 'empty';
    } else if (numericRatio >= 0.85) {
      kind = 'numeric';
    } else if (dateRatio >= 0.8) {
      kind = 'date';
    } else if (!distinctCapped && distinctCount <= 24 && distinctCount <= Math.max(12, nonEmpty * 0.5)) {
      kind = 'category';
    }

    const unit =
      kind === 'numeric'
        ? detectUnit(column.name || column.sourceName || '', numericStrings, numericStrings.length)
        : { type: 'number', symbol: null };

    return {
      ...column,
      kind,
      nonEmpty,
      missingCount,
      completeness: Math.round(completeness * 10) / 10,
      distinctCount,
      distinctCapped,
      sampleValues: samples,
      unit,
      numeric:
        kind === 'numeric' && numericCount > 0
          ? {
              count: numericCount,
              sum: numericSum,
              min: numericMin,
              max: numericMax,
              mean: numericSum / numericCount,
            }
          : null,
      dateRange:
        kind === 'date' && dateMin && dateMax
          ? { min: dateMin.toISOString(), max: dateMax.toISOString() }
          : null,
    };
  });

  const cellCount = rowCount * columns.length;
  const completeness = cellCount > 0 ? ((cellCount - missingCells) / cellCount) * 100 : 0;
  const typeCounts = { numeric: 0, date: 0, category: 0, text: 0, empty: 0 };
  for (const column of profiledColumns) typeCounts[column.kind] += 1;

  return {
    columns: profiledColumns,
    rowCount,
    columnCount: columns.length,
    cellCount,
    missingCells,
    completeness: Math.round(completeness * 10) / 10,
    typeCounts,
  };
}

export function recommendMeasure(columns, rowCount) {
  const numericColumns = columns.filter((column) => column.kind === 'numeric' && column.distinctCount > 1);
  if (!numericColumns.length) {
    return columns.find((column) => column.kind === 'numeric') || null;
  }

  let best = null;
  let bestScore = -Infinity;
  for (const column of numericColumns) {
    const name = `${column.name} ${column.sourceName}`;
    const completeness = rowCount ? column.nonEmpty / rowCount : 0;
    let score = completeness * 22 + nameScore(MEASURE_HINTS, name);
    if (IDENTIFIER_NAME.test(name)) score -= 40;
    if (column.unit.type === 'percent') score -= 2;
    if (score > bestScore) {
      best = column;
      bestScore = score;
    }
  }
  return best;
}

export function recommendCategory(columns, rowCount) {
  const candidates = columns.filter(
    (column) =>
      column.kind === 'category' &&
      column.distinctCount >= 2 &&
      column.distinctCount <= 20 &&
      column.nonEmpty / Math.max(rowCount, 1) >= 0.6,
  );
  if (!candidates.length) return null;

  let best = null;
  let bestScore = -Infinity;
  for (const column of candidates) {
    const name = `${column.name} ${column.sourceName}`;
    const completeness = rowCount ? column.nonEmpty / rowCount : 0;
    let score = completeness * 10 + nameScore(CATEGORY_HINTS, name);
    if (column.distinctCount >= 2 && column.distinctCount <= 8) score += 5;
    if (column.distinctCount > 12) score -= 2;
    if (score > bestScore) {
      best = column;
      bestScore = score;
    }
  }
  return best;
}

export function recommendDateColumn(columns) {
  const dates = columns.filter((column) => column.kind === 'date' && column.nonEmpty > 0);
  if (!dates.length) return null;
  return [...dates].sort((a, b) => b.completeness - a.completeness)[0];
}

export function defaultAggregation(column) {
  if (!column) return 'sum';
  const name = `${column.name} ${column.sourceName}`;
  return column.unit?.type === 'percent' || PERCENT_NAME.test(name) || /score|satisfaction|rating|price|average|avg/i.test(name)
    ? 'avg'
    : 'sum';
}

export function buildDefaultConfig(columns, rowCount) {
  const measure = recommendMeasure(columns, rowCount);
  const category = recommendCategory(columns, rowCount);
  const date = recommendDateColumn(columns);
  return {
    focus: 'growth',
    measureKey: measure?.key ?? null,
    categoryKey: category?.key ?? null,
    xAxisKey: date?.key ?? '__record__',
    aggregation: defaultAggregation(measure),
  };
}
