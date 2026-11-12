import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MarketingHeader } from '../components/MarketingHeader.jsx';
import { SiteFooter } from '../components/SiteFooter.jsx';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import { Notice } from '../components/Notice.jsx';
import { LineChart } from '../components/charts/LineChart.jsx';
import {
  ArrowRight,
  ChartBar,
  Check,
  Compass,
  Database,
  FileText,
  Shield,
  Sparkle,
  Upload,
} from '../components/Icons.jsx';
import { useSession } from '../session/SessionProvider.jsx';
import { useAuth } from '../auth/AuthProvider.jsx';
import { buildSampleDataset } from '../lib/sample.js';
import { buildDefaultConfig } from '../lib/profile.js';
import { analyzeDataset } from '../lib/analysis.js';
import { formatCount, formatPercent } from '../lib/format.js';

const STAGES = [
  {
    number: '01',
    title: 'About',
    description:
      'Understand the workspace first: what Insightx computes, how the four stages connect, and what the product will not claim.',
    detail: 'You are here',
    icon: Compass,
    current: true,
  },
  {
    number: '02',
    title: 'Session setup',
    description:
      'Import a CSV, TSV, XLSX, XLS, or JSON file. Inspect detected fields, blank cells, and records before choosing a focus and measure.',
    detail: 'Local parsing · 5,000-row limit',
    icon: Upload,
  },
  {
    number: '03',
    title: 'Analysis',
    description:
      'Read summary measures, a trend line, category comparisons, completeness, and plain-language findings grounded in the imported rows.',
    detail: 'Calculated in the browser',
    icon: ChartBar,
  },
  {
    number: '04',
    title: 'Final report',
    description:
      'Save the session summary, preview its charts, and download a CSV summary or a ZIP of editable SVG charts with a method read-me.',
    detail: 'CSV + SVG exports',
    icon: FileText,
  },
];

function AboutPreview() {
  const analysis = useMemo(() => {
    const { dataset } = buildSampleDataset();
    const config = buildDefaultConfig(dataset.columns, dataset.rowCount);
    return analyzeDataset(dataset, config);
  }, []);

  if (!analysis.available) return null;
  const total = analysis.metrics.find((metric) => metric.id === 'total');
  const change = analysis.metrics.find((metric) => metric.id === 'change');
  const leader = analysis.categories?.items?.[0];
  const insight = analysis.insights.find((item) => item.tone === 'trend') || analysis.insights[0];

  return (
    <figure className="analysis-preview">
      <div className="analysis-preview__chrome" aria-hidden="true">
        <span className="window-dots">
          <i />
          <i />
          <i />
        </span>
        <span className="analysis-preview__chrome-title">Analysis workspace</span>
        <span className="chip chip--blue">Sample</span>
      </div>
      <div className="analysis-preview__body">
        <div className="analysis-preview__headline">
          <div>
            <span className="preview-kicker">Analysis preview</span>
            <h2>{analysis.measure.name} performance</h2>
            <p>
              {analysis.trend.points.length} {analysis.trend.axisLabel.toLowerCase()} points · grouped by{' '}
              {analysis.xAxis.name}
            </p>
          </div>
          {total && (
            <div className="preview-total">
              <span>{total.label}</span>
              <strong>{total.valueLabel}</strong>
            </div>
          )}
        </div>

        <div className="analysis-preview__chart">
          <LineChart
            points={analysis.trend.points}
            unit={analysis.measure.unit}
            height={176}
            ariaLabel={`Preview line chart of ${analysis.measure.name} across ${analysis.trend.points.length} points from the built-in sample dataset.`}
          />
        </div>

        <div className="analysis-preview__summary">
          <div className="preview-stat">
            <span className="preview-label">Top {analysis.category?.name.toLowerCase() || 'group'}</span>
            <strong>{leader?.label || '—'}</strong>
            {leader?.share !== null && leader?.share !== undefined && (
              <>
                <span className="preview-track">
                  <span style={{ width: `${Math.min(100, leader.share)}%` }} />
                </span>
                <small>{formatPercent(leader.share)} of total</small>
              </>
            )}
          </div>
          <div className="preview-stat">
            <span className="preview-label">Completeness</span>
            <strong>{formatPercent(analysis.completeness.pct)}</strong>
            <span className="preview-track">
              <span style={{ width: `${analysis.completeness.pct}%` }} />
            </span>
            <small>{analysis.completeness.band} coverage</small>
          </div>
          <div className="preview-stat">
            <span className="preview-label">Change</span>
            <strong className={change?.tone === 'down' ? 'is-down' : change?.tone === 'up' ? 'is-up' : undefined}>
              {change?.valueLabel || '—'}
            </strong>
            <small>{formatCount(analysis.trend.points.length)} charted periods</small>
          </div>
        </div>

        {insight && (
          <div className="preview-insight">
            <span className="preview-insight__icon" aria-hidden="true">
              <Sparkle size={14} />
            </span>
            <p>{insight.title}</p>
          </div>
        )}
      </div>
      <figcaption className="analysis-preview__caption">
        Illustrative preview computed from the built-in sample dataset — not customer data.
      </figcaption>
    </figure>
  );
}

