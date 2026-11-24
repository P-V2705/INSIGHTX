// server/routes-report.js
// Report generation and download API

import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { rateLimitApi } from './rate-limiter.js';
import { requireAuth } from './security-middleware.js';
import prisma from './prisma.js';
import { buildSummaryCsv, exportBaseName } from '../src/lib/exports.js';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Report storage directory (outside public)
const REPORTS_DIR = process.env.REPORTS_STORAGE_DIR
  ? path.resolve(process.env.REPORTS_STORAGE_DIR)
  : path.join(__dirname, '..', 'reports-generated');

// Ensure reports directory exists
function ensureReportsDir() {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true, mode: 0o700 });
  }
}

/**
 * POST /api/reports
 * Create a report from a saved analysis.
 * Frontend provides a pre-computed report snapshot.
 * Backend validates and stores it.
 */
router.post(
  '/',
  rateLimitApi('analysis'),
  requireAuth,
  async (req, res) => {
    try {
      const userId = req.userId;
      ensureReportsDir();

      const { analysisId, reportSnapshot, format = 'json' } = req.body;

      // Validate required fields
      if (!analysisId || !reportSnapshot) {
        return res.status(400).json({
          error: 'Missing required fields: analysisId, reportSnapshot',
        });
      }

      // Validate format
      const supportedFormats = ['json', 'csv'];
      if (!supportedFormats.includes(format)) {
        return res.status(400).json({
          error: `Unsupported format: ${format}. Supported: ${supportedFormats.join(', ')}`,
        });
      }

      // Verify analysis exists and belongs to user
      const analysis = await prisma.analysisSession.findFirst({
        where: {
          id: analysisId,
          userId,
          deletedAt: null,
        },
        include: {
          results: true,
          dataset: true,
        },
      });

      if (!analysis) {
        return res.status(404).json({
          error: 'Analysis not found or access denied',
        });
      }

      // Validate report snapshot structure
      if (!reportSnapshot.config || !reportSnapshot.metrics) {
        return res.status(400).json({
          error: 'Invalid report structure: missing config or metrics',
        });
      }

      // Create report record
      const report = await prisma.report.create({
        data: {
          title: `Report: ${analysis.dataset?.name || 'Analysis'}`,
          description: `Generated report from analysis ${analysisId}`,
          content: JSON.stringify(reportSnapshot), // Store snapshot as content
          format: format,
          status: 'published',
          userId,
          sessionId: analysisId,
        },
      });

      return res.status(201).json({
        ok: true,
        reportId: report.id,
        status: 'published',
        format: format,
        createdAt: report.createdAt,
        publishedAt: report.publishedAt,
      });
    } catch (error) {
      console.error('[report] POST failed:', error.message);
      res.status(500).json({ error: 'Report generation failed' });
    }
  }
);

/**
 * GET /api/reports/:id
 * Retrieve report metadata and content.
 * Enforce user ownership.
 */
router.get(
  '/:id',
  rateLimitApi('read'),
  requireAuth,
  async (req, res) => {
    try {
      const userId = req.userId;
      const reportId = req.params.id;

      const report = await prisma.report.findFirst({
        where: {
          id: reportId,
          userId,
          deletedAt: null,
        },
        include: {
          session: {
            select: {
              id: true,
              title: true,
              dataset: {
                select: {
                  name: true,
                  fileName: true,
                },
              },
            },
          },
        },
      });

      if (!report) {
        return res.status(404).json({
          error: 'Report not found or access denied',
        });
      }

      let content = null;
      try {
        content = JSON.parse(report.content);
      } catch (e) {
        console.error('[report] Failed to parse content:', e.message);
        return res.status(500).json({ error: 'Corrupted report data' });
      }

      return res.json({
        ok: true,
        id: report.id,
        title: report.title,
        description: report.description,
        format: report.format,
        status: report.status,
        createdAt: report.createdAt,
        publishedAt: report.publishedAt,
        session: report.session,
        content,
      });
    } catch (error) {
      console.error('[report] GET/:id failed:', error.message);
      res.status(500).json({ error: 'Failed to retrieve report' });
    }
  }
);

/**
 * GET /api/reports
 * List reports for the authenticated user.
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
        });
      }

      const [reports, total] = await Promise.all([
        prisma.report.findMany({
          where: {
            userId,
            deletedAt: null,
          },
          include: {
            session: {
              select: {
                dataset: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        prisma.report.count({
          where: {
            userId,
            deletedAt: null,
          },
        }),
      ]);

      return res.json({
        ok: true,
        reports: reports.map(r => ({
          id: r.id,
          title: r.title,
          status: r.status,
          format: r.format,
          datasetName: r.session?.dataset?.name || 'Unknown',
          createdAt: r.createdAt,
          publishedAt: r.publishedAt,
        })),
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      });
    } catch (error) {
      console.error('[report] GET list failed:', error.message);
      res.status(500).json({ error: 'Failed to list reports' });
    }
  }
);

/**
 * GET /api/reports/:id/download
 * Download report in requested format (json, csv).
 */
router.get(
  '/:id/download',
  rateLimitApi('read'),
  requireAuth,
  async (req, res) => {
    try {
      const userId = req.userId;
      const reportId = req.params.id;
      const downloadFormat = (req.query.format || 'json').toLowerCase();

      // Verify report ownership
      const report = await prisma.report.findFirst({
        where: {
          id: reportId,
          userId,
          deletedAt: null,
        },
        include: {
          session: {
            select: {
              dataset: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });

      if (!report) {
        return res.status(404).json({
          error: 'Report not found or access denied',
        });
      }

      let content;
      try {
        content = JSON.parse(report.content);
      } catch (e) {
        console.error('[report] Corrupted data:', e.message);
        return res.status(500).json({ error: 'Corrupted report data' });
      }

      // Generate download based on format
      if (downloadFormat === 'csv') {
        // Convert report snapshot to CSV format
        const csv = buildSummaryCsv(content);
        const filename = `report-${reportId}-${new Date().toISOString().split('T')[0]}.csv`;

        res.setHeader('Content-Type', 'text/csv;charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(`\uFEFF${csv}`);
      } else {
        // Default: JSON format
        const filename = `report-${reportId}-${new Date().toISOString().split('T')[0]}.json`;

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.json(content);
      }
    } catch (error) {
      console.error('[report] Download failed:', error.message);
      res.status(500).json({ error: 'Download failed' });
    }
  }
);

/**
 * DELETE /api/reports/:id
 * Delete a report (soft delete via deletedAt).
 */
router.delete(
  '/:id',
  rateLimitApi('write'),
  requireAuth,
  async (req, res) => {
    try {
      const userId = req.userId;
      const reportId = req.params.id;

      // Verify ownership
      const report = await prisma.report.findFirst({
        where: {
          id: reportId,
          userId,
          deletedAt: null,
        },
      });

      if (!report) {
        return res.status(404).json({
          error: 'Report not found or access denied',
        });
      }

      // Soft delete
      await prisma.report.update({
        where: { id: reportId },
        data: { deletedAt: new Date() },
      });

      return res.json({
        ok: true,
        message: 'Report deleted',
      });
    } catch (error) {
      console.error('[report] DELETE failed:', error.message);
      res.status(500).json({ error: 'Deletion failed' });
    }
  }
);

export default router;
