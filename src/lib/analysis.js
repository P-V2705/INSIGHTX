import { parseDateValue, parseNumber } from './values.js';
import { completenessBand, defaultAggregation } from './profile.js';
import { formatCount, formatCountUnit, formatMeasure, formatPercent } from './format.js';
import { getFocus } from './focus.js';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function getColumn(dataset, key) {
  if (!dataset || !key) return null;
  return dataset.columns.find((column) => column.key === key) || null;
}

export function numericColumns(dataset) {
  return dataset ? dataset.columns.filter((column) => column.kind === 'numeric') : [];
}

export function dateColumns(dataset) {
  return dataset ? dataset.columns.filter((column) => column.kind === 'date') : [];
}

export function categoryColumns(dataset) {
  return dataset
    ? dataset.columns.filter(
        (column) => column.kind === 'category' && column.distinctCount >= 2 && column.distinctCount <= 30,
      )
    : [];
}

function aggregate(values, count, mode) {
  if (!count) return 0;
  return mode === 'avg' ? values / count : values;
}

function shortDate(date, granularity) {
  const day = date.getUTCDate();
  const month = date.getUTCMonth();
  const year = date.getUTCFullYear();
  if (granularity === 'day') return `${day} ${MONTH_SHORT[month]}`;
  if (granularity === 'month') return `${MONTH_SHORT[month]} '${String(year).slice(-2)}`;
  return `Q${Math.floor(month / 3) + 1} '${String(year).slice(-2)}`;
}

function longDate(date, granularity) {
  const month = date.getUTCMonth();
  const year = date.getUTCFullYear();
  if (granularity === 'day') return `${date.getUTCDate()} ${MONTH_LONG[month]} ${year}`;
  if (granularity === 'month') return `${MONTH_LONG[month]} ${year}`;
  return `Q${Math.floor(month / 3) + 1} ${year}`;
}

function recordTrend(dataset, measure, aggregation) {
  const entries = [];
  dataset.rows.forEach((row, index) => {
    const value = parseNumber(row[measure.index]);
    if (value !== null) entries.push({ value, index });
  });

  if (!entries.length) {
    return {
      points: [],
      count: 0,
      skipped: dataset.rowCount,
      axisLabel: 'Record order',
      granularity: 'records',
      note: 'No numeric values are available for this measure.',
    };
  }

  const maxPoints = 48;
  const bucketSize = Math.max(1, Math.ceil(entries.length / maxPoints));
  const points = [];
  for (let start = 0; start < entries.length; start += bucketSize) {
    const bucket = entries.slice(start, start + bucketSize);
    const total = bucket.reduce((sum, entry) => sum + entry.value, 0);
    const first = bucket[0];
    const last = bucket[bucket.length - 1];
    const label = bucket.length === 1 ? `Row ${first.index + 1}` : `Rows ${first.index + 1}–${last.index + 1}`;
    points.push({
      label,
      fullLabel: label,
      value: aggregate(total, bucket.length, aggregation),
      count: bucket.length,
      key: start,
    });
  }

  return {
    points,
    count: entries.length,
    skipped: dataset.rowCount - entries.length,
    axisLabel: 'Record order',
    granularity: 'records',
    note:
      dataset.rowCount > entries.length
        ? `${dataset.rowCount - entries.length} ${dataset.rowCount - entries.length === 1 ? 'row' : 'rows'} without a numeric value ${dataset.rowCount - entries.length === 1 ? 'was' : 'were'} excluded.`
        : 'Each point summarizes a consecutive group of imported rows.',
  };
}