export default function AboutPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { session, loadSample, markPrepared, sampleLoading } = useSession();
  const [confirmSample, setConfirmSample] = useState(false);
  const [sampleError, setSampleError] = useState('');
  const workspacePath = user ? '/setup' : `/login?next=${encodeURIComponent('/setup')}`;

  const loadAndOpenSample = async () => {
    setSampleError('');
    try {
      await loadSample();
      markPrepared();
      navigate('/analysis');
    } catch {
      setSampleError('The sample dataset could not be loaded. Refresh the page and try again.');
    }
  };

  const handleSample = () => {
    if (!user) {
      navigate(`/login?next=${encodeURIComponent('/setup')}`);
      return;
    }
    if (session.dataset && session.source?.kind !== 'sample') {
      setConfirmSample(true);
      return;
    }
    if (session.dataset && session.source?.kind === 'sample') {
      markPrepared();
      navigate('/analysis');
      return;
    }
    loadAndOpenSample();
  };

  return (
    <div className="about-page">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <div className="about-dark">
        <MarketingHeader />
        <main id="main-content">
          <section className="hero">
            <div className="hero__grid" aria-hidden="true" />
            <div className="hero__glow" aria-hidden="true" />
            <div className="container hero__inner">
              <div className="hero__copy">
                <span className="eyebrow hero__eyebrow">
                  <span className="hero__eyebrow-dot" aria-hidden="true" />
                  Business analysis, without the noise
                </span>
                <h1>Turn the numbers you already have into decisions you can explain.</h1>
                <p className="hero__lead">
                  Insightx reads a business dataset, surfaces the measures that matter, and turns them into
                  clear charts, findings, and a report you can hand over — without sending your file anywhere.
                </p>
                <div className="hero__actions">
                  <Link to={workspacePath} className="btn btn--light btn--lg">
                    Start a dataset session
                    <ArrowRight size={17} />
                  </Link>
                  <button
                    type="button"
                    className="btn btn--ghost-light btn--lg"
                    onClick={handleSample}
                    disabled={sampleLoading}
                  >
                    <Database size={17} />
                    {sampleLoading ? 'Loading sample…' : 'Explore sample dataset'}
                  </button>
                </div>
                {sampleError && (
                  <div className="hero__error">
                    <Notice tone="error">{sampleError}</Notice>
                  </div>
                )}
                <p className="hero__hint">
                  No file ready? Sign in to open the built-in 24-month B2B sales sample straight in the
                  analysis view.
                </p>
                <ul className="hero__facts">
                  <li>
                    <Check size={13} /> Local file parsing
                  </li>
                  <li>
                    <Check size={13} /> Real computed measures
                  </li>
                  <li>
                    <Check size={13} /> Editable chart exports
                  </li>
                </ul>
              </div>
              <div className="hero__preview">
                <AboutPreview />
              </div>
            </div>
          </section>
        </main>
      </div>

      <section className="trust-strip" aria-label="Product facts">
        <div className="container trust-strip__inner">
          <div className="trust-strip__item">
            <span className="trust-strip__value">5,000</span>
            <span>row import limit, stated up front</span>
          </div>
          <div className="trust-strip__item">
            <span className="trust-strip__value">5</span>
            <span>file formats: CSV, TSV, XLSX, XLS, JSON</span>
          </div>
          <div className="trust-strip__item">
            <span className="trust-strip__value">0</span>
            <span>dataset files sent to a server</span>
          </div>
          <div className="trust-strip__note">
            <Shield size={15} />
            Sign-in required · data stays in this browser
          </div>
        </div>
      </section>

      <section className="section workflow-section" id="workflow">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="eyebrow">How the workspace fits together</span>
              <h2>Four stages, one traceable line of reasoning.</h2>
            </div>
            <p>
              Each stage has one job. Together they take a raw file to a saved, downloadable report — with the
              evidence visible at every step.
            </p>
          </div>
          <ol className="stage-grid">
            {STAGES.map((stage) => {
              const Icon = stage.icon;
              return (
                <li className={`stage-card${stage.current ? ' is-current' : ''}`} key={stage.number}>
                  <div className="stage-card__top">
                    <span className="stage-card__number">{stage.number}</span>
                    <span className="stage-card__icon" aria-hidden="true">
                      <Icon size={17} />
                    </span>
                  </div>
                  <h3>{stage.title}</h3>
                  <p>{stage.description}</p>
                  <span className="stage-card__detail">
                    {stage.current && <span className="stage-card__current-dot" aria-hidden="true" />}
                    {stage.detail}
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="workflow-note">
            <span className="workflow-note__rule" aria-hidden="true" />
            <p>
              <strong>Honest by construction.</strong> Metrics, charts, and findings come from the rows you
              imported. When a field or value is missing, the interface says so instead of filling the gap.
            </p>
            <Link to={workspacePath} className="link-arrow">
              Start with a dataset <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      <section className="section audience-section" id="privacy">
        <div className="container audience-grid">
          <div className="audience-copy">
            <span className="eyebrow">Built for the people who own the numbers</span>
            <h2>Less dashboard theatre. More answers you can use.</h2>
            <p className="audience-lede">
              Insightx is for operators and analysts who have a file, a question, and not enough time to
              reshape a spreadsheet for the fifth time.
            </p>
            <ul className="audience-list">
              <li>
                <span>01</span>
                <div>
                  <h3>Owners & operators</h3>
                  <p>Check how revenue, volume, or satisfaction moved without waiting on a reporting cycle.</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <h3>Analysts</h3>
                  <p>Profile a messy export quickly, compare segments, and package a clean summary for review.</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <h3>Consultants & teams</h3>
                  <p>Turn a client file into a defensible readout with visible calculations and exportable charts.</p>
                </div>
              </li>
            </ul>
          </div>

          <aside className="privacy-panel">
            <div className="privacy-panel__icon" aria-hidden="true">
              <Shield size={20} />
            </div>
            <span className="eyebrow privacy-panel__eyebrow">Privacy, plainly</span>
            <h2>Your data stays in this browser.</h2>
            <p className="privacy-panel__lead">
              Imported files are parsed and analyzed inside the current browser. They are never uploaded to the
              sign-in service or any analysis server.
            </p>
            <ul className="privacy-list">
              <li>
                <Check size={14} />
                <span>Sessions are saved to this browser&apos;s local storage so you can return after a reload.</span>
              </li>
              <li>
                <Check size={14} />
                <span>Sign-in only exchanges your provider identity; datasets are not part of the OAuth flow.</span>
              </li>
              <li>
                <Check size={14} />
                <span>Signing out clears the server session. The saved dataset stays on this device until you reset it.</span>
              </li>
            </ul>
            <div className="privacy-panel__foot">
              <span className="privacy-panel__badge">OAuth sign-in</span>
              <Link to={user ? '/setup' : '/login'} className="privacy-panel__link">
                {user ? 'Open the workspace' : 'Sign in to the workspace'} <ArrowRight size={13} />
              </Link>
            </div>
          </aside>
        </div>
      </section>

      <section className="section closing-section">
        <div className="container">
          <div className="closing-panel">
            <div className="closing-panel__pattern" aria-hidden="true" />
            <div className="closing-panel__copy">
              <span className="eyebrow">Ready when your file is</span>
              <h2>Start with a dataset. Leave with a report.</h2>
              <p>
                Bring a CSV, spreadsheet, or JSON export. Insightx will show you what it contains before it
                draws a single conclusion.
              </p>
            </div>
            <div className="closing-panel__actions">
              <Link to={workspacePath} className="btn btn--light">
                Start a session
                <ArrowRight size={16} />
              </Link>
              <button type="button" className="btn btn--ghost-light" onClick={handleSample} disabled={sampleLoading}>
                Explore the sample
              </button>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />

      <ConfirmDialog
        open={confirmSample}
        title="Replace the current session?"
        description="Exploring the sample dataset will replace the dataset currently stored in this browser. Your existing session is local to this device and cannot be recovered after it is replaced."
        confirmLabel="Load sample dataset"
        cancelLabel="Keep current session"
        onConfirm={() => {
          setConfirmSample(false);
          loadAndOpenSample();
        }}
        onCancel={() => setConfirmSample(false)}
      />
    </div>
  );
}
