import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader.jsx';
import { Notice } from '../components/Notice.jsx';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import { SelectField, SegmentedControl } from '../components/Form.jsx';
import {
  ArrowRight,
  Check,
  CheckCircle,
  Close,
  Database,
  ExternalLink,
  FileText,
  Layers,
  Refresh,
  Shield,
  Table,
  Upload,
} from '../components/Icons.jsx';
import { useSession } from '../session/SessionProvider.jsx';
import { importDatasetFile } from '../lib/importDataset.js';
import { IMPORT_LIMITS, sourceRowLabel } from '../lib/dataset.js';
import { categoryColumns, dateColumns, numericColumns } from '../lib/analysis.js';
import { completenessBand, defaultAggregation } from '../lib/profile.js';
import { FOCUS_OPTIONS, getFocus } from '../lib/focus.js';
import {
  formatBytes,
  formatClock,
  formatCount,
  formatCountUnit,
  formatDateTime,
  formatNumber,
  formatPercent,
} from '../lib/format.js';

const LEVEL_TAG = { info: 'INFO', ok: 'OK', warn: 'WARN', error: 'ERR' };
const MAX_PREVIEW_ROWS = 8;

function previewText(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    return Number.isInteger(value) ? formatNumber(value, 0) : formatNumber(value, 4);
  }
  return String(value);
}

function unitLabel(column) {
  if (!column?.unit) return 'number';
  if (column.unit.type === 'percent') return 'percentage';
  if (column.unit.type === 'currency' && column.unit.symbol) return `${column.unit.symbol} currency`;
  return 'number';
}

function logTime(at) {
  return formatClock(at);
}