function dateTrend(dataset, measure, dateColumn, aggregation) {
  const entries = [];
  let skipped = 0;
  dataset.rows.forEach((row) => {
    const value = parseNumber(row[measure.index]);
    const date = parseDateValue(row[dateColumn.index]);
    if (value === null || !date) {
      skipped += 1;
      return;
    }
    entries.push({ value, date });
  });

  if (entries.length < 2) {
    return {
      points: [],
      count: entries.length,
      skipped,
      axisLabel: `${dateColumn.name}`,
      granularity: 'date',
      note: 'Two or more records with both a valid date and a numeric measure are required to draw a trend.',
    };
  }

  entries.sort((a, b) => a.date - b.date);
  const firstDate = entries[0].date;
  const lastDate = entries[entries.length - 1].date;
  const spanDays = Math.max(1, (lastDate - firstDate) / 86400000);
  const granularity = spanDays <= 62 ? 'day' : spanDays <= 950 ? 'month' : 'quarter';

  const buckets = new Map();
  for (const entry of entries) {
    const year = entry.date.getUTCFullYear();
    const month = entry.date.getUTCMonth();
    let key;
    if (granularity === 'day') {
      key = year * 10000 + (month + 1) * 100 + entry.date.getUTCDate();
    } else if (granularity === 'month') {
      key = year * 100 + month;
    } else {
      key = year * 10 + Math.floor(month / 3);
    }
    if (!buckets.has(key)) {
      buckets.set(key, { date: entry.date, sum: 0, count: 0 });
    }
    const bucket = buckets.get(key);
    bucket.sum += entry.value;
    bucket.count += 1;
  }

  const points = [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([key, bucket]) => {
      const year = bucket.date.getUTCFullYear();
      const month = bucket.date.getUTCMonth();
      const xTime =
        granularity === 'day'
          ? Date.UTC(year, month, bucket.date.getUTCDate())
          : granularity === 'month'
            ? Date.UTC(year, month, 1)
            : Date.UTC(year, Math.floor(month / 3) * 3, 1);
      return {
        key,
        xTime,
        label: shortDate(bucket.date, granularity),
        fullLabel: longDate(bucket.date, granularity),
        value: aggregate(bucket.sum, bucket.count, aggregation),
        count: bucket.count,
      };
    });

  const cadence = granularity === 'day' ? 'day' : granularity === 'month' ? 'month' : 'quarter';
  return {
    points,
    count: entries.length,
    skipped,
    axisLabel: cadence === 'day' ? 'Daily' : cadence === 'month' ? 'Monthly' : 'Quarterly',
    granularity: cadence,
    note:
      `${points.length} ${cadence}${points.length === 1 ? '' : 's'} grouped by "${dateColumn.name}"` +
      (skipped ? ` · ${formatCountUnit(skipped, 'row')} excluded for a missing measure or invalid date.` : '.'),
  };
}

function buildTrend(dataset, measure, config, aggregation) {
  if (config.xAxisKey && config.xAxisKey !== '__record__') {
    const dateColumn = getColumn(dataset, config.xAxisKey);
    if (dateColumn && dateColumn.kind === 'date') {
      const trend = dateTrend(dataset, measure, dateColumn, aggregation);
      return {
        ...trend,
        xAxisKind: 'date',
        xAxisKey: dateColumn.key,
        xAxisName: dateColumn.name,
      };
    }
  }
  const trend = recordTrend(dataset, measure, aggregation);
  return { ...trend, xAxisKind: 'record', xAxisKey: '__record__', xAxisName: 'Record order' };
}

function calculateChange(points) {
  if (!points || points.length < 2) {
    return {
      available: false,
      reason: points?.length === 1 ? 'Only one charted point is available.' : 'Not enough charted points to compare.',
    };
  }
  const first = points[0];
  const last = points[points.length - 1];
  if (!(first.value > 0)) {
    return {
      available: false,
      reason: 'The first charted value is zero or negative, so a percentage change would mislead.',
      firstLabel: first.fullLabel,
      lastLabel: last.fullLabel,
    };
  }
  const rawPct = ((last.value - first.value) / first.value) * 100;
  const pct = Math.round(rawPct * 10) / 10;
  return {
    available: true,
    pct,
    direction: pct > 0.5 ? 'up' : pct < -0.5 ? 'down' : 'flat',
    firstLabel: first.fullLabel,
    lastLabel: last.fullLabel,
    firstValue: first.value,
    lastValue: last.value,
  };
}

function recordContext(dataset, row, category) {
  const parts = [];
  const dateColumn = dataset.columns.find((column) => column.kind === 'date');
  if (dateColumn) {
    const date = parseDateValue(row[dateColumn.index]);
    if (date) {
      parts.push(
        new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' }).format(date),
      );
    }
  }
  if (category && row[category.index] !== null && row[category.index] !== undefined) {
    parts.push(String(row[category.index]));
  }
  return parts.join(' · ');
}

