// server/routes-dataset.js (UPDATED)
// Dataset management routes with rate limiting and security enforcement

import { Router } from "express";
import { readSession } from "./session.js";
import {
  handleDatasetUpload,
  ensureUploadDir,
  deleteStoredFile,
} from "./dataset-upload.js";
import prisma from "./prisma.js";
import {
  rateLimitUpload,
  rateLimitApi,
} from "./rate-limiter.js";
import {
  requireAuth,
  verifyDatasetOwnership,
  validateUploadPayload,
  preventUnauthorizedDeletion,
} from "./security-middleware.js";

const router = Router();

/**
 * Initialize upload storage on startup
 */
router.get("/__init-upload", async (req, res) => {
  try {
    await ensureUploadDir();
    res.json({ ok: true });
  } catch (error) {
    console.error("[dataset] Upload dir init failed:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/datasets/upload
 * Authenticated endpoint to upload and create a dataset
 * Rate limited per user (default: 10 per hour)
 */
router.post(
  "/upload",
  rateLimitUpload(),
  requireAuth,
  validateUploadPayload,
  async (req, res) => {
    try {
      const userId = req.userId;

      // Handle upload
      const { dataset, safeFilename } = await handleDatasetUpload(
        req.file,
        userId
      );

      return res.status(201).json({
        ok: true,
        dataset: {
          id: dataset.id,
          name: dataset.name,
          fileName: dataset.fileName,
          mimeType: dataset.mimeType,
          fileSize: dataset.fileSize.toString(),
          rowCount: dataset.rowCount,
          columnCount: dataset.columnCount,
          createdAt: dataset.createdAt,
          storageName: safeFilename,
        },
      });
    } catch (error) {
      console.error("[dataset] Upload failed:", error.message);
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * GET /api/datasets
 * Authenticated endpoint to list user''s datasets
 * Rate limited per user (default: 30 per minute)
 */
router.get(
  "/",
  rateLimitApi("list"),
  requireAuth,
  async (req, res) => {
    try {
      const userId = req.userId;

      const datasets = await prisma.dataset.findMany({
        where: {
          userId: userId,
          deletedAt: null, // Exclude soft-deleted datasets
        },
        select: {
          id: true,
          name: true,
          fileName: true,
          mimeType: true,
          fileSize: true,
          rowCount: true,
          columnCount: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
      });

      res.json({ datasets });
    } catch (error) {
      console.error("[dataset] List failed:", error.message);
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * GET /api/datasets/:id
 * Authenticated endpoint to retrieve dataset metadata
 * Rate limited per user (default: 60 per minute)
 */
router.get(
  "/:id",
  rateLimitApi("read"),
  requireAuth,
  verifyDatasetOwnership,
  async (req, res) => {
    try {
      const dataset = req.dataset;

      res.json({
        dataset: {
          id: dataset.id,
          name: dataset.name,
          fileName: dataset.fileName,
          mimeType: dataset.mimeType,
          fileSize: dataset.fileSize.toString(),
          rowCount: dataset.rowCount,
          columnCount: dataset.columnCount,
          columns: dataset.columns,
          createdAt: dataset.createdAt,
          updatedAt: dataset.updatedAt,
        },
      });
    } catch (error) {
      console.error("[dataset] Get failed:", error.message);
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * DELETE /api/datasets/:id
 * Authenticated endpoint to soft-delete a dataset
 * Rate limited per user (default: 5 per hour)
 */
router.delete(
  "/:id",
  rateLimitApi("delete"),
  requireAuth,
  preventUnauthorizedDeletion,
  async (req, res) => {
    try {
      const dataset = req.dataset;
      const datasetId = dataset.id;

      // Soft delete
      const deletedDataset = await prisma.dataset.update({
        where: { id: datasetId },
        data: { deletedAt: new Date() },
      });

      res.json({ ok: true, dataset: { id: deletedDataset.id } });
    } catch (error) {
      console.error("[dataset] Delete failed:", error.message);
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
