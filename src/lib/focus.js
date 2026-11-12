export const FOCUS_OPTIONS = [
  {
    id: 'growth',
    label: 'Growth & trend',
    description: 'Follow the primary measure over time and put the size of any change in context.',
  },
  {
    id: 'drivers',
    label: 'Performance drivers',
    description: 'Compare groups and identify the categories contributing most to the measure.',
  },
  {
    id: 'segments',
    label: 'Segment mix',
    description: 'See how the measure is distributed across regions, products, channels, or segments.',
  },
  {
    id: 'quality',
    label: 'Data quality',
    description: 'Lead with completeness and missing values, then read the measures with that context.',
  },
];

export function getFocus(id) {
  return FOCUS_OPTIONS.find((option) => option.id === id) || FOCUS_OPTIONS[0];
}
