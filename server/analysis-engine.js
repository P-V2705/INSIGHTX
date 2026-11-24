// server/analysis-engine.js
// Analysis orchestration - bridges API requests to analysis calculations

import { analyzeDataset, getColumn } from '../src/lib/analysis.js';
import { IMPORT_LIMITS } from '../src/lib/dataset.js';
import prisma from './prisma.js';

/**
 * Process an analysis request for a dataset
 * Validates configuration, calls analysis engine, stores results
 */
export async function processAnalysis(userId, datasetId, rawConfig = {}) {
  try {
    // Fetch and validate dataset
    const dataset = await prisma.dataset.findFirst({
      where: {
        id: datasetId,
        userId,
        deletedAt: null,
      },
    });

    if (!dataset) {
      throw new Error('Dataset not found or access denied');
    }

    // Parse stored dataset structure
    const parsedDataset = JSON.parse(dataset.columns || '[]');
    const datasetWithColumns = {
      id: dataset.id,
      name: dataset.name,
      rowCount: dataset.rowCount || 0,
      columnCount: dataset.columnCount || 0,
      columns: parsedDataset,
      rows: [],
      completeness: 100,
      missingCells: 0,
      cellCount: 0,
    };

    // Validate configuration
    const config = validateAnalysisConfig(datasetWithColumns, rawConfig);
    if (!config.valid) {
      throw new Error(config.error);
    }

    // Run analysis engine
    const analysisResult = analyzeDataset(datasetWithColumns, config.cleaned);

    if (!analysisResult.available) {
      return {
        available: false,
        reason: analysisResult.reason,
        status: 'failed',
      };
    }

    return {
      available: true,
      status: 'completed',
      config: analysisResult.config,
      signature: analysisResult.signature,
      focus: analysisResult.focus,
      measure: analysisResult.measure,
      category: analysisResult.category,
      aggregation: analysisResult.aggregation,
      xAxis: analysisResult.xAxis,
      metrics: analysisResult.metrics,
      completeness: analysisResult.completeness,
      trend: analysisResult.trend,
      categories: analysisResult.categories,
      insights: analysisResult.insights,
      notes: analysisResult.notes,
      validCount: analysisResult.validCount,
      missingCount: analysisResult.missingCount,
      total: analysisResult.total,
      average: analysisResult.average,
    };
  } catch (error) {
    console.error('[analysis] Processing failed:', error.message);
    throw error;
  }
}

/**
 * Validate analysis configuration against dataset structure
 */
function validateAnalysisConfig(dataset, rawConfig = {}) {
  const config = {
    focus: rawConfig.focus || 'growth',
    measureKey: rawConfig.measureKey || null,
    categoryKey: rawConfig.categoryKey || null,
    xAxisKey: rawConfig.xAxisKey || '__record__',
    aggregation: rawConfig.aggregation === 'avg' ? 'avg' : 'sum',
  };

  // Validate focus value
  const validFocuses = ['growth', 'quality', 'drivers', 'segments'];
  if (!validFocuses.includes(config.focus)) {
    return { valid: false, error: `Invalid focus: ${config.focus}` };
  }

  // Validate measure key
  if (!config.measureKey) {
    return { valid: false, error: 'measureKey is required' };
  }

  const measure = getColumn(dataset, config.measureKey);
  if (!measure) {
    return { valid: false, error: `Measure column not found: ${config.measureKey}` };
  }

  if (measure.kind !== 'numeric') {
    return { valid: false, error: `Measure must be numeric, got: ${measure.kind}` };
  }

  // Validate category key if provided
  if (config.categoryKey && config.categoryKey !== '') {
    const category = getColumn(dataset, config.categoryKey);
    if (!category) {
      return { valid: false, error: `Category column not found: ${config.categoryKey}` };
    }

    if (category.kind !== 'category') {
      return { valid: false, error: `Category must be categorical, got: ${category.kind}` };
    }
  }

  // Validate xAxis key if provided
  if (config.xAxisKey && config.xAxisKey !== '__record__') {
    const xAxis = getColumn(dataset, config.xAxisKey);
    if (!xAxis) {
      return { valid: false, error: `X-axis column not found: ${config.xAxisKey}` };
    }

    if (xAxis.kind !== 'date') {
      return { valid: false, error: `X-axis must be date, got: ${xAxis.kind}` };
    }
  }

  return { valid: true, cleaned: config };
}

/**
 * Create and store analysis session with results
 */
export async function createAnalysisSession(userId, datasetId, rawConfig, analysisResult) {
  try {
    const session = await prisma.analysisSession.create({
      data: {
        title: `Analysis ${new Date().toISOString().split('T')[0]}`,
        description: `Analysis of dataset with focus: ${rawConfig.focus || 'growth'}`,
        status: analysisResult.available ? 'completed' : 'failed',
        userId,
        datasetId,
      },
    });

    if (analysisResult.available) {
      await prisma.analysisResult.create({
        data: {
          sessionId: session.id,
          resultType: 'summary',
          resultData: JSON.stringify(analysisResult),
          description: `Descriptive analysis: ${analysisResult.measure?.name || 'unknown measure'}`,
        },
      });
    }

    return session;
  } catch (error) {
    console.error('[analysis] Session creation failed:', error.message);
    throw error;
  }
}

/**
 * Retrieve analysis session with results
 */
export async function getAnalysisSession(userId, sessionId) {
  try {
    const session = await prisma.analysisSession.findFirst({
      where: {
        id: sessionId,
        userId,
        deletedAt: null,
      },
      include: {
        results: true,
        dataset: {
          select: {
            id: true,
            name: true,
            fileName: true,
            rowCount: true,
            columnCount: true,
          },
        },
      },
    });

    if (!session) {
      throw new Error('Analysis session not found or access denied');
    }

    let analysisData = null;
    if (session.results.length > 0) {
      const summaryResult = session.results.find(r => r.resultType === 'summary');
      if (summaryResult) {
        analysisData = JSON.parse(summaryResult.resultData);
      }
    }

    return {
      id: session.id,
      title: session.title,
      description: session.description,
      status: session.status,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      dataset: session.dataset,
      analysis: analysisData,
    };
  } catch (error) {
    console.error('[analysis] Retrieval failed:', error.message);
    throw error;
  }
}

/**
 * List analysis sessions for a user
 */
export async function listAnalysisSessions(userId, limit = 10, offset = 0) {
  try {
    const sessions = await prisma.analysisSession.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      include: {
        dataset: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await prisma.analysisSession.count({
      where: {
        userId,
        deletedAt: null,
      },
    });

    return {
      sessions: sessions.map(s => ({
        id: s.id,
        title: s.title,
        status: s.status,
        datasetName: s.dataset?.name || 'Unknown',
        createdAt: s.createdAt,
      })),
      total,
      limit,
      offset,
    };
  } catch (error) {
    console.error('[analysis] List failed:', error.message);
    throw error;
  }
}