function buildCategoryBreakdown(dataset, measure, category, aggregation) {
  if (!category) return null;

  const groups = new Map();
  let included = 0;
  dataset.rows.forEach((row) => {
    const rawLabel = row[category.index];
    if (rawLabel === null || rawLabel === undefined || String(rawLabel).trim() === '') return;
    const value = parseNumber(row[measure.index]);
    if (value === null) return;
    const label = String(rawLabel).trim();
    if (!groups.has(label)) groups.set(label, { label, sum: 0, count: 0 });
    const group = groups.get(label);
    group.sum += value;
    group.count += 1;
    included += 1;
  });

  if (!groups.size) {
    return {
      available: false,
      items: [],
      reason: `No records contain both a ${category.name} value and a numeric ${measure.name} value.`,
      total: 0,
      count: 0,
      excluded: dataset.rowCount,
      aggregation,
      categoryName: category.name,
      measureName: measure.name,
    };
  }

  const allItems = [...groups.values()]
    .map((group) => ({
      label: group.label,
      value: aggregate(group.sum, group.count, aggregation),
      count: group.count,
      sum: group.sum,
      isOther: false,
    }))
    .sort((a, b) => b.value - a.value);

  const overallSum = allItems.reduce((sum, item) => sum + item.sum, 0);
  const totalGroups = allItems.length;
  let items = allItems;
  let folded = 0;

  if (allItems.length > 8) {
    const top = allItems.slice(0, 7);
    const rest = allItems.slice(7);
    const restSum = rest.reduce((sum, item) => sum + item.sum, 0);
    const restCount = rest.reduce((sum, item) => sum + item.count, 0);
    top.push({
      label: 'Other',
      value: aggregate(restSum, restCount, aggregation),
      count: restCount,
      sum: restSum,
      isOther: true,
    });
    items = top;
    folded = rest.length;
  }

  items = items.map((item) => ({
    ...item,
    share: overallSum > 0 ? Math.round((item.sum / overallSum) * 1000) / 10 : null,
  }));

  return {
    available: allItems.length >= 2,
    items,
    allItemCount: allItems.length,
    totalGroups,
    folded,
    excluded: dataset.rowCount - included,
    total: overallSum,
    count: included,
    aggregation,
    categoryName: category.name,
    measureName: measure.name,
    reason:
      allItems.length < 2
        ? `"${category.name}" contains a single value, so there is nothing to compare.`
        : null,
  };
}

function trendInsight(measure, trend, change, aggregation) {
  if (trend.points.length < 3 || !change.available) return null;
  const pct = Math.abs(change.pct);
  const label = trend.granularity === 'records' ? 'across the imported records' : `across the ${trend.axisLabel.toLowerCase()} timeline`;
  const isFlat = pct < 0.5;
  const title = isFlat
    ? `${measure.name} held broadly steady ${label}`
    : `${measure.name} ${change.pct > 0 ? 'increased' : 'decreased'} ${formatPercent(pct)} ${label}`;
  const body =
    change.direction === 'flat'
      ? `The charted ${aggregation === 'avg' ? 'average' : 'total'} moved between ${formatMeasure(change.firstValue, measure)} and ${formatMeasure(change.lastValue, measure)}. This describes the imported data, not a forecast.`
      : `From ${change.firstLabel} to ${change.lastLabel}, the ${aggregation === 'avg' ? 'average' : 'total'} moved ${change.pct > 0 ? 'up' : 'down'} ${formatPercent(pct)}. This is an observed change, not a forecast.`;
  return { tag: 'Trend', tone: 'trend', title, body };
}

function categoryInsight(measure, categories, aggregation) {
  if (!categories?.available || categories.items.length < 2) return null;
  const leader = categories.items[0];
  const runnerUp = categories.items[1];
  if (aggregation === 'avg') {
    return {
      tag: 'Comparison',
      tone: 'category',
      title: `${leader.label} has the highest average ${measure.name.toLowerCase()}`,
      body: `${leader.label} averages ${formatMeasure(leader.value, measure)} across ${formatCountUnit(leader.count, 'record')}, compared with ${formatMeasure(runnerUp.value, measure)} for ${runnerUp.label}. Averages use records where both fields are populated.`,
    };
  }
  const share = leader.share ?? 0;
  const gap = Math.max(0, share - (runnerUp.share ?? 0));
  return {
    tag: 'Concentration',
    tone: 'category',
    title: `${leader.label} accounts for ${formatPercent(share)} of total ${measure.name.toLowerCase()}`,
    body: `${runnerUp.label} follows at ${formatPercent(runnerUp.share ?? 0)}—a ${formatPercent(gap)} gap. ${categories.totalGroups} ${categories.categoryName} groups are represented${categories.folded ? '; smaller groups are combined as Other' : ''}.`,
  };
}

