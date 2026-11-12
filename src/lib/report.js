export function buildReportSnapshot(session, analysis) {
  if (!session?.dataset || !analysis?.available) return null;
  const snapshot = {
    version: 1,
    finalizedAt: new Date().toISOString(),
    sessionCreatedAt: session.createdAt,
    source: session.source,
    sourceReference: session.sourceReference,
    dataset: {
      rowCount: session.dataset.rowCount,
      sourceRowCount: session.dataset.sourceRowCount,
      columnCount: session.dataset.columnCount,
      truncated: session.dataset.truncated,
      typeCounts: session.dataset.typeCounts,
      completeness: session.dataset.completeness,
    },
    focus: analysis.focus,
    signature: analysis.signature,
    config: {
      measureKey: analysis.measure.key,
      measureName: analysis.measure.name,
      measureUnit: analysis.measure.unit,
      categoryKey: analysis.category?.key ?? null,
      categoryName: analysis.category?.name ?? null,
      xAxisKey: analysis.xAxis.key,
      xAxisName: analysis.xAxis.name,
      aggregation: analysis.aggregation,
      focusId: analysis.focus.id,
      focusLabel: analysis.focus.label,
    },
    metrics: analysis.metrics,
    completeness: analysis.completeness,
    trend: analysis.trend,
    categories: analysis.categories,
    insights: analysis.insights,
    notes: analysis.notes,
  };
  return JSON.parse(JSON.stringify(snapshot));
}
