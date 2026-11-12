import { CHART_COLORS, CHART_FONT, HEADING_FONT, toneColor } from './chartTokens.js';
import { formatPercent } from '../../lib/format.js';

export function Gauge({ value, tone = 'ok', label = 'Complete', capabilityLabel, height = 196 }) {
  const safeValue = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
  const radius = 61;
  const circumference = 2 * Math.PI * radius;
  const color = toneColor(tone);
  const centerX = 110;
  const centerY = 92;

  return (
    <div className="chart chart--gauge" style={{ maxWidth: 236 }}>
      <svg
        viewBox="0 0 220 176"
        width="100%"
        height={height}
        role="img"
        aria-label={`Data completeness: ${formatPercent(safeValue)}. ${capabilityLabel || ''}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <circle
          cx={centerX}
          cy={centerY}
          r={radius}
          fill="none"
          stroke={CHART_COLORS.track}
          strokeWidth="13"
        />
        <circle
          cx={centerX}
          cy={centerY}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="13"
          strokeLinecap="round"
          strokeDasharray={`${(safeValue / 100) * circumference} ${circumference}`}
          transform={`rotate(-90 ${centerX} ${centerY})`}
        />
        <circle
          cx={centerX}
          cy={centerY - radius}
          r="3"
          fill={CHART_COLORS.surface}
          stroke={color}
          strokeWidth="2"
        />
        <text
          x={centerX}
          y={centerY + 8}
          textAnchor="middle"
          fontFamily={HEADING_FONT}
          fontSize="30"
          fontWeight="700"
          letterSpacing="-0.03em"
          fill={CHART_COLORS.ink}
        >
          {formatPercent(safeValue)}
        </text>
        <text
          x={centerX}
          y={centerY + 28}
          textAnchor="middle"
          fontFamily={CHART_FONT}
          fontSize="11"
          fill={CHART_COLORS.axis}
        >
          {label}
        </text>
        <line
          x1="76"
          x2="144"
          y1="137"
          y2="137"
          stroke={CHART_COLORS.grid}
          strokeWidth="1"
        />
        <text
          x={centerX}
          y="156"
          textAnchor="middle"
          fontFamily={CHART_FONT}
          fontSize="10.5"
          fontWeight="600"
          letterSpacing="0.05em"
          fill={color}
        >
          {(capabilityLabel || '').toUpperCase()}
        </text>
      </svg>
    </div>
  );
}