function qualityInsight(dataset, completeness) {
  const high = completeness.pct >= 95;
  return {
    tag: 'Data quality',
    tone: 'quality',
    title: high
      ? `${formatPercent(completeness.pct)} of dataset cells are populated`
      : `Missing values affect ${formatPercent(100 - completeness.pct)} of dataset cells`,
    body: `${formatCount(completeness.missingCells)} of ${formatCount(completeness.cellCount)} cells are blank across ${formatCountUnit(dataset.rowCount, 'record')}. Calculations skip blanks; completeness does not validate whether values are correct.`,
  };
}

function distributionInsight(measure, values) {
  if (values.length < 2) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);

  if (max === min) {
    return {
      tag: 'Distribution',
      tone: 'distribution',
      title: `Every populated record reports the same ${measure.name.toLowerCase()}`,
      body: `${formatMeasure(max, measure)} appears across all ${formatCount(values.length)} records with a numeric value. There is no record-level variation to compare.`,
    };
  }

  if (values.length >= 8) {
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
    const deviation = Math.sqrt(variance);
    if (deviation > 0) {
      const outliers = values.filter((value) => Math.abs((value - mean) / deviation) > 2.5);
      if (outliers.length) {
        return {
          tag: 'Outliers',
          tone: 'distribution',
          title: `${outliers.length} record${outliers.length === 1 ? '' : 's'} sit far outside the typical range`,
          body: `These values are more than 2.5 standard deviations from the mean of ${formatMeasure(mean, measure)}. The highest is ${formatMeasure(max, measure)}. Review them before treating the total as typical.`,
        };
      }
    }
  }

  const ratio = mean !== 0 ? Math.abs(max / mean) : null;
  return {
    tag: 'Distribution',
    tone: 'distribution',
    title:
      ratio !== null && ratio >= 1.2
        ? `The highest ${measure.name.toLowerCase()} is ${ratio.toFixed(1)}× the average`
        : `${measure.name} ranges from ${formatMeasure(min, measure)} to ${formatMeasure(max, measure)}`,
    body: `Average ${formatMeasure(mean, measure)} across ${formatCount(values.length)} populated records. No values are estimated; this range comes directly from the imported rows.`,
  };
}

export function signatureForConfig(config = {}) {
  return [
    config.focus || 'growth',
    config.measureKey ?? '',
    config.categoryKey || '',
    config.xAxisKey || '__record__',
    config.aggregation === 'avg' ? 'avg' : 'sum',
  ].join('|');
}

function orderInsights(insights, focus) {
  const rank = (tone) => {
    const base = { trend: 0, category: 1, quality: 2, distribution: 3 };
    if (focus === 'quality') return { quality: 0, trend: 1, category: 2, distribution: 3 }[tone] ?? 9;
    if (focus === 'drivers' || focus === 'segments') return { category: 0, trend: 1, quality: 2, distribution: 3 }[tone] ?? 9;
    return base[tone] ?? 9;
  };
  return insights.filter(Boolean).sort((a, b) => rank(a.tone) - rank(b.tone)).slice(0, 4);
}

