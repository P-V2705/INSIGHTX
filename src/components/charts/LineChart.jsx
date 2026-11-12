import { useId, useMemo, useState } from 'react';
import { useElementSize } from './useElementSize.js';
import { CHART_COLORS, CHART_FONT, MONO_FONT, chooseTickIndices, niceTicks } from './chartTokens.js';
import { formatCompact, formatCount, formatMeasure } from '../../lib/format.js';

export function LineChart({
  points,
  unit,
  height = 264,
  ariaLabel,
  valueCaption = 'Value',
}) {
  const [wrapRef, width] = useElementSize();
  const [activeIndex, setActiveIndex] = useState(null);
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const gradientId = `insightx-area-${rawId}`;

  const safePoints = useMemo(
    () => (Array.isArray(points) ? points.filter((point) => Number.isFinite(point.value)) : []),
    [points],
  );

  const compact = width > 0 && width < 500;
  const margin = { top: 16, right: compact ? 10 : 18, bottom: 34, left: compact ? 44 : 58 };
  const plotWidth = Math.max(10, width - margin.left - margin.right);
  const plotHeight = Math.max(40, height - margin.top - margin.bottom);

  const scale = useMemo(() => {
    if (!safePoints.length) return null;
    const values = safePoints.map((point) => point.value);
    const scaleInfo = niceTicks(Math.min(...values), Math.max(...values), compact ? 3 : 4);
    return scaleInfo;
  }, [safePoints, compact]);

  const xPositions = useMemo(() => {
    if (!safePoints.length) return [];
    if (safePoints.every((point) => Number.isFinite(point.xTime))) {
      const min = safePoints[0].xTime;
      const max = safePoints[safePoints.length - 1].xTime;
      if (max > min) {
        return safePoints.map((point) => ((point.xTime - min) / (max - min)) * plotWidth);
      }
    }
    return safePoints.map((_, index) =>
      safePoints.length === 1 ? plotWidth / 2 : (index / (safePoints.length - 1)) * plotWidth,
    );
  }, [safePoints, plotWidth]);

  const yFor = (value) => {
    if (!scale) return margin.top + plotHeight;
    if (scale.max === scale.min) return margin.top + plotHeight / 2;
    return margin.top + plotHeight - ((value - scale.min) / (scale.max - scale.min)) * plotHeight;
  };

  const linePath = safePoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${(margin.left + xPositions[index]).toFixed(2)} ${yFor(point.value).toFixed(2)}`)
    .join(' ');

  const bottom = margin.top + plotHeight;
  const areaPath = safePoints.length
    ? `${linePath} L${(margin.left + xPositions[xPositions.length - 1]).toFixed(2)} ${bottom} L${(margin.left + xPositions[0]).toFixed(2)} ${bottom} Z`
    : '';

  const tickIndices = chooseTickIndices(safePoints.length, compact ? 4 : 6);
  const describedBy = activeIndex !== null ? safePoints[activeIndex] : null;

  const summary =
    ariaLabel ||
    (safePoints.length
      ? `Line chart with ${safePoints.length} points from ${safePoints[0].fullLabel || safePoints[0].label} to ${
          safePoints[safePoints.length - 1].fullLabel || safePoints[safePoints.length - 1].label
        }. Values range from ${formatMeasure(Math.min(...safePoints.map((point) => point.value)), unit)} to ${formatMeasure(
          Math.max(...safePoints.map((point) => point.value)),
          unit,
        )}.`
      : 'Line chart with no data.');

  const handleMove = (event) => {
    if (!safePoints.length) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const position = Math.min(Math.max(event.clientX - rect.left, 0), plotWidth);
    let nearest = 0;
    let bestDistance = Infinity;
    xPositions.forEach((x, index) => {
      const distance = Math.abs(x - position);
      if (distance < bestDistance) {
        bestDistance = distance;
        nearest = index;
      }
    });
    setActiveIndex(nearest);
  };

  return (
    <div className="chart chart--line" ref={wrapRef} style={{ height }}>
      {width > 0 && safePoints.length > 0 && scale && (
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={summary}
          style={{ display: 'block', overflow: 'visible' }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.blue} stopOpacity="0.18" />
              <stop offset="100%" stopColor={CHART_COLORS.blue} stopOpacity="0" />
            </linearGradient>
          </defs>

          {scale.ticks.map((tick) => {
            const y = yFor(tick);
            return (
              <g key={tick}>
                <line
                  x1={margin.left}
                  x2={width - margin.right}
                  y1={y}
                  y2={y}
                  stroke={tick === 0 ? CHART_COLORS.gridStrong : CHART_COLORS.grid}
                  strokeWidth="1"
                />
                <text
                  x={margin.left - 9}
                  y={y + 3.5}
                  textAnchor="end"
                  fontFamily={MONO_FONT}
                  fontSize={compact ? 9 : 10}
                  fill={CHART_COLORS.axisSoft}
                >
                  {formatCompact(tick, unit)}
                </text>
              </g>
            );
          })}

          {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}
          <path
            d={linePath}
            fill="none"
            stroke={CHART_COLORS.blue}
            strokeWidth="2.25"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {tickIndices.map((index) => (
            <text
              key={`x-${index}`}
              x={margin.left + xPositions[index]}
              y={height - 10}
              textAnchor={
                index === 0 ? 'start' : index === safePoints.length - 1 ? 'end' : 'middle'
              }
              fontFamily={CHART_FONT}
              fontSize={compact ? 9.5 : 10.5}
              fill={CHART_COLORS.axis}
            >
              {safePoints[index].label}
            </text>
          ))}

          <circle
            cx={margin.left + xPositions[xPositions.length - 1]}
            cy={yFor(safePoints[safePoints.length - 1].value)}
            r="3.6"
            fill="#FFFFFF"
            stroke={CHART_COLORS.blue}
            strokeWidth="2"
          />

          {activeIndex !== null && (
            <g data-export-ignore>
              <line
                x1={margin.left + xPositions[activeIndex]}
                x2={margin.left + xPositions[activeIndex]}
                y1={margin.top}
                y2={bottom}
                stroke={CHART_COLORS.blueDeep}
                strokeWidth="1"
                strokeDasharray="3 4"
                opacity="0.45"
              />
              <circle
                cx={margin.left + xPositions[activeIndex]}
                cy={yFor(safePoints[activeIndex].value)}
                r="4.8"
                fill="#FFFFFF"
                stroke={CHART_COLORS.blueDeep}
                strokeWidth="2.4"
              />
            </g>
          )}

          <rect
            x={margin.left}
            y={margin.top}
            width={plotWidth}
            height={plotHeight}
            fill="transparent"
            onMouseMove={handleMove}
            onMouseLeave={() => setActiveIndex(null)}
            style={{ cursor: 'crosshair' }}
          />
        </svg>
      )}

      {describedBy && (
        <div
          className="chart-tooltip"
          data-export-ignore
          style={{
            left: Math.min(
              Math.max(8, margin.left + xPositions[activeIndex] - 82),
              Math.max(8, width - 188),
            ),
            top: 4,
          }}
        >
          <span className="chart-tooltip__label">{describedBy.fullLabel || describedBy.label}</span>
          <span className="chart-tooltip__value">
            {formatMeasure(describedBy.value, unit)}
            <span className="chart-tooltip__unit">{valueCaption}</span>
          </span>
          <span className="chart-tooltip__meta">
            {formatCount(describedBy.count)} {describedBy.count === 1 ? 'record' : 'records'} in this point
          </span>
        </div>
      )}
    </div>
  );
}
