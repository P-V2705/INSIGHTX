// server/routes-analysis.js
// Analysis result persistence API (client-computed analysis snapshots)

import { Router } from 'express';
import { readSession } from './session.js';
import { rateLimitApi } from './rate-limiter.js';
import { requireAuth } from './security-middleware.js';
import prisma from './prisma.js';

const router = Router();

// Maximum analysis result payload size (5MB for comprehensive analysis with all insights)
const MAX_ANALYSIS_PAYLOAD = 5 * 1024 * 1024;

/**
 * POST /api/analysis
 * Accept and store pre-computed analysis result from frontend.
 * Frontend has already run analyzeDataset() locally with actual dataset rows.
 * Backend validates, verifies dataset ownership, and persists the result.
 */
router.post(
  '/',
  rateLimitApi('analysis'),
  requireAuth,
  async (req, res) => {
    try {
      const userId = req.userId;
      
      // Check content-length to prevent DoS
      const contentLength = parseInt(req.headers['content-length'] || '0', 10);
      if (contentLength > MAX_ANALYSIS_PAYLOAD) {
        return res.status(413).json({
          error: 'Payload too large',
          maxSize: MAX_ANALYSIS_PAYLOAD,
        });
      }

      const { datasetId, analysis, config } = req.body;

      // Validate required fields
      if (!datasetId || !analysis) {
        return res.status(400).json({
          error: 'Missing required fields: datasetId, analysis',
        });
      }

      // Verify dataset exists and belongs to user
      const dataset = await prisma.dataset.findFirst({
        where: {
          id: datasetId,
          userId,
          deletedAt: null,
        },
      });

      if (!dataset) {
        return res.status(404).json({
          error: 'Dataset not found or access denied',
        });
      }

      // Validate analysis structure (should have computed results)
      if (!analysis.available || !analysis.metrics) {
        return res.status(400).json({
          error: 'Invalid analysis structure: missing required fields',
        });
      }

      // Validate payload size
      const resultDataStr = JSON.stringify(analysis);
      if (Buffer.byteLength(resultDataStr) > MAX_ANALYSIS_PAYLOAD) {
        return res.status(413).json({
          error: 'Analysis result too large',
          maxSize: MAX_ANALYSIS_PAYLOAD,
        });
      }

      // Create analysis session
      const session = await prisma.analysisSession.create({
        data: {
          title: `Analysis: ${dataset.name}`,
          description: `Client-computed analysis of ${config?.measureKey || 'dataset'}`,
          status: 'completed',
          userId,
          datasetId,
        },
      });

      // Store analysis result
      await prisma.analysisResult.create({
        data: {
          sessionId: session.id,
          resultType: 'summary',
          resultData: resultDataStr,
          description: `Descriptive analysis snapshot (${analysis.validCount || 0} valid records)`,
        },
      });

      return res.status(201).json({
        ok: true,
        analysisId: session.id,
        status: 'completed',
        createdAt: session.createdAt,
      });
    } catch (error) {
      console.error('[analysis] POST failed:', error.message);
      
      // Avoid exposing internal database errors
      if (error.code === 'P2002') {
        return res.status(409).json({ error: 'Duplicate analysis session' });
      }
      
      res.status(500).json({ error: 'Analysis storage failed' });
    }
  }
);

/**
 * GET /api/analysis/:id
 * Retrieve a specific analysis belonging to the authenticated user.
 * Cross-user access is prevented by enforcing userId in the query.
 */
router.get(
  '/:id',
  rateLimitApi('read'),
  requireAuth,
  async (req, res) => {
    try {
      const userId = req.userId;
      const analysisId = req.params.id;

      const session = await prisma.analysisSession.findFirst({
        where: {
          id: analysisId,
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
              createdAt: true,
            },
          },
        },
      });

      if (!session) {
        return res.status(404).json({
          error: 'Analysis not found or access denied',
        });
      }

      // Extract stored analysis result
      let analysis = null;
      if (session.results.length > 0) {
        const summaryResult = session.results.find(r => r.resultType === 'summary');
        if (summaryResult) {
          try {
            analysis = JSON.parse(summaryResult.resultData);
          } catch (e) {
            console.error('[analysis] Failed to parse stored result:', e.message);
            return res.status(500).json({ error: 'Corrupted analysis data' });
          }
        }
      }

      return res.json({
        ok: true,
        id: session.id,
        title: session.title,
        description: session.description,
        status: session.status,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        dataset: session.dataset,
        analysis,
      });
    } catch (error) {
      console.error('[analysis] GET/:id failed:', error.message);
      res.status(500).json({ error: 'Failed to retrieve analysis' });
    }
  }
);

/**
 * GET /api/analysis
 * List analyses for the authenticated user.
 * Supports pagination via ?limit and ?offset query parameters.
 */
router.get(
  '/',
  rateLimitApi('list'),
  requireAuth,
  async (req, res) => {
    try {
      const userId = req.userId;
      const limit = Math.min(parseInt(req.query.limit || '10', 10), 50);
      const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);

      if (limit < 1 || isNaN(limit) || offset < 0 || isNaN(offset)) {
        return res.status(400).json({
          error: 'Invalid pagination parameters',
          hint: 'limit must be 1-50, offset must be >= 0',
        });
      }

      const [sessions, total] = await Promise.all([
        prisma.analysisSession.findMany({
          where: {
            userId,
            deletedAt: null,
          },
          include: {
            dataset: {
              select: {
                name: true,
                fileName: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        prisma.analysisSession.count({
          where: {
            userId,
            deletedAt: null,
          },
        }),
      ]);

      return res.json({
        ok: true,
        analyses: sessions.map(s => ({
          id: s.id,
          title: s.title,
          status: s.status,
          datasetName: s.dataset?.name || 'Unknown',
          datasetFileName: s.dataset?.fileName || '',
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        })),
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      });
    } catch (error) {
      console.error('[analysis] GET list failed:', error.message);
      res.status(500).json({ error: 'Failed to list analyses' });
    }
  }
);

export default router;
