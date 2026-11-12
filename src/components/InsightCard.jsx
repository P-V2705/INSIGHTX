import { ChartBar, Shield, Sparkle, TrendUp } from './Icons.jsx';

const TONE_ICON = {
  trend: TrendUp,
  category: ChartBar,
  quality: Shield,
  distribution: Sparkle,
};

export function InsightCard({ insight }) {
  const Icon = TONE_ICON[insight.tone] || Sparkle;
  return (
    <article className="insight-card">
      <div className="insight-card__top">
        <span className="insight-card__icon" aria-hidden="true">
          <Icon size={16} />
        </span>
        <span className="insight-card__tag">{insight.tag}</span>
      </div>
      <h3>{insight.title}</h3>
      <p>{insight.body}</p>
    </article>
  );
}
