import { useState } from 'react';
import { useElementSize } from './useElementSize.js';
import { CHART_COLORS, CHART_FONT, MONO_FONT } from './chartTokens.js';
import { formatCountUnit, formatMeasure } from '../../lib/format.js';

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function truncateLabel(label, maxChars) {
  const text = String(label ?? '');
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
}

export function BarChart({ items, unit, ariaLabel, height: heightProp }) {
  const [wrapRef, width] = useElementSize();
  const [hovered, setHovered] = useState(null);

  const safeItems = Array.isArray(items) ? items : [];
  const compact = width > 0 && width < 520;
  const rowHeight = 42;
  const top = 8;
  const bottom = 8;
  const height = heightProp || Math.max(80, safeItems.length * rowHeight + top + bottom);
  const labelWidth = clamp(Math.round(width * 0.3), 94, 176);
  const valueWidth = compact ? 52 : 64;
  const plotWidth = Math.max(20, width - labelWidth - valueWidth);
  const plotX = labelWidth;

  const values = safeItems.map((item) => item.value);
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(0, ...values);
  const range = maxValue - minValue || 1;
  const zeroX = plotX + ((0 - minValue) / range) * plotWidth;
  const maxChars = Math.max(8, Math.floor((labelWidth - 14) / (compact ? 6 : 6.6)));

  const summary =
    ariaLabel ||
    (safeItems.length
      ? `Bar chart comparing ${safeItems.length} categories. Highest: ${safeItems[0].label} at ${formatMeasure(
          safeItems[0].value,
          unit,
        )}.`
      : 'Bar chart with no data.');

  return (
    <div className="chart chart--bar" ref={wrapRef}>
      {width > 0 && safeItems.length > 0 && (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={summary}>
          {minValue < 0 && (
            <line
              x1={zeroX}
              x2={zeroX}
              y1={top}
              y2={height - bottom}
              stroke={CHART_COLORS.gridStrong}
              strokeWidth="1"
            />
          )}
          {safeItems.map((item, index) => {
            const centerY = top + index * rowHeight + rowHeight / 2;
            const barHeight = 16;
            const valueX = item.value >= 0 ? zeroX : zeroX - (Math.abs(item.value) / range) * plotWidth;
            const barWidth = Math.max(item.value === 0 ? 0 : 3, (Math.abs(item.value) / range) * plotWidth);
            const isHovered = hovered === index;
            const color = item.isOther
              ? CHART_COLORS.blueMuted
              : index === 0
                ? CHART_COLORS.blueDeep
                : CHART_COLORS.blueSoft;
            const fill = item.value >= 0 ? color : '#C97A6D';

            return (
              <g
                key={`${item.label}-${index}`}
                onMouseEnter={() => setHovered(index)}
                onMouseLeave={() => setHovered(null)}
              >
                <title>
                  {`${item.label}: ${formatMeasure(item.value, unit)} · ${formatCountUnit(item.count, 'record')}`}
                </title>
                {isHovered && (
                  <rect
                    data-export-ignore
                    x="1"
                    y={centerY - rowHeight / 2 + 2}
                    width={width - 2}
                    height={rowHeight - 4}
                    rx="7"
                    fill="#F7FAFF"
                  />
                )}
                <text
                  x="2"
                  y={centerY - 2}
                  fontFamily={CHART_FONT}
                  fontSize={compact ? 11.5 : 12.5}
                  fontWeight="500"
                  fill={CHART_COLORS.ink}
                >
                  {truncateLabel(item.label, maxChars)}
                </text>
                <text
                  x="2"
                  y={centerY + 13}
                  fontFamily={MONO_FONT}
                  fontSize="9.5"
                  fill={CHART_COLORS.axisSoft}
                >
                  {formatCountUnit(item.count, 'record')}
                  {item.share !== null && item.share !== undefined ? ` · ${item.share}%` : ''}
                </text>
                <rect
                  x={plotX}
                  y={centerY - barHeight / 2}
                  width={plotWidth}
                  height={barHeight}
                  rx="5"
                  fill={CHART_COLORS.track}
                />
                {barWidth > 0 && (
                  <rect
                    x={item.value >= 0 ? zeroX : valueX}
                    y={centerY - barHeight / 2}
                    width={Math.min(barWidth, plotWidth)}
                    height={barHeight}
                    rx="5"
                    fill={fill}
                    opacity={item.isOther ? 0.75 : 1}
                  />
                )}
                <text
                  x={width - 2}
                  y={centerY + 4}
                  textAnchor="end"
                  fontFamily={MONO_FONT}
                  fontSize={compact ? 10 : 11}
                  fontWeight="500"
                  fill={CHART_COLORS.ink}
                >
                  {formatMeasure(item.value, unit)}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
