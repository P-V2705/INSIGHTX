// server/security-middleware.js
// Security enforcement for dataset operations

import { readSession } from "./session.js";
import prisma from "./prisma.js";

/**
 * Require authentication for dataset operations
 */
export function requireAuth(req, res, next) {
  const session = readSession(req);
  if (!session) {
    return res.status(401).json({
      error: "Unauthorized - Authentication required",
      code: "AUTH_REQUIRED",
    });
  }

  // Attach user ID to request for downstream middleware
  req.userId = session.record.user.id;
  req.session = session;

  next();
}

/**
 * Verify dataset ownership before allowing access
 * Requires userId to be set by requireAuth middleware
 */
export async function verifyDatasetOwnership(req, res, next) {
  const { id: datasetId } = req.params;
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!datasetId) {
    return res.status(400).json({ error: "Dataset ID required" });
  }

  try {
    const dataset = await prisma.dataset.findFirst({
      where: {
        id: datasetId,
        userId: userId, // Owner check
        deletedAt: null, // Exclude soft-deleted
      },
    });

    if (!dataset) {
      return res.status(404).json({
        error: "Dataset not found or access denied",
        code: "NOT_FOUND",
      });
    }

    // Attach dataset to request for downstream handlers
    req.dataset = dataset;
    next();
  } catch (error) {
    console.error("[security] Dataset lookup failed:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Validate file upload payload
 */
export function validateUploadPayload(req, res, next) {
  // Check file exists
  if (!req.file) {
    return res.status(400).json({
      error: "No file uploaded",
      code: "NO_FILE",
    });
  }

  // Validate file has expected properties
  if (!req.file.buffer || !req.file.originalname || !req.file.mimetype) {
    return res.status(400).json({
      error: "Invalid file format",
      code: "INVALID_FILE",
    });
  }

  next();
}

/**
 * Sanitize error responses to prevent information leakage
 */
export function sanitizeErrors(err, req, res, next) {
  console.error("[error]", err?.message || err);

  // Don't leak internal error details to clients
  if (res.headersSent) {
    return next(err);
  }

  // Handle specific error types
  if (err.message?.includes("not supported")) {
    return res.status(400).json({
      error: err.message,
      code: "UNSUPPORTED_FORMAT",
    });
  }

  if (err.message?.includes("exceeds limit")) {
    return res.status(413).json({
      error: err.message,
      code: "FILE_TOO_LARGE",
    });
  }

  if (err.message?.includes("empty")) {
    return res.status(400).json({
      error: err.message,
      code: "EMPTY_FILE",
    });
  }

  if (err.message?.includes("MIME type")) {
    return res.status(400).json({
      error: err.message,
      code: "INVALID_MIME_TYPE",
    });
  }

  // Generic error response
  res.status(500).json({
    error: "Internal server error",
    code: "SERVER_ERROR",
  });
}

/**
 * Verify request payload size (before body parser)
 */
export function limitPayloadSize(maxBytes = 1024 * 1024) {
  return (req, res, next) => {
    const contentLength = parseInt(req.get("content-length") || "0", 10);

    if (contentLength > maxBytes) {
      return res.status(413).json({
        error: `Payload too large (${contentLength} bytes, max ${maxBytes} bytes)`,
        code: "PAYLOAD_TOO_LARGE",
      });
    }

    next();
  };
}

/**
 * Prevent unauthorized dataset deletion
 */
export async function preventUnauthorizedDeletion(req, res, next) {
  const { id: datasetId } = req.params;
  const userId = req.userId;

  if (!userId || !datasetId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const dataset = await prisma.dataset.findFirst({
      where: {
        id: datasetId,
        userId: userId,
        deletedAt: null,
      },
    });

    if (!dataset) {
      return res.status(404).json({
        error: "Cannot delete: dataset not found or already deleted",
        code: "CANNOT_DELETE",
      });
    }

    req.dataset = dataset;
    next();
  } catch (error) {
    console.error("[security] Delete verification failed:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
}

export default {
  requireAuth,
  verifyDatasetOwnership,
  validateUploadPayload,
  sanitizeErrors,
  limitPayloadSize,
  preventUnauthorizedDeletion,
};
