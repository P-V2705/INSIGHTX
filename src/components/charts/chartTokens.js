export const CHART_COLORS = {
  blue: '#2F6BE4',
  blueDeep: '#1E54C4',
  blueSoft: '#4F86E8',
  blueMuted: '#A9BEDC',
  grid: '#E7EDF6',
  gridStrong: '#DCE5F1',
  axis: '#6A7B91',
  axisSoft: '#8B97A8',
  ink: '#0C1A2C',
  surface: '#FFFFFF',
  track: '#F1F5FB',
  good: '#2E7D5B',
  ok: '#2F6BE4',
  warn: '#B77808',
  bad: '#B5473B',
};

export const CHART_FONT = '"Source Sans 3", "Segoe UI", Arial, sans-serif';
export const HEADING_FONT = '"Manrope", "Source Sans 3", "Segoe UI", sans-serif';
export const MONO_FONT = '"JetBrains Mono", "SFMono-Regular", Consolas, monospace';

export function niceTicks(min, max, count = 4) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: 0, max: 1, ticks: [0, 0.5, 1] };
  }
  if (min === max) {
    const pad = Math.abs(min) * 0.1 || 1;
    min -= pad;
    max += pad;
  }
  const span = max - min;
  const rough = span / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / magnitude;
  const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10) * magnitude;
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks = [];
  for (let value = niceMin; value <= niceMax + step * 0.001; value += step) {
    ticks.push(Math.abs(value) < 1e-9 ? 0 : value);
  }
  return { min: niceMin, max: niceMax, ticks };
}

export function chooseTickIndices(length, maxTicks) {
  if (length <= 0) return [];
  const count = Math.max(2, Math.min(maxTicks, length));
  if (length <= count) return Array.from({ length }, (_, index) => index);
  const indices = new Set([0, length - 1]);
  for (let i = 1; i < count - 1; i += 1) {
    indices.add(Math.round((i * (length - 1)) / (count - 1)));
  }
  return [...indices].sort((a, b) => a - b);
}

export function toneColor(tone) {
  return CHART_COLORS[tone] || CHART_COLORS.ok;
}