export function analyzeDataset(dataset, rawConfig = {}) {
  if (!dataset || !dataset.rowCount) {
    return {
      available: false,
      reason: 'Import a dataset before the analysis can be prepared.',
    };
  }

  const config = {
    focus: rawConfig.focus || 'growth',
    measureKey: rawConfig.measureKey ?? null,
    categoryKey: rawConfig.categoryKey || null,
    xAxisKey: rawConfig.xAxisKey || '__record__',
    aggregation: rawConfig.aggregation === 'avg' ? 'avg' : 'sum',
  };

  const measure = getColumn(dataset, config.measureKey);
  if (!measure) {
    return {
      available: false,
      reason: 'Choose a numeric measure in session setup to prepare the analysis.',
      config,
    };
  }
  if (measure.kind !== 'numeric') {
    return {
      available: false,
      reason: `"${measure.name}" is not a numeric field, so it cannot be used as the primary measure.`,
      config,
      measure,
    };
  }

  const aggregation = config.aggregation || defaultAggregation(measure);
  const category = config.categoryKey ? getColumn(dataset, config.categoryKey) : null;
  const focus = getFocus(config.focus);

  const values = [];
  let highest = null;
  dataset.rows.forEach((row, index) => {
    const value = parseNumber(row[measure.index]);
    if (value === null) return;
    values.push(value);
    if (!highest || value > highest.value) highest = { value, index };
  });

  const validCount = values.length;
  const missingCount = dataset.rowCount - validCount;
  const total = values.reduce((sum, value) => sum + value, 0);
  const average = validCount ? total / validCount : null;
  const trend = buildTrend(dataset, measure, config, aggregation);
  const change = calculateChange(trend.points);
  const categories = buildCategoryBreakdown(dataset, measure, category, aggregation);

  const highestRow = highest ? dataset.rows[highest.index] : null;
  const highestContext =
    highest && highestRow ? recordContext(dataset, highestRow, category) : '';

  const measureLabel = measure.name.toLowerCase();
  const metrics = [
    {
      id: 'total',
      label: measure.name.toLowerCase().startsWith('total') ? measure.name : `Total ${measureLabel}`,
      valueLabel: formatMeasure(total, measure),
      hint: `Sum of ${formatCountUnit(validCount, 'populated record')}${
        missingCount ? ` · ${formatCount(missingCount)} missing` : ''
      }`,
      tone: 'default',
    },
    {
      id: 'average',
      label: `Average ${measureLabel}`,
      valueLabel: average === null ? '—' : formatMeasure(average, measure),
      hint: `Mean across ${formatCountUnit(validCount, 'numeric record')}`,
      tone: 'default',
    },
    {
      id: 'highest',
      label: `Peak ${measureLabel}`,
      valueLabel: highest ? formatMeasure(highest.value, measure) : '—',
      hint: highestContext ? `Highest record · ${highestContext}` : 'Highest single value in the imported rows',
      tone: 'default',
    },
    change.available
      ? {
          id: 'change',
          label: 'Change',
          valueLabel: `${change.pct > 0 ? '+' : ''}${formatPercent(change.pct)}`,
          hint: `${change.firstLabel} → ${change.lastLabel}`,
          tone: change.direction,
        }
      : {
          id: 'change',
          label: 'Change',
          valueLabel: 'Not available',
          hint: change.reason,
          tone: 'muted',
        },
  ];

  const band = completenessBand(dataset.completeness);
  const completeness = {
    pct: dataset.completeness,
    missingCells: dataset.missingCells,
    cellCount: dataset.cellCount,
    rowCount: dataset.rowCount,
    columnCount: dataset.columnCount,
    band: band.label,
    tone: band.tone,
  };

  const insights = orderInsights(
    [
      trendInsight(measure, trend, change, aggregation),
      categoryInsight(measure, categories, aggregation),
      qualityInsight(dataset, completeness),
      distributionInsight(measure, values),
    ],
    config.focus,
  );

  const notes = [
    `Trend values are ${aggregation === 'avg' ? 'averages' : 'totals'} per ${
      trend.granularity === 'records' ? 'consecutive record group' : trend.granularity
    } based on "${measure.name}".`,
    change.available
      ? 'Change compares the first and last charted points, not the first and last individual rows.'
      : change.reason,
    'Completeness counts blank cells. It does not validate accuracy, duplicates, or data entry quality.',
    'Records with a blank or non-numeric measure are excluded from measure calculations.',
  ];
  if (categories?.excluded) {
    notes.push(`${formatCountUnit(categories.excluded, 'row')} ${categories.excluded === 1 ? 'was' : 'were'} excluded from the category comparison due to a blank or non-numeric value.`);
  }

  const signature = signatureForConfig({
    ...config,
    categoryKey: category?.key ?? null,
    xAxisKey: trend.xAxisKey,
    aggregation,
  });

  return {
    available: true,
    config: {
      ...config,
      categoryKey: category?.key ?? null,
      xAxisKey: trend.xAxisKey,
      aggregation,
    },
    signature,
    focus,
    measure,
    category,
    aggregation,
    xAxis: {
      kind: trend.xAxisKind,
      key: trend.xAxisKey,
      name: trend.xAxisName,
    },
    metrics,
    completeness,
    trend,
    categories,
    insights,
    notes,
    validCount,
    missingCount,
    total,
    average,
  };
}
