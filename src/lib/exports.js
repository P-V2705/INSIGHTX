import { strToU8, zipSync } from 'fflate';
import { csvEscape, filenameSlug, formatBytes, formatCount, formatCountUnit, formatDateTime, todayStamp } from './format.js';

const AGGREGATION_LABEL = { sum: 'Sum', avg: 'Average' };
const SVG_NS = 'http://www.w3.org/2000/svg';

function csvCell(value) {
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(value)) {
    return csvEscape(`'${value}`);
  }
  return csvEscape(value);
}

function sourceKind(source) {
  if (!source) return 'Unknown';
  if (source.kind === 'sample') return 'Built-in sample dataset';
  return `Imported ${source.format || 'file'}`;
}

export function buildSummaryCsv(report) {
  const rows = [['Section', 'Item', 'Value', 'Detail']];
  const add = (section, item, value = '', detail = '') => rows.push([section, item, value, detail]);

  add('Session', 'Source', report.source?.fileName || 'Unknown', sourceKind(report.source));
  if (report.source?.sheetName) add('Session', 'Worksheet', report.source.sheetName);
  if (report.source?.sizeBytes) add('Session', 'File size', formatBytes(report.source.sizeBytes));
  if (report.sourceReference?.url) {
    add('Session', 'Source reference', report.sourceReference.url, 'Reference only; the file was imported separately.');
  }
  add(
    'Session',
    'Rows imported',
    report.dataset.rowCount,
    report.dataset.truncated
      ? report.dataset.sourceRowCount
        ? `Import limit applied; source contains about ${report.dataset.sourceRowCount} rows.`
        : 'Import limit applied; the source contains additional rows.'
      : 'All parsed rows included.',
  );
  add('Session', 'Columns', report.dataset.columnCount);
  add(
    'Session',
    'Completeness',
    `${report.completeness.pct}%`,
    `${formatCount(report.completeness.missingCells)} blank of ${formatCount(report.completeness.cellCount)} cells.`,
  );
  add('Session', 'Focus', report.focus?.label || '', report.focus?.description || '');
  add('Session', 'Primary measure', report.config.measureName, AGGREGATION_LABEL[report.config.aggregation]);
  add('Session', 'Group by', report.config.categoryName || 'None');
  add('Session', 'Time axis', report.config.xAxisName);
  add('Session', 'Report finalized', formatDateTime(report.finalizedAt));
  add('Session', 'Storage', 'Browser local storage', 'No account-based cloud storage in this frontend-only build.');

  rows.push([]);
  add('Key measures', 'Label', 'Value', 'Context');
  for (const metric of report.metrics || []) {
    add('Key measures', metric.label, metric.valueLabel, metric.hint);
  }

  rows.push([]);
  add('Trend series', 'Period', 'Value', 'Records in point');
  for (const point of report.trend?.points || []) {
    add('Trend series', point.fullLabel, point.value, point.count);
  }

  if (report.categories?.items?.length) {
    rows.push([]);
    add('Category breakdown', 'Category', 'Value', 'Share / records');
    for (const item of report.categories.items) {
      add(
        'Category breakdown',
        item.label,
        item.value,
        `${item.share === null || item.share === undefined ? 'Share not applicable' : `${item.share}% share`} · ${formatCountUnit(item.count, 'record')}`,
      );
    }
  }

  rows.push([]);
  add('Insights', 'Type', 'Finding', 'Detail');
  for (const insight of report.insights || []) {
    add('Insights', insight.tag, insight.title, insight.body);
  }

  rows.push([]);
  add('Method notes', 'Note', '', '');
  for (const note of report.notes || []) add('Method notes', note);

  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

function serializeChartSvg(element, title, subtitle) {
  if (!element || element.tagName?.toLowerCase() !== 'svg') return null;
  const clone = element.cloneNode(true);
  clone.querySelectorAll('[data-export-ignore]').forEach((node) => node.remove());

  const viewBox = (element.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
  const width = Number.isFinite(viewBox[2]) && viewBox[2] > 0 ? viewBox[2] : element.clientWidth || 720;
  const height = Number.isFinite(viewBox[3]) && viewBox[3] > 0 ? viewBox[3] : element.clientHeight || 280;
  const header = 66;
  const footer = 30;

  const output = document.createElementNS(SVG_NS, 'svg');
  output.setAttribute('xmlns', SVG_NS);
  output.setAttribute('width', String(width));
  output.setAttribute('height', String(height + header + footer));
  output.setAttribute('viewBox', `0 0 ${width} ${height + header + footer}`);
  output.setAttribute('font-family', '"Source Sans 3", "Segoe UI", Arial, sans-serif');
  output.setAttribute('role', 'img');
  output.setAttribute('aria-label', title);

  const titleNode = document.createElementNS(SVG_NS, 'title');
  titleNode.textContent = title;
  output.appendChild(titleNode);

  const background = document.createElementNS(SVG_NS, 'rect');
  background.setAttribute('width', '100%');
  background.setAttribute('height', '100%');
  background.setAttribute('fill', '#ffffff');
  output.appendChild(background);

  const headerRule = document.createElementNS(SVG_NS, 'line');
  headerRule.setAttribute('x1', '0');
  headerRule.setAttribute('x2', String(width));
  headerRule.setAttribute('y1', String(header - 14));
  headerRule.setAttribute('y2', String(header - 14));
  headerRule.setAttribute('stroke', '#E2E8F1');
  output.appendChild(headerRule);

  const titleText = document.createElementNS(SVG_NS, 'text');
  titleText.setAttribute('x', '22');
  titleText.setAttribute('y', '29');
  titleText.setAttribute('font-size', '16');
  titleText.setAttribute('font-weight', '600');
  titleText.setAttribute('fill', '#0C1A2C');
  titleText.textContent = title;
  output.appendChild(titleText);

  const subtitleText = document.createElementNS(SVG_NS, 'text');
  subtitleText.setAttribute('x', '22');
  subtitleText.setAttribute('y', '47');
  subtitleText.setAttribute('font-size', '11');
  subtitleText.setAttribute('fill', '#5B6B80');
  subtitleText.textContent = subtitle;
  output.appendChild(subtitleText);

  const brandText = document.createElementNS(SVG_NS, 'text');
  brandText.setAttribute('x', String(width - 22));
  brandText.setAttribute('y', '29');
  brandText.setAttribute('font-size', '11');
  brandText.setAttribute('font-weight', '600');
  brandText.setAttribute('letter-spacing', '0.08em');
  brandText.setAttribute('text-anchor', 'end');
  brandText.setAttribute('fill', '#8290A3');
  brandText.textContent = 'INSIGHTX';
  output.appendChild(brandText);

  const group = document.createElementNS(SVG_NS, 'g');
  group.setAttribute('transform', `translate(0 ${header})`);
  while (clone.firstChild) group.appendChild(clone.firstChild);
  output.appendChild(group);

  const footerText = document.createElementNS(SVG_NS, 'text');
  footerText.setAttribute('x', String(width - 22));
  footerText.setAttribute('y', String(height + header + footer - 9));
  footerText.setAttribute('font-size', '10');
  footerText.setAttribute('text-anchor', 'end');
  footerText.setAttribute('fill', '#8290A3');
  footerText.textContent = 'Generated from imported data · no estimated values';
  output.appendChild(footerText);

  const xml = new XMLSerializer().serializeToString(output);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${xml}`;
}

function buildReadme(report, chartFiles) {
  const lines = [
    'INSIGHTX — CHART SET',
    '====================',
    '',
    `Generated:        ${formatDateTime(report.finalizedAt)}`,
    `Source:           ${report.source?.fileName || 'Unknown'}`,
    `Source type:      ${sourceKind(report.source)}`,
  ];
  if (report.sourceReference?.url) {
    lines.push(`Source reference: ${report.sourceReference.url} (reference only; file imported separately)`);
  }
  if (report.source?.sheetName) lines.push(`Worksheet:        ${report.source.sheetName}`);
  lines.push(
    `Rows imported:    ${formatCount(report.dataset.rowCount)}${report.dataset.truncated ? ' (import row limit applied)' : ''}`,
    `Fields:           ${formatCount(report.dataset.columnCount)}`,
    `Completeness:     ${report.completeness.pct}% (${formatCount(report.completeness.missingCells)} blank cells)`,
    `Focus:            ${report.focus?.label || ''}`,
    `Primary measure:  ${report.config.measureName} (${AGGREGATION_LABEL[report.config.aggregation]})`,
    `Group by:         ${report.config.categoryName || 'None'}`,
    `Time axis:        ${report.config.xAxisName}`,
    '',
    'FILES IN THIS SET',
    '-----------------',
    ...chartFiles.map((entry) => `${entry.file.padEnd(26)}${entry.description}`),
    'summary.csv               Tabular summary of measures, trend, categories, and findings.',
    'README.txt                This file.',
    '',
    'METHOD',
    '------',
    `Trend: values are ${report.config.aggregation === 'avg' ? 'averages' : 'totals'} of "${report.config.measureName}" per ${report.trend?.granularity || 'chart point'}.`,
    ...(report.categories?.items?.length
      ? [
          `Categories: "${report.config.categoryName}" values are compared using the ${report.config.aggregation === 'avg' ? 'average' : 'total'} of "${report.config.measureName}".`,
        ]
      : []),
    'Completeness: non-empty cells divided by all cells in the imported rows. It does not validate correctness.',
    'Change: compares the first and last plotted points, not the first and last individual rows.',
    '',
    'NOTES',
    '-----',
    'All values come from the imported dataset. No trend values or insights are estimated or invented.',
    'Rows with a blank or non-numeric measure are excluded from measure calculations.',
    'This report was created in a frontend-only build. The session lives in the browser that created it; there is no account-based cloud storage.',
    'SVG files are plain vector charts. Labels, colors, and geometry can be edited in a vector design tool or a text editor.',
    '',
  );
  return lines.join('\n');
}

function triggerDownload(filename, blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function exportBaseName(report) {
  return `insightx-${filenameSlug(report.source?.fileName, 'session')}-${todayStamp()}`;
}

export function downloadSummaryCsv(report) {
  if (!report) return;
  const csv = `\uFEFF${buildSummaryCsv(report)}`;
  triggerDownload(`${exportBaseName(report)}-summary.csv`, new Blob([csv], { type: 'text/csv;charset=utf-8' }));
}

/**
 * charts: [{ file, title, subtitle, description, element }]
 */
export function downloadChartSet(report, charts) {
  if (!report) return { ok: false, message: 'No saved report is available.' };
  const available = charts.filter((chart) => chart.element);
  if (!available.length) return { ok: false, message: 'No charts are available to export for this report.' };

  const files = {};
  const exported = [];
  for (const chart of available) {
    const svg = serializeChartSvg(chart.element, chart.title, chart.subtitle);
    if (!svg) continue;
    files[chart.file] = strToU8(svg);
    exported.push(chart);
  }
  if (!exported.length) return { ok: false, message: 'The charts could not be serialized.' };

  files['README.txt'] = strToU8(buildReadme(report, exported));
  files['summary.csv'] = strToU8(`\uFEFF${buildSummaryCsv(report)}`);

  const archive = zipSync(files, { level: 6 });
  triggerDownload(`${exportBaseName(report)}-charts.zip`, new Blob([archive], { type: 'application/zip' }));
  return { ok: true, count: exported.length };
}
