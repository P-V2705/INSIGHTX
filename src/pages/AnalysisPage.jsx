import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader, StageGate } from '../components/PageHeader.jsx';
import { Notice } from '../components/Notice.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { SelectField, SegmentedControl } from '../components/Form.jsx';
import { MetricCard } from '../components/MetricCard.jsx';
import { InsightCard } from '../components/InsightCard.jsx';
import { LineChart } from '../components/charts/LineChart.jsx';
import { BarChart } from '../components/charts/BarChart.jsx';
import { Gauge } from '../components/charts/Gauge.jsx';
import {
  ArrowRight,
  ChartBar,
  ChevronDown,
  FileText,
  Gauge as GaugeIcon,
  Sparkle,
  TrendUp,
} from '../components/Icons.jsx';
import { useSession } from '../session/SessionProvider.jsx';
import { analyzeDataset, categoryColumns, dateColumns, numericColumns } from '../lib/analysis.js';
import { defaultAggregation } from '../lib/profile.js';
import { buildReportSnapshot } from '../lib/report.js';
import { FOCUS_OPTIONS, getFocus } from '../lib/focus.js';
import { formatCount, formatCountUnit, formatDateTime, formatPercent } from '../lib/format.js';

function analysisTitle(analysis) {
  if (!analysis?.available) return 'Prepare the analysis';
  if (analysis.completeness.tone === 'bad' && analysis.focus.id === 'quality') {
    return `${analysis.measure.name}, read with its gaps`;
  }
  return `${analysis.measure.name}, in context`;
}

