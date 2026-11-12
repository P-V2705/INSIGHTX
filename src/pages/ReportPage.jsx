import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader, StageGate } from '../components/PageHeader.jsx';
import { Notice } from '../components/Notice.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { MetricCard } from '../components/MetricCard.jsx';
import { InsightCard } from '../components/InsightCard.jsx';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import { LineChart } from '../components/charts/LineChart.jsx';
import { BarChart } from '../components/charts/BarChart.jsx';
import { Gauge } from '../components/charts/Gauge.jsx';
import {
  ChartBar,
  ChevronDown,
  Download,
  ExternalLink,
  FileText,
  Refresh,
  Shield,
  TrendUp,
} from '../components/Icons.jsx';
import { useSession } from '../session/SessionProvider.jsx';
import { downloadChartSet, downloadSummaryCsv } from '../lib/exports.js';
import {
  formatBytes,
  formatCount,
  formatCountUnit,
  formatDateTime,
  formatPercent,
} from '../lib/format.js';

function sourceType(source) {
  if (!source) return 'Unknown source';
  if (source.kind === 'sample') return 'Built-in sample dataset';
  return `Imported ${source.format || 'file'}`;
}

function aggregationLabel(value) {
  return value === 'avg' ? 'Average' : 'Total';
}

export default function ReportPage() {
  const navigate = useNavigate();
  const { session, resetSession } = useSession();
  const [confirmReset, setConfirmReset] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState(null);

  const trendRef = useRef(null);
  const comparisonRef = useRef(null);
  const completenessRef = useRef(null);

  const report = session.report;

  if (!report) {
    const canFinalize = Boolean(session.dataset && session.prepared && session.config?.measureKey);
    return (
      <StageGate
        stage="Stage 04 · Final report"
        title="Finalize an analysis to unlock the report"
        description={
          canFinalize
            ? 'Your analysis is ready. Finalize it from the analysis page to freeze the configuration, charts, and findings into a downloadable report.'
            : 'A final report is created from a prepared analysis. Import a dataset and choose a measure first — this page never fabricates a report without one.'
        }
        primaryTo={canFinalize ? '/analysis' : '/setup'}
        primaryLabel={canFinalize ? 'Finalize the analysis' : session.dataset ? 'Finish session setup' : 'Start a session'}
        secondaryTo="/"
        secondaryLabel="Back to overview"
      />
    );
  }

  const { dataset, source, sourceReference, config, focus, trend, categories, completeness } = report;
  const measureUnit = config.measureUnit;
  const aggLabel = aggregationLabel(config.aggregation);
  const trendHasData = Boolean(trend?.points?.length);
  const categoryHasData = Boolean(categories?.available && categories.items?.length);

  const collectCharts = () => {
    const rowsLabel = `${formatCountUnit(dataset.rowCount, 'row')} imported`;
    const definitions = [
      trendHasData && {
        file: 'trend.svg',
        title: `${config.measureName} trend`,
        subtitle: `${trend.xAxisName} · ${aggLabel.toLowerCase()} per point · ${rowsLabel}`,
        description: `Line chart of ${aggLabel.toLowerCase()} ${config.measureName} per ${trend.granularity}.`,
        element: trendRef.current?.querySelector('svg'),
      },
      categoryHasData && {
        file: 'category-comparison.svg',
        title: `${config.measureName} by ${config.categoryName}`,
        subtitle: `${aggLabel} per group · ${rowsLabel}`,
        description: `Bar chart comparing ${config.measureName} across ${config.categoryName} groups.`,
        element: comparisonRef.current?.querySelector('svg'),
      },
      {
        file: 'completeness.svg',
        title: 'Data completeness',
        subtitle: `${completeness.band} coverage · ${formatCount(completeness.missingCells)} blank cells`,
        description: 'Ring gauge showing populated cells across the imported dataset.',
        element: completenessRef.current?.querySelector('svg'),
      },
    ];
    return definitions.filter(Boolean);
  };

  const handleCsv = () => {
    downloadSummaryCsv(report);
    setDownloadStatus({ tone: 'success', text: 'Summary CSV downloaded. It includes the session details, measures, chart series, categories, findings, and method notes.' });
  };

  const handleCharts = () => {
    const result = downloadChartSet(report, collectCharts());
    setDownloadStatus(
      result.ok
        ? {
            tone: 'success',
            text: `Chart set downloaded · ${result.count} editable SVG ${result.count === 1 ? 'chart' : 'charts'} with a method README and summary CSV.`,
          }
        : { tone: 'error', text: result.message || 'The chart set could not be generated.' },
    );
  };

  const handleNewSession = () => {
    resetSession();
    setConfirmReset(false);
    navigate('/setup');
  };

  return (
    <>
      <PageHeader
        eyebrow="Stage 04 · Final report"
        title="Your analysis, ready to hand over"
        description={`Saved snapshot finalized ${formatDateTime(report.finalizedAt)} · ${sourceType(source)} · ${formatCountUnit(dataset.rowCount, 'row')} imported.`}
        actions={
          <span className="chip chip--green">
            <Shield size={11} /> Saved in this browser
          </span>
        }
      />

      <section className="panel report-downloads" aria-labelledby="downloads-title">
        <div className="report-downloads__copy">
          <span className="eyebrow">Deliverables</span>
          <h2 id="downloads-title">Download the summary or the full chart set</h2>
          <p>
            The CSV carries every measure, chart series, category share, finding, and method note. The ZIP contains
            editable SVG charts, a short README, and a copy of the summary CSV.
          </p>
          <div className="report-downloads__meta">
            <span className="mono">Finalized {formatDateTime(report.finalizedAt)}</span>
            <span className="mono">{formatCountUnit(dataset.rowCount, 'row')}</span>
            <span className="mono">{formatPercent(completeness.pct)} complete</span>
          </div>
        </div>
        <div className="report-downloads__actions">
          <button type="button" className="btn btn--ghost-light" onClick={handleCsv}>
            <Download size={16} />
            Download summary CSV
          </button>
          <button type="button" className="btn btn--light" onClick={handleCharts}>
            <Download size={16} />
            Download chart set
            <span className="report-downloads__zip">ZIP</span>
          </button>
          <p className="report-downloads__note">
            Charts export as plain SVG files that can be edited in a vector tool or text editor. No
            account-based cloud storage is used.
          </p>
        </div>
      </section>

      <p className={`report-download__status${downloadStatus ? ` is-${downloadStatus.tone}` : ''}`} role="status" aria-live="polite">
        {downloadStatus?.text || ''}
      </p>

      <div className="report-summary-grid">
        <section className="panel report-summary" aria-labelledby="source-summary-title">
          <div className="panel__head">
            <div className="panel__heading">
              <h2 className="panel__title" id="source-summary-title">
                Session & source
              </h2>
              <p className="panel__desc">The exact input this report was built from.</p>
            </div>
            <span className={`chip ${source?.kind === 'sample' ? 'chip--blue' : 'chip--green'}`}>
              {source?.kind === 'sample' ? 'Sample' : source?.format || 'File'}
            </span>
          </div>
          <div className="panel__body">
            <dl className="report-facts">
              <div>
                <dt>File</dt>
                <dd>{source?.fileName || 'Unknown'}</dd>
              </div>
              <div>
                <dt>Origin</dt>
                <dd>{sourceType(source)}</dd>
              </div>
              {source?.sheetName && (
                <div>
                  <dt>Worksheet</dt>
                  <dd>{source.sheetName}</dd>
                </div>
              )}
              {source?.sizeBytes && (
                <div>
                  <dt>File size</dt>
                  <dd className="mono">{formatBytes(source.sizeBytes)}</dd>
                </div>
              )}
              <div>
                <dt>Rows imported</dt>
                <dd>
                  <span className="mono">{formatCount(dataset.rowCount)}</span>
                  {dataset.truncated ? ' · limit applied' : ''}
                </dd>
              </div>
              <div>
                <dt>Fields</dt>
                <dd className="mono">{formatCount(dataset.columnCount)}</dd>
              </div>
              <div>
                <dt>Completeness</dt>
                <dd>
                  <span className="mono">{formatPercent(completeness.pct)}</span> · {completeness.band}
                </dd>
              </div>
              {sourceReference?.url && (
                <div>
                  <dt>Source reference</dt>
                  <dd>
                    <a
                      className="report-source-link"
                      href={sourceReference.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {sourceReference.host || sourceReference.url}
                      <ExternalLink size={12} />
                    </a>
                    <span className="report-facts__hint">Reference only · no data was fetched from this URL</span>
                  </dd>
                </div>
              )}
            </dl>
            {dataset.truncated && (
              <p className="report-facts__warning">
                The import row limit was applied. This report covers only the rows included in the session.
              </p>
            )}
          </div>
        </section>

        <section className="panel report-summary" aria-labelledby="config-summary-title">
          <div className="panel__head">
            <div className="panel__heading">
              <h2 className="panel__title" id="config-summary-title">
                Analysis configuration
              </h2>
              <p className="panel__desc">Fixed at the moment the report was finalized.</p>
            </div>
          </div>
          <div className="panel__body">
            <dl className="report-facts">
              <div>
                <dt>Focus</dt>
                <dd>
                  {focus?.label || '—'}
                  <span className="report-facts__hint">{focus?.description}</span>
                </dd>
              </div>
              <div>
                <dt>Primary measure</dt>
                <dd>{config.measureName}</dd>
              </div>
              <div>
                <dt>Aggregation</dt>
                <dd>{aggLabel === 'Average' ? 'Average per record' : 'Sum across records'}</dd>
              </div>
              <div>
                <dt>Group by</dt>
                <dd>{config.categoryName || 'No group comparison'}</dd>
              </div>
              <div>
                <dt>Trend axis</dt>
                <dd>{config.xAxisName}</dd>
              </div>
              <div>
                <dt>Format</dt>
                <dd className="mono">Report snapshot v1</dd>
              </div>
            </dl>
            <div className="report-config-chips">
              <span className="chip">{formatCountUnit(dataset.rowCount, 'row')}</span>
              <span className="chip">{config.measureName}</span>
              <span className="chip">{aggLabel}</span>
              {config.categoryName && <span className="chip">by {config.categoryName}</span>}
            </div>
          </div>
        </section>
      </div>

      <section className="analysis-metrics report-metrics" aria-label="Key measures from the saved report">
        {(report.metrics || []).map((metric) => (
          <MetricCard
            key={metric.id}
            label={metric.label}
            value={metric.valueLabel}
            hint={metric.hint}
            tone={metric.tone}
          />
        ))}
      </section>

      <div className="analysis-section-head report-section-head">
        <div>
          <span className="eyebrow">Charts</span>
          <h2>Previews from the saved snapshot</h2>
        </div>
        <p>Rendered from the stored values. Downloads export the same geometry as editable SVGs.</p>
      </div>

      <div className="analysis-chart-grid">
        <section className="panel chart-panel" aria-labelledby="report-trend-title">
          <div className="panel__head">
            <div className="panel__heading">
              <h2 className="panel__title" id="report-trend-title">
                {config.measureName}{' '}
                {trend.granularity === 'records' ? 'across record order' : `by ${trend.granularity}`}
              </h2>
              <p className="panel__desc">
                {aggLabel} per {trend.granularity === 'records' ? 'record group' : trend.granularity} · {formatCountUnit(trend.count, 'populated record')}
              </p>
            </div>
            <div className="panel__actions">
              <span className="chip">{formatCountUnit(trend.points?.length || 0, 'point')}</span>
            </div>
          </div>
          <div className="panel__body">
            <div className="report-chart" ref={trendRef} data-chart-svg="trend">
              {trendHasData ? (
                <LineChart
                  points={trend.points}
                  unit={measureUnit}
                  height={288}
                  valueCaption={config.aggregation === 'avg' ? 'average per point' : 'total per point'}
                  ariaLabel={`Line chart from the saved report showing ${aggLabel} ${config.measureName} across ${formatCountUnit(trend.points.length, 'point')}.`}
                />
              ) : (
                <EmptyState icon={<TrendUp size={18} />} title="No trend in this report">
                  {trend.note || 'The saved analysis did not contain enough dated numeric records for a trend.'}
                </EmptyState>
              )}
            </div>
          </div>
          <div className="panel__footer">{trend.note}</div>
        </section>

        <section className="panel completeness-panel" aria-labelledby="report-completeness-title">
          <div className="panel__head">
            <div className="panel__heading">
              <h2 className="panel__title" id="report-completeness-title">
                Data completeness
              </h2>
              <p className="panel__desc">Exported with the chart set as an SVG gauge.</p>
            </div>
          </div>
          <div className="panel__body completeness-panel__body">
            <div className="report-chart report-chart--gauge" ref={completenessRef} data-chart-svg="completeness">
              <Gauge
                value={completeness.pct}
                tone={completeness.tone}
                label="cells populated"
                capabilityLabel={completeness.band}
              />
            </div>
            <dl className="completeness-facts">
              <div>
                <dt>Blank cells</dt>
                <dd className="mono">{formatCount(completeness.missingCells)}</dd>
              </div>
              <div>
                <dt>Total cells</dt>
                <dd className="mono">{formatCount(completeness.cellCount)}</dd>
              </div>
            </dl>
            <p className="completeness-note">
              {completeness.band} coverage. Completeness counts blanks only; it does not validate accuracy.
            </p>
          </div>
        </section>
      </div>

      <section className="panel chart-panel report-bar-panel" aria-labelledby="report-comparison-title">
        <div className="panel__head">
          <div className="panel__heading">
            <h2 className="panel__title" id="report-comparison-title">
              {config.categoryName ? `${config.measureName} by ${config.categoryName}` : 'Category comparison'}
            </h2>
            <p className="panel__desc">
              {config.categoryName
                ? `${aggLabel} per group${categories?.folded ? ' · seven largest groups plus Other' : ''}`
                : 'No comparison field was included in this saved analysis.'}
            </p>
          </div>
          {config.categoryName && <span className="chip">{categories?.totalGroups || 0} groups</span>}
        </div>
        <div className="panel__body">
          <div className="report-chart" ref={comparisonRef} data-chart-svg="comparison">
            {categoryHasData ? (
              <BarChart
                items={categories.items}
                unit={measureUnit}
                ariaLabel={`Bar chart from the saved report comparing ${config.measureName} across ${categories.totalGroups} groups.`}
              />
            ) : (
              <EmptyState icon={<ChartBar size={18} />} title="No comparison in this report">
                {categories?.reason || 'This report was finalized without a category comparison field.'}
              </EmptyState>
            )}
          </div>
        </div>
        {categoryHasData && (
          <div className="panel__footer">
            Shares use {formatCountUnit(categories.count, 'record')} with both values populated.
            {categories.excluded > 0 ? ` ${formatCountUnit(categories.excluded, 'row')} ${categories.excluded === 1 ? 'was' : 'were'} excluded.` : ''}
          </div>
        )}
      </section>

      <section className="analysis-insights" aria-labelledby="report-insights-title">
        <div className="analysis-section-head">
          <div>
            <span className="eyebrow">Findings</span>
            <h2 id="report-insights-title">As recorded when the report was finalized</h2>
          </div>
          <p>These findings are copied from the saved snapshot, not recalculated on this page.</p>
        </div>
        <div className="insight-grid">
          {(report.insights || []).map((insight, index) => (
            <InsightCard key={`${insight.tag}-${index}`} insight={insight} />
          ))}
        </div>
      </section>

      <details className="panel method-panel">
        <summary className="method-panel__summary">
          <span>
            <span className="eyebrow">Transparency</span>
            <span className="method-panel__title">Method notes saved with this report</span>
          </span>
          <ChevronDown size={16} className="method-panel__chevron" />
        </summary>
        <div className="method-panel__body">
          <ul className="method-list">
            {(report.notes || []).map((note) => (
              <li key={note}>{note}</li>
            ))}
            <li>No forecasts, estimates, or generated values are included in this report.</li>
          </ul>
          <p className="method-foot">
            The CSV and chart set include these notes so the calculations can be reviewed outside this app.
          </p>
        </div>
      </details>

      <section className="panel report-session-panel" aria-labelledby="report-session-title">
        <div className="report-session-panel__copy">
          <span className="eyebrow">Browser storage</span>
          <h2 id="report-session-title">This report is saved on this device</h2>
          <p>
            Insightx has no account-based cloud storage in this build. The report lives in this browser&apos;s
            local storage alongside the session; clearing this site&apos;s data removes it. Download the CSV or
            chart set if you need a copy outside this browser.
          </p>
        </div>
        <div className="report-session-panel__actions">
          <Link to="/analysis" className="btn btn--secondary">
            <FileText size={15} />
            Back to analysis
          </Link>
          <button type="button" className="btn btn--ghost" onClick={() => setConfirmReset(true)}>
            <Refresh size={15} />
            Start a new session
          </button>
        </div>
      </section>

      <ConfirmDialog
        open={confirmReset}
        title="Start a new session?"
        description="This removes the current dataset, its configuration, activity log, and this saved report from this browser. Download anything you need first — the action cannot be undone."
        confirmLabel="Remove and start over"
        cancelLabel="Keep this report"
        tone="danger"
        onConfirm={handleNewSession}
        onCancel={() => setConfirmReset(false)}
      />
    </>
  );
}