export default function SetupPage() {
  const navigate = useNavigate();
  const {
    session,
    sampleLoading,
    applyImport,
    loadSample,
    updateConfig,
    markPrepared,
    addActivity,
    setSourceReference,
    resetSession,
  } = useSession();

  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [pending, setPending] = useState(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [referenceDraft, setReferenceDraft] = useState('');
  const [referenceError, setReferenceError] = useState('');

  const fileInputRef = useRef(null);
  const logRef = useRef(null);

  const dataset = session.dataset;
  const config = session.config || {};
  const numeric = useMemo(() => numericColumns(dataset), [dataset]);
  const groups = useMemo(() => categoryColumns(dataset), [dataset]);
  const timelines = useMemo(() => dateColumns(dataset), [dataset]);
  const activity = session.activity || [];

  const measure =
    dataset && config.measureKey
      ? dataset.columns.find((column) => column.key === config.measureKey && column.kind === 'numeric') || null
      : null;
  const focusId = FOCUS_OPTIONS.some((option) => option.id === config.focus) ? config.focus : 'growth';
  const categoryKey = groups.some((column) => column.key === config.categoryKey) ? config.categoryKey : '';
  const xAxisKey =
    config.xAxisKey && config.xAxisKey !== '__record__' && timelines.some((column) => column.key === config.xAxisKey)
      ? config.xAxisKey
      : '__record__';
  const canPrepare = Boolean(dataset && measure);

  const band = dataset ? completenessBand(dataset.completeness) : null;
  const previewRows = dataset ? dataset.rows.slice(0, MAX_PREVIEW_ROWS) : [];

  useEffect(() => {
    const element = logRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [activity.length, importing]);

  const openPicker = () => {
    if (!importing) fileInputRef.current?.click();
  };

  const resetPicker = () => {
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const runImport = async (file) => {
    setImporting(true);
    setImportError('');
    resetPicker();
    try {
      const bundle = await importDatasetFile(file);
      applyImport(bundle);
      setReferenceDraft('');
      setReferenceError('');
    } catch (error) {
      const message = error?.message || 'The file could not be imported.';
      setImportError(message);
      addActivity([
        {
          level: 'error',
          text: `Import failed · ${message}`,
          at: new Date().toISOString(),
        },
      ]);
    } finally {
      setImporting(false);
      setPending(null);
    }
  };

  const runSample = async () => {
    setImporting(true);
    setImportError('');
    try {
      await loadSample();
      setReferenceDraft('');
      setReferenceError('');
    } catch {
      const message = 'The sample dataset could not be loaded. Refresh the page and try again.';
      setImportError(message);
      addActivity([{ level: 'error', text: message, at: new Date().toISOString() }]);
    } finally {
      setImporting(false);
      setPending(null);
    }
  };

  const requestFile = (file) => {
    if (!file || importing) return;
    setImportError('');
    if (dataset) {
      setPending({ kind: 'file', file });
      setConfirmReplace(true);
      return;
    }
    runImport(file);
  };

  const requestSample = () => {
    if (importing) return;
    setImportError('');
    if (dataset) {
      setPending({ kind: 'sample' });
      setConfirmReplace(true);
      return;
    }
    runSample();
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    if (importing) return;
    const file = event.dataTransfer?.files?.[0];
    if (file) requestFile(file);
  };

  const handleFileInput = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) requestFile(file);
  };

  const handleReference = (event) => {
    event.preventDefault();
    const raw = referenceDraft.trim();
    if (!raw) {
      setReferenceError('Enter a dataset URL before adding it.');
      return;
    }
    let parsed;
    try {
      parsed = new URL(raw);
    } catch {
      setReferenceError('That does not look like a valid URL. Include the full address, for example https://www.kaggle.com/datasets/…');
      return;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      setReferenceError('Only http and https links can be stored as a source reference.');
      return;
    }
    setSourceReference({
      url: parsed.toString(),
      host: parsed.hostname,
      addedAt: new Date().toISOString(),
    });
    addActivity([
      {
        level: 'info',
        text: `Source reference added · ${parsed.hostname} (reference only, not downloaded)`,
        at: new Date().toISOString(),
      },
    ]);
    setReferenceDraft(parsed.toString());
    setReferenceError('');
  };

  const removeReference = () => {
    setSourceReference(null);
    setReferenceDraft('');
    setReferenceError('');
    addActivity([
      { level: 'info', text: 'Source reference removed from this session', at: new Date().toISOString() },
    ]);
  };

  const handlePrepare = () => {
    if (!canPrepare) return;
    markPrepared();
    addActivity([
      {
        level: 'ok',
        text: `Analysis prepared · ${measure.name} · ${focusId} focus · ${formatCountUnit(dataset.rowCount, 'row')}`,
        at: new Date().toISOString(),
      },
    ]);
    navigate('/analysis');
  };

  const handleReset = () => {
    resetSession();
    setConfirmReset(false);
    setImportError('');
    setReferenceDraft('');
    setReferenceError('');
    resetPicker();
  };

  const confirmPending = () => {
    const action = pending;
    setConfirmReplace(false);
    if (!action) return;
    if (action.kind === 'file') runImport(action.file);
    else runSample();
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        className="sr-only"
        accept=".csv,.tsv,.xlsx,.xls,.json,text/csv,application/json"
        onChange={handleFileInput}
        aria-label="Choose a dataset file"
      />

      <PageHeader
        eyebrow="Stage 02 · Session setup"
        title={dataset ? 'Inspect the data before you interpret it' : 'Start with a dataset you trust'}
        description={
          dataset
            ? 'Review the parsed fields, choose the measure that matters, and confirm the analysis focus. Every calculation will use these imported rows.'
            : 'Import a business file, inspect its shape and completeness, then choose a measure. Parsing happens on this device — nothing is uploaded.'
        }
        actions={
          dataset ? (
            <>
              <span className={`chip ${session.prepared ? 'chip--green' : 'chip--amber'}`}>
                {session.prepared ? 'Analysis prepared' : 'Configuration draft'}
              </span>
              {session.prepared && (
                <Link to="/analysis" className="btn btn--secondary btn--sm">
                  Open analysis
                  <ArrowRight size={14} />
                </Link>
              )}
            </>
          ) : (
            <span className="chip">
              <Shield size={11} /> Local parsing
            </span>
          )
        }
      />

      {!dataset ? (
        <div className="setup-start">
          <section className="panel setup-import" aria-labelledby="import-title">
            <div className="setup-import__head">
              <div>
                <span className="eyebrow">Import data</span>
                <h2 id="import-title">Drop in a CSV, spreadsheet, or JSON file</h2>
                <p>
                  Insightx detects the header row, infers field types, and profiles completeness before it
                  computes anything.
                </p>
              </div>
              <span className="chip">
                <Layers size={11} /> {IMPORT_LIMITS.maxColumns} fields max
              </span>
            </div>

            <div
              className={`dropzone${dragActive ? ' is-dragging' : ''}${importing ? ' is-busy' : ''}`}
              onDragOver={(event) => {
                event.preventDefault();
                if (!importing) setDragActive(true);
              }}
              onDragEnter={(event) => {
                event.preventDefault();
                if (!importing) setDragActive(true);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setDragActive(false);
              }}
              onDrop={handleDrop}
              aria-busy={importing}
            >
              <span className="dropzone__icon" aria-hidden="true">
                {importing ? <span className="spinner spinner--dark" /> : <Upload size={22} />}
              </span>
              <h3>{importing ? 'Reading and profiling the file…' : dragActive ? 'Drop the file to import' : 'Drag a file here'}</h3>
              <p>
                CSV, TSV, XLSX, XLS, or JSON · up to {formatBytes(IMPORT_LIMITS.maxFileBytes)} and{' '}
                {formatCount(IMPORT_LIMITS.maxRows)} rows
              </p>
              <button type="button" className="btn btn--primary" onClick={openPicker} disabled={importing}>
                <FileText size={16} />
                Choose a file
              </button>
              <p className="dropzone__privacy">
                <Shield size={13} /> Files are parsed locally in this browser. No upload occurs.
              </p>
            </div>

            {importError && (
              <div className="setup-import__error">
                <Notice tone="error" title="Import failed">
                  {importError}
                </Notice>
              </div>
            )}

            <ul className="import-facts">
              <li>
                <Check size={13} /> Header rows detected automatically, including headerless files
              </li>
              <li>
                <Check size={13} /> Numbers, dates, and categories inferred from the data
              </li>
              <li>
                <Check size={13} /> Only the first populated worksheet is imported from workbooks
              </li>
            </ul>
            <p className="setup-import__tip">
              Working from a hosted dataset such as Kaggle? Import the downloaded file here, then attach the
              source URL as a reference once it loads. Insightx never downloads or bypasses access on that link.
            </p>
          </section>

          <aside className="setup-start__side">
            <section className="panel sample-card" aria-labelledby="sample-title">
              <div className="sample-card__head">
                <span className="sample-card__icon" aria-hidden="true">
                  <Database size={19} />
                </span>
                <span className="chip chip--blue">Built-in sample</span>
              </div>
              <h2 id="sample-title">No file ready? Start with the sample.</h2>
              <p>
                A deterministic two-year B2B sales dataset with realistic gaps. Use it to see how the workspace
                behaves before you import your own data.
              </p>
              <dl className="sample-card__facts">
                <div>
                  <dt>Rows</dt>
                  <dd>216</dd>
                </div>
                <div>
                  <dt>Fields</dt>
                  <dd>11</dd>
                </div>
                <div>
                  <dt>Period</dt>
                  <dd>24 months</dd>
                </div>
              </dl>
              <button type="button" className="btn btn--secondary btn--block" onClick={requestSample} disabled={importing || sampleLoading}>
                <Database size={16} />
                {importing || sampleLoading ? 'Loading sample…' : 'Load sample dataset'}
              </button>
              <p className="sample-card__note">
                Fictional data, generated inside the app. Loading it will start a session in this browser.
              </p>
            </section>

            <section className="panel limits-card" aria-labelledby="limits-title">
              <h2 id="limits-title">Import limits</h2>
              <dl>
                <div>
                  <dt>Rows per session</dt>
                  <dd className="mono">{formatCount(IMPORT_LIMITS.maxRows)}</dd>
                </div>
                <div>
                  <dt>Maximum file size</dt>
                  <dd className="mono">{formatBytes(IMPORT_LIMITS.maxFileBytes)}</dd>
                </div>
                <div>
                  <dt>Maximum fields</dt>
                  <dd className="mono">{formatCount(IMPORT_LIMITS.maxColumns)}</dd>
                </div>
              </dl>
              <p>
                Larger datasets are truncated to the first {formatCount(IMPORT_LIMITS.maxRows)} rows. The limit is
                reported in the session log and on the analysis page.
              </p>
            </section>
          </aside>
        </div>
      ) : (
        <>
          {importError && (
            <div className="setup-banner">
              <Notice tone="error" title="Import failed">
                {importError}
              </Notice>
            </div>
          )}

          <section className="panel source-bar" aria-label="Current dataset source">
            <div className="source-bar__identity">
              <span className="source-bar__icon" aria-hidden="true">
                {session.source?.kind === 'sample' ? <Database size={20} /> : <FileText size={20} />}
              </span>
              <div className="source-bar__meta">
                <div className="source-bar__title">
                  <span className="source-bar__name">{session.source?.fileName || 'Imported dataset'}</span>
                  <span className={`chip ${session.source?.kind === 'sample' ? 'chip--blue' : 'chip--green'}`}>
                    {session.source?.kind === 'sample' ? 'Sample' : session.source?.format || 'File'}
                  </span>
                  {dataset.truncated && <span className="chip chip--amber">Row limit applied</span>}
                </div>
                <p className="source-bar__detail mono">
                  {[
                    session.source?.sheetName ? `Sheet "${session.source.sheetName}"` : null,
                    session.source?.sizeBytes ? formatBytes(session.source.sizeBytes) : null,
                    `${formatCountUnit(dataset.rowCount, 'row')} × ${formatCount(dataset.columnCount)} fields`,
                    `Imported ${formatDateTime(dataset.importedAt)}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
            </div>
            <div className="source-bar__actions">
              <button type="button" className="btn btn--secondary btn--sm" onClick={openPicker} disabled={importing}>
                <Refresh size={14} />
                Replace file
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirmReset(true)} disabled={importing}>
                Start over
              </button>
            </div>
          </section>

          {dataset.warnings.length > 0 && (
            <div className="setup-banner">
              <Notice tone="warning" title="Import notes">
                <ul className="notice-list">
                  {dataset.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </Notice>
            </div>
          )}

          <dl className="dataset-stats">
            <div className="dataset-stat">
              <dt>Rows imported</dt>
              <dd>
                {formatCount(dataset.rowCount)}
                <span>{sourceRowLabel(dataset)}</span>
              </dd>
            </div>
            <div className="dataset-stat">
              <dt>Fields</dt>
              <dd>
                {formatCount(dataset.columnCount)}
                <span>
                  {dataset.typeCounts.numeric} numeric · {dataset.typeCounts.date} date ·{' '}
                  {dataset.typeCounts.category} categorical
                </span>
              </dd>
            </div>
            <div className="dataset-stat">
              <dt>Completeness</dt>
              <dd>
                {formatPercent(dataset.completeness)}
                <span>{band?.label} coverage</span>
              </dd>
            </div>
            <div className="dataset-stat">
              <dt>Blank cells</dt>
              <dd>
                {formatCount(dataset.missingCells)}
                <span>of {formatCount(dataset.cellCount)} total cells</span>
              </dd>
            </div>
          </dl>

          <div className="setup-grid">
            <div className="setup-main">
              <section className="panel setup-config" aria-labelledby="config-title">
                <div className="panel__head">
                  <div className="panel__heading">
                    <span className="eyebrow">Step 02</span>
                    <h2 className="panel__title" id="config-title">
                      Choose the analysis focus and measure
                    </h2>
                    <p className="panel__desc">
                      The focus orders the findings. The measure drives every calculation and chart.
                    </p>
                  </div>
                  <span className="chip">Required</span>
                </div>
                <div className="panel__body">
                  <fieldset className="focus-fieldset">
                    <legend className="field__label">Analysis focus</legend>
                    <div className="focus-grid">
                      {FOCUS_OPTIONS.map((option) => (
                        <label
                          key={option.id}
                          className={`focus-card${focusId === option.id ? ' is-active' : ''}`}
                        >
                          <input
                            type="radio"
                            name="analysis-focus"
                            value={option.id}
                            className="focus-card__input"
                            checked={focusId === option.id}
                            onChange={() => updateConfig({ focus: option.id })}
                          />
                          <span className="focus-card__dot" aria-hidden="true" />
                          <span className="focus-card__body">
                            <strong>{option.label}</strong>
                            <span>{option.description}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  {!numeric.length && (
                    <div className="setup-inline-alert">
                      <Notice tone="warning" title="No numeric measure detected">
                        Insightx needs at least one numeric field to calculate measures and draw charts. Check
                        that numeric columns do not contain units or text mixed into every cell, then import a
                        corrected file.
                      </Notice>
                    </div>
                  )}

                  <div className="config-fields">
                    <SelectField
                      id="measure-field"
                      label="Primary numeric measure"
                      value={measure?.key || ''}
                      onChange={(key) => {
                        const next = dataset.columns.find((column) => column.key === key) || null;
                        updateConfig({
                          measureKey: next?.key || null,
                          aggregation: defaultAggregation(next),
                        });
                      }}
                      disabled={!numeric.length}
                      hint={
                        numeric.length
                          ? 'Recommended from the field names and completeness. Change it if another measure matters more.'
                          : 'Import a dataset with a numeric column to continue.'
                      }
                    >
                      <option value="" disabled>
                        Select a numeric field
                      </option>
                      {numeric.map((column) => (
                        <option key={column.key} value={column.key}>
                          {column.name} · {unitLabel(column)}
                        </option>
                      ))}
                    </SelectField>

                    <SegmentedControl
                      label="Aggregate values as"
                      value={config.aggregation === 'avg' ? 'avg' : 'sum'}
                      onChange={(value) => updateConfig({ aggregation: value })}
                      options={[
                        { value: 'sum', label: 'Total (sum)' },
                        { value: 'avg', label: 'Average' },
                      ]}
                      hint="Totals add every populated record. Averages show the typical value per record."
                    />
                  </div>

                  <div className="config-fields config-fields--secondary">
                    <SelectField
                      id="group-field"
                      label="Compare by (optional)"
                      value={categoryKey}
                      onChange={(value) => updateConfig({ categoryKey: value || null })}
                      disabled={!groups.length}
                      hint={
                        groups.length
                          ? 'Used for the category comparison chart and share insights.'
                          : 'No low-cardinality text field was detected for grouping.'
                      }
                    >
                      <option value="">No group comparison</option>
                      {groups.map((column) => (
                        <option key={column.key} value={column.key}>
                          {column.name} · {column.distinctCount} values
                        </option>
                      ))}
                    </SelectField>

                    <SelectField
                      id="time-field"
                      label="Trend axis"
                      value={xAxisKey}
                      onChange={(value) => updateConfig({ xAxisKey: value })}
                      disabled={!timelines.length}
                      hint={
                        timelines.length
                          ? 'Date fields are grouped by day, month, or quarter based on the date range.'
                          : 'No date field was detected, so records are charted in import order.'
                      }
                    >
                      <option value="__record__">Record order · no date field</option>
                      {timelines.map((column) => (
                        <option key={column.key} value={column.key}>
                          {column.name} · date
                        </option>
                      ))}
                    </SelectField>
                  </div>
                </div>
                <div className="panel__footer">
                  <CheckCircle size={13} /> These choices can be changed again here or on the analysis page.
                </div>
              </section>

              <section className="panel" aria-labelledby="preview-title">
                <div className="panel__head">
                  <div className="panel__heading">
                    <h2 className="panel__title" id="preview-title">
                      Readable data preview
                    </h2>
                    <p className="panel__desc">
                      First {Math.min(MAX_PREVIEW_ROWS, dataset.rowCount)} of {formatCount(dataset.rowCount)} imported
                      rows. Blank cells are marked explicitly.
                    </p>
                  </div>
                  <div className="panel__actions">
                    <span className="chip">
                      <Table size={11} /> {formatCount(dataset.columnCount)} fields
                    </span>
                  </div>
                </div>
                <div className="panel__body panel__body--tight">
                  <div className="table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th scope="col" className="data-table__index">
                            #
                          </th>
                          {dataset.columns.map((column) => (
                            <th scope="col" key={column.key} title={column.sourceName}>
                              <span className="data-table__field">{column.name}</span>
                              <span className={`type-badge type-badge--${column.kind}`}>{column.kind}</span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row, rowIndex) => (
                          <tr key={rowIndex}>
                            <td className="data-table__index mono">{rowIndex + 1}</td>
                            {dataset.columns.map((column) => {
                              const text = previewText(row[column.index]);
                              return (
                                <td key={column.key} title={text || undefined}>
                                  {text === null ? <span className="table-blank">blank</span> : text}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="panel__footer">
                  Preview only · the analysis uses all {formatCount(dataset.rowCount)} imported rows.
                </div>
              </section>

              <section className="panel" aria-labelledby="schema-title">
                <div className="panel__head">
                  <div className="panel__heading">
                    <h2 className="panel__title" id="schema-title">
                      Detected fields
                    </h2>
                    <p className="panel__desc">
                      Inferred type, populated values, distinct values, and raw samples for each field.
                    </p>
                  </div>
                  <div className="panel__actions schema-chips">
                    <span className="type-badge type-badge--numeric">{dataset.typeCounts.numeric} numeric</span>
                    <span className="type-badge type-badge--date">{dataset.typeCounts.date} date</span>
                    <span className="type-badge type-badge--category">{dataset.typeCounts.category} category</span>
                  </div>
                </div>
                <div className="panel__body panel__body--tight">
                  <div className="table-scroll">
                    <table className="data-table schema-table">
                      <thead>
                        <tr>
                          <th scope="col">Field</th>
                          <th scope="col">Type</th>
                          <th scope="col">Populated</th>
                          <th scope="col">Distinct</th>
                          <th scope="col">Sample values</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dataset.columns.map((column) => (
                          <tr key={column.key}>
                            <td>
                              <span className="schema-field">{column.name}</span>
                              {column.unit?.type !== 'number' && column.kind === 'numeric' && (
                                <span className="schema-field__unit">{unitLabel(column)}</span>
                              )}
                            </td>
                            <td>
                              <span className={`type-badge type-badge--${column.kind}`}>{column.kind}</span>
                            </td>
                            <td className="mono">
                              {formatPercent(column.completeness)}
                              <span className="schema-sub">{formatCountUnit(column.nonEmpty, 'row')}</span>
                            </td>
                            <td className="mono">
                              {column.distinctCapped ? '60+' : formatCount(column.distinctCount)}
                            </td>
                            <td className="schema-sample" title={column.sampleValues.map((value) => previewText(value) ?? 'blank').join(' · ')}>
                              {column.sampleValues.length
                                ? column.sampleValues
                                    .slice(0, 3)
                                    .map((value) => previewText(value) ?? 'blank')
                                    .join(' · ')
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            </div>

            <aside className="setup-side">
              <section className="panel console-panel" aria-labelledby="console-title">
                <div className="console-panel__bar">
                  <span className="window-dots" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                  <h2 id="console-title">Session log</h2>
                  <span className={`console-panel__state${importing ? ' is-busy' : ''}`}>
                    {importing ? (
                      <>
                        <span className="spinner spinner--light" /> Parsing
                      </>
                    ) : (
                      'Idle'
                    )}
                  </span>
                </div>
                <div
                  className="console"
                  role="log"
                  aria-live="polite"
                  aria-label="Dataset processing activity"
                  ref={logRef}
                >
                  {importing && (
                    <p className="console-line console-line--pending">
                      <span className="console-line__tag">···</span>
                      <span className="console-line__text">Reading file, detecting structure, profiling cells…</span>
                    </p>
                  )}
                  {activity.map((entry, index) => (
                    <p className={`console-line console-line--${entry.level || 'info'}`} key={`${entry.at}-${index}`}>
                      <span className="console-line__time">{logTime(entry.at)}</span>
                      <span className="console-line__tag">{LEVEL_TAG[entry.level] || 'INFO'}</span>
                      <span className="console-line__text">{entry.text}</span>
                    </p>
                  ))}
                  {!activity.length && !importing && (
                    <p className="console-empty">
                      Waiting for a dataset. Parsing and profiling events will appear here as they happen.
                    </p>
                  )}
                </div>
                <div className="console-panel__foot">
                  <Shield size={12} /> Processing stays on this device
                </div>
              </section>

              <section className="panel reference-panel" aria-labelledby="reference-title">
                <div className="panel__head">
                  <div className="panel__heading">
                    <h2 className="panel__title" id="reference-title">
                      Source reference
                    </h2>
                    <p className="panel__desc">Keep the origin of this dataset with the session.</p>
                  </div>
                </div>
                <div className="panel__body">
                  {session.sourceReference ? (
                    <div className="reference-saved">
                      <span className="reference-saved__icon" aria-hidden="true">
                        <ExternalLink size={15} />
                      </span>
                      <div className="reference-saved__body">
                        <a
                          className="reference-saved__url mono"
                          href={session.sourceReference.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {session.sourceReference.url}
                        </a>
                        <span className="reference-saved__meta">
                          Reference only · added {formatDateTime(session.sourceReference.addedAt)}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="icon-button reference-saved__remove"
                        onClick={removeReference}
                        aria-label="Remove source reference"
                      >
                        <Close size={14} />
                      </button>
                    </div>
                  ) : (
                    <form className="reference-form" onSubmit={handleReference}>
                      <label className="field__label" htmlFor="reference-url">
                        Dataset URL (optional)
                      </label>
                      <input
                        id="reference-url"
                        type="url"
                        className="text-input"
                        placeholder="https://www.kaggle.com/datasets/…"
                        value={referenceDraft}
                        onChange={(event) => {
                          setReferenceDraft(event.target.value);
                          if (referenceError) setReferenceError('');
                        }}
                        aria-invalid={Boolean(referenceError)}
                        aria-describedby="reference-help"
                      />
                      {referenceError && (
                        <p className="field__error" role="alert">
                          {referenceError}
                        </p>
                      )}
                      <p className="field__hint" id="reference-help">
                        Stored as a label for your report. Insightx will not download, scrape, or bypass access
                        controls on the linked page — import the file separately.
                      </p>
                      <button type="submit" className="btn btn--secondary btn--sm">
                        <ExternalLink size={13} />
                        Add reference
                      </button>
                    </form>
                  )}
                </div>
              </section>

              <div className="setup-local-note">
                <Shield size={16} />
                <div>
                  <strong>Local browser session</strong>
                  <p>
                    The parsed dataset and report are saved to this browser&apos;s local storage so a reload keeps
                    your place. Clearing this site&apos;s data removes the session. There is no cloud storage or
                    account database in this build.
                  </p>
                  <span className="mono setup-local-note__limit">
                    {formatCount(IMPORT_LIMITS.maxRows)} rows · {formatBytes(IMPORT_LIMITS.maxFileBytes)} ·{' '}
                    {IMPORT_LIMITS.maxColumns} fields
                  </span>
                </div>
              </div>
            </aside>
          </div>

          <section className={`setup-actionbar panel${canPrepare ? ' is-ready' : ''}`} aria-labelledby="prepare-title">
            <div className="setup-actionbar__copy">
              <span className="eyebrow">Stage 02 → 03</span>
              <h2 id="prepare-title">
                {canPrepare
                  ? `Ready to analyze ${formatCountUnit(dataset.rowCount, 'row')} using ${measure.name.toLowerCase()}`
                  : 'Choose a numeric measure to continue'}
              </h2>
              <p>
                {canPrepare
                  ? `${getFocus(focusId).label} focus · ${
                      config.aggregation === 'avg' ? 'average per record' : 'summed across records'
                    } · trend by ${xAxisKey === '__record__' ? 'record order' : timelines.find((column) => column.key === xAxisKey)?.name || 'date'}`
                  : 'The analysis needs one numeric field to calculate measures and draw charts.'}
              </p>
            </div>
            <div className="setup-actionbar__actions">
              <button type="button" className="btn btn--primary btn--lg" onClick={handlePrepare} disabled={!canPrepare || importing}>
                Run analysis
                <ArrowRight size={17} />
              </button>
              <span className="setup-actionbar__hint">Uses all imported rows · next stage is editable</span>
            </div>
          </section>
        </>
      )}

      <ConfirmDialog
        open={confirmReplace}
        title="Replace the current dataset?"
        description={
          pending?.kind === 'file'
            ? `Importing "${pending.file?.name || 'this file'}" will replace the dataset currently stored in this browser. Your current preparation and any saved report will be cleared.`
            : 'Loading the built-in sample will replace the dataset currently stored in this browser. Your current preparation and any saved report will be cleared.'
        }
        confirmLabel={pending?.kind === 'file' ? 'Replace dataset' : 'Load sample dataset'}
        cancelLabel="Keep current session"
        onConfirm={confirmPending}
        onCancel={() => {
          setConfirmReplace(false);
          setPending(null);
          resetPicker();
        }}
      />

      <ConfirmDialog
        open={confirmReset}
        title="Start over with an empty session?"
        description="This removes the imported dataset, its configuration, activity log, and any saved report from this browser. The action cannot be undone."
        confirmLabel="Remove session"
        cancelLabel="Keep session"
        tone="danger"
        onConfirm={handleReset}
        onCancel={() => setConfirmReset(false)}
      />
    </>
  );
}