export default function AnalysisPage() {
  const navigate = useNavigate();
  const { session, updateConfig, saveReport } = useSession();

  const dataset = session.dataset;
  const config = session.config || {};
  const numeric = useMemo(() => numericColumns(dataset), [dataset]);
  const groups = useMemo(() => categoryColumns(dataset), [dataset]);
  const timelines = useMemo(() => dateColumns(dataset), [dataset]);
  const analysis = useMemo(() => (dataset ? analyzeDataset(dataset, config) : null), [dataset, config]);

  const measure =
    dataset && config.measureKey
      ? dataset.columns.find((column) => column.key === config.measureKey) || null
      : null;
  const focusId = FOCUS_OPTIONS.some((option) => option.id === config.focus) ? config.focus : 'growth';
  const categoryKey = groups.some((column) => column.key === config.categoryKey) ? config.categoryKey : '';
  const xAxisKey =
    config.xAxisKey && config.xAxisKey !== '__record__' && timelines.some((column) => column.key === config.xAxisKey)
      ? config.xAxisKey
      : '__record__';

  if (!dataset) {
    return (
      <StageGate
        stage="Stage 03 · Analysis"
        title="Import a dataset to unlock the analysis"
        description="The analysis works only from rows you import. Start in session setup, inspect the fields, and choose a numeric measure — then this stage will compute the metrics and charts."
        primaryTo="/setup"
        primaryLabel="Open session setup"
        secondaryTo="/"
        secondaryLabel="Back to overview"
      />
    );
  }

  if (!session.prepared || !config.measureKey) {
    return (
      <StageGate
        stage="Stage 03 · Analysis"
        title="Prepare the analysis first"
        description="Your dataset is loaded, but a focus and primary numeric measure have not been confirmed. Finish session setup so every calculation has a defined measure."
        primaryTo="/setup"
        primaryLabel="Finish session setup"
        secondaryTo="/"
        secondaryLabel="Back to overview"
      />
    );
  }

  if (!analysis || !analysis.available) {
    return (
      <>
        <PageHeader
          eyebrow="Stage 03 · Analysis"
          title="The analysis cannot be prepared yet"
          description={analysis?.reason || 'The selected configuration does not contain a usable numeric measure.'}
        />
        <EmptyState
          icon={<GaugeIcon size={19} />}
          title="A numeric measure is required"
          action={
            <Link to="/setup" className="btn btn--primary">
              Review session setup
              <ArrowRight size={15} />
            </Link>
          }
        >
          {analysis?.reason ||
            'Choose a numeric field in session setup. Insightx does not estimate missing values or invent a measure.'}
        </EmptyState>
      </>
    );
  }

  const { trend, categories, completeness } = analysis;
  const savedReport = session.report;
  const reportMatches = Boolean(savedReport && savedReport.signature === analysis.signature);
  const reportStale = Boolean(savedReport && !reportMatches);
  const aggregationLabel = analysis.aggregation === 'avg' ? 'average' : 'total';

  const handleFinalize = () => {
    const snapshot = buildReportSnapshot(session, analysis);
    if (!snapshot) return;
    saveReport(snapshot);
    navigate('/report');
  };

  const changeMeasure = (key) => {
    const next = dataset.columns.find((column) => column.key === key) || null;
    updateConfig({
      measureKey: next?.key || null,
      aggregation: defaultAggregation(next),
    });
  };

  return (
    <>
      <PageHeader
        eyebrow="Stage 03 · Analysis"
        title={analysisTitle(analysis)}
        description={`${formatCountUnit(dataset.rowCount, 'row')} imported · ${analysis.measure.name} · ${analysis.focus.label}. Every value below is calculated from this session's data.`}
        actions={
          <>
            <span className="chip">
              <GaugeIcon size={11} /> Computed locally
            </span>
            <Link to="/setup" className="btn btn--secondary btn--sm">
              Edit dataset
            </Link>
          </>
        }
      />

      {reportStale && (
        <div className="analysis-banner">
          <Notice tone="warning" title="A saved report is out of date">
            The configuration changed after the report was finalized on {formatDateTime(savedReport.finalizedAt)}.
            The saved report and its downloads still reflect the earlier settings. Update the report when this
            view looks right.
          </Notice>
        </div>
      )}

      <section className="panel analysis-controls" aria-labelledby="analysis-controls-title">
        <div className="panel__head">
          <div className="panel__heading">
            <h2 className="panel__title" id="analysis-controls-title">
              Analysis configuration
            </h2>
            <p className="panel__desc">Change the measure, grouping, or focus — the view recomputes immediately.</p>
          </div>
          <span className={`chip ${analysis.completeness.tone === 'bad' ? 'chip--amber' : 'chip--blue'}`}>
            {completeness.band} completeness
          </span>
        </div>
        <div className="panel__body">
          <div className="analysis-controls__grid">
            <SelectField
              id="analysis-measure"
              label="Primary measure"
              value={measure?.key || ''}
              onChange={changeMeasure}
              disabled={!numeric.length}
              hint="Numeric fields detected in this dataset."
            >
              {numeric.map((column) => (
                <option key={column.key} value={column.key}>
                  {column.name}
                </option>
              ))}
            </SelectField>

            <SegmentedControl
              label="Aggregate as"
              value={analysis.aggregation === 'avg' ? 'avg' : 'sum'}
              onChange={(value) => updateConfig({ aggregation: value })}
              options={[
                { value: 'sum', label: 'Total' },
                { value: 'avg', label: 'Average' },
              ]}
              hint="Applied to each chart point and group."
            />

            <SelectField
              id="analysis-focus"
              label="Insight focus"
              value={focusId}
              onChange={(value) => updateConfig({ focus: value })}
              hint="Controls the order of the findings."
            >
              {FOCUS_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </SelectField>

            <SelectField
              id="analysis-group"
              label="Compare by"
              value={categoryKey}
              onChange={(value) => updateConfig({ categoryKey: value || null })}
              disabled={!groups.length}
              hint={groups.length ? 'Category groups with two or more values.' : 'No suitable category field detected.'}
            >
              <option value="">No group comparison</option>
              {groups.map((column) => (
                <option key={column.key} value={column.key}>
                  {column.name}
                </option>
              ))}
            </SelectField>

            <SelectField
              id="analysis-time"
              label="Trend axis"
              value={xAxisKey}
              onChange={(value) => updateConfig({ xAxisKey: value })}
              disabled={!timelines.length}
              hint={timelines.length ? 'Dates group by day, month, or quarter.' : 'Records are charted in import order.'}
            >
              <option value="__record__">Record order</option>
              {timelines.map((column) => (
                <option key={column.key} value={column.key}>
                  {column.name}
                </option>
              ))}
            </SelectField>
          </div>
        </div>
      </section>

      <section className="analysis-metrics" aria-label="Key measures">
        {analysis.metrics.map((metric) => (
          <MetricCard
            key={metric.id}
            label={metric.label}
            value={metric.valueLabel}
            hint={metric.hint}
            tone={metric.tone}
          />
        ))}
      </section>

      <div className="analysis-chart-grid">
        <section className="panel chart-panel" aria-labelledby="trend-title">
          <div className="panel__head">
            <div className="panel__heading">
              <h2 className="panel__title" id="trend-title">
                {analysis.measure.name}{' '}
                {trend.granularity === 'records'
                  ? 'across record order'
                  : `by ${trend.granularity}`}
              </h2>
              <p className="panel__desc">
                {aggregationLabel === 'average' ? 'Average' : 'Total'} per{' '}
                {trend.granularity === 'records' ? 'consecutive record group' : trend.granularity} · calculated from{' '}
                {formatCount(trend.count)} populated {trend.count === 1 ? 'record' : 'records'}
              </p>
            </div>
            <div className="panel__actions">
              <span className="chip">{formatCountUnit(trend.points.length, 'point')}</span>
            </div>
          </div>
          <div className="panel__body">
            {trend.points.length ? (
              <LineChart
                points={trend.points}
                unit={analysis.measure.unit}
                height={288}
                valueCaption={aggregationLabel === 'average' ? 'average per point' : 'total per point'}
                ariaLabel={`Line chart of ${aggregationLabel} ${analysis.measure.name} across ${formatCountUnit(trend.points.length, 'charted point')} using ${trend.axisLabel.toLowerCase()} from ${formatCountUnit(trend.count, 'record')}.`}
              />
            ) : (
              <EmptyState icon={<TrendUp size={18} />} title="No trend can be drawn">
                {trend.note}
              </EmptyState>
            )}
          </div>
          <div className="panel__footer">
            {trend.note}
          </div>
        </section>

        <section className="panel completeness-panel" aria-labelledby="completeness-title">
          <div className="panel__head">
            <div className="panel__heading">
              <h2 className="panel__title" id="completeness-title">
                Data completeness
              </h2>
              <p className="panel__desc">Non-empty cells across the imported rows.</p>
            </div>
          </div>
          <div className="panel__body completeness-panel__body">
            <Gauge
              value={completeness.pct}
              tone={completeness.tone}
              label="cells populated"
              capabilityLabel={completeness.band}
            />
            <dl className="completeness-facts">
              <div>
                <dt>Blank cells</dt>
                <dd className="mono">{formatCount(completeness.missingCells)}</dd>
              </div>
              <div>
                <dt>Total cells</dt>
                <dd className="mono">{formatCount(completeness.cellCount)}</dd>
              </div>
              <div>
                <dt>Fields</dt>
                <dd className="mono">{formatCount(completeness.columnCount)}</dd>
              </div>
              <div>
                <dt>Records</dt>
                <dd className="mono">{formatCount(completeness.rowCount)}</dd>
              </div>
            </dl>
            <p className="completeness-note">
              {completeness.band} coverage. Blank cells are excluded from measure calculations, but completeness
              does not validate whether recorded values are correct.
            </p>
          </div>
        </section>
      </div>

      <section className="panel chart-panel analysis-bar-panel" aria-labelledby="comparison-title">
        <div className="panel__head">
          <div className="panel__heading">
            <h2 className="panel__title" id="comparison-title">
              {analysis.category ? `${analysis.measure.name} by ${analysis.category.name}` : 'Category comparison'}
            </h2>
            <p className="panel__desc">
              {analysis.category
                ? `${aggregationLabel === 'average' ? 'Average' : 'Total'} per group${
                    categories?.folded ? ' · seven largest groups plus Other' : ''
                  }`
                : 'Choose a comparison field to break the measure down by category.'}
            </p>
          </div>
          {analysis.category && <span className="chip">{categories?.totalGroups ?? 0} groups</span>}
        </div>
        <div className="panel__body">
          {!analysis.category ? (
            <EmptyState icon={<ChartBar size={18} />} title="No group comparison selected">
              Use the “Compare by” control above to compare this measure across a categorical field such as region,
              product, or channel.
            </EmptyState>
          ) : categories?.available ? (
            <BarChart
              items={categories.items}
              unit={analysis.measure.unit}
              ariaLabel={`Bar chart comparing ${aggregationLabel} ${analysis.measure.name} across ${categories.totalGroups} ${analysis.category.name} groups. Highest: ${categories.items[0].label} at ${categories.items[0].value}.`}
            />
          ) : (
            <EmptyState icon={<ChartBar size={18} />} title="No comparison can be drawn">
              {categories?.reason || 'The selected category does not contain comparable values for this measure.'}
            </EmptyState>
          )}
        </div>
        {analysis.category && categories?.available && (
          <div className="panel__footer">
            Shares use the total of {formatCountUnit(categories.count, 'record')} with both values populated.
            {categories.excluded > 0 ? ` ${formatCountUnit(categories.excluded, 'row')} ${categories.excluded === 1 ? 'was' : 'were'} excluded.` : ''}
          </div>
        )}
      </section>

      <section className="analysis-insights" aria-labelledby="insights-title">
        <div className="analysis-section-head">
          <div>
            <span className="eyebrow">Findings</span>
            <h2 id="insights-title">What stands out in these rows</h2>
          </div>
          <p>Short, data-backed observations. None of these are forecasts.</p>
        </div>
        {analysis.insights.length ? (
          <div className="insight-grid">
            {analysis.insights.map((insight, index) => (
              <InsightCard key={`${insight.tag}-${index}`} insight={insight} />
            ))}
          </div>
        ) : (
          <EmptyState compact icon={<Sparkle size={17} />} title="No findings to report yet">
            There are not enough populated values to make a supported observation. Adjust the measure or import a
            more complete dataset.
          </EmptyState>
        )}
      </section>

      <details className="panel method-panel">
        <summary className="method-panel__summary">
          <span>
            <span className="eyebrow">Transparency</span>
            <span className="method-panel__title">How these numbers were calculated</span>
          </span>
          <ChevronDown size={16} className="method-panel__chevron" />
        </summary>
        <div className="method-panel__body">
          <ul className="method-list">
            {analysis.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
            <li>No forecasts, estimates, or generated values are included anywhere in this analysis.</li>
          </ul>
          <p className="method-foot">
            This session is stored in this browser only. The saved report is a snapshot of the configuration and
            results shown above.
          </p>
        </div>
      </details>

      <section className={`panel finalize-panel${reportMatches ? ' is-saved' : ''}`} aria-labelledby="finalize-title">
        <div className="finalize-panel__copy">
          <span className="eyebrow">Stage 03 → 04</span>
          <h2 id="finalize-title">
            {reportMatches ? 'A report matching this analysis is saved' : 'Turn this analysis into a final report'}
          </h2>
          <p>
            {reportMatches
              ? 'The saved report holds the same configuration and results. You can review it, download the summary and chart set, or update it after changing the analysis.'
              : 'Finalizing stores this exact configuration with its metrics, charts, findings, and method notes. Later edits will not change the saved report until you choose to update it.'}
          </p>
          <div className="finalize-panel__chips">
            <span className="chip">{formatCountUnit(dataset.rowCount, 'row')}</span>
            <span className="chip">{analysis.measure.name}</span>
            <span className="chip">{analysis.aggregation === 'avg' ? 'Average' : 'Total'}</span>
            <span className="chip">{getFocus(focusId).label}</span>
            {analysis.category && <span className="chip">by {analysis.category.name}</span>}
            <span className="chip">{formatPercent(completeness.pct)} complete</span>
          </div>
        </div>
        <div className="finalize-panel__actions">
          {reportMatches ? (
            <>
              <Link to="/report" className="btn btn--primary btn--lg">
                Open saved report
                <ArrowRight size={16} />
              </Link>
              <span className="finalize-panel__hint">
                Finalized {formatDateTime(savedReport.finalizedAt)} · local browser storage
              </span>
            </>
          ) : (
            <>
              <button type="button" className="btn btn--primary btn--lg" onClick={handleFinalize}>
                <FileText size={16} />
                {reportStale ? 'Update saved report' : 'Finalize report'}
              </button>
              {reportStale && (
                <Link to="/report" className="btn btn--secondary">
                  View saved version
                </Link>
              )}
              <span className="finalize-panel__hint">
                Saves to this browser · no cloud account required
              </span>
            </>
          )}
        </div>
      </section>
    </>
  );
}
