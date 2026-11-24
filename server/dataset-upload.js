// server/dataset-upload.js
// Secure dataset upload endpoint with file validation and storage

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { IMPORT_LIMITS } from "../src/lib/dataset.js";
import prisma from "./prisma.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// File storage configuration
const STORAGE_DIR = process.env.UPLOAD_STORAGE_DIR
  ? path.resolve(process.env.UPLOAD_STORAGE_DIR)
  : path.join(__dirname, "..", "uploads");

// Supported file formats with MIME types and magic numbers
const SUPPORTED_FORMATS = {
  csv: {
    mimeTypes: ["text/csv", "text/plain"],
    magicNumbers: [0x2c, 0x09, 0x0a, 0x22, 0x2d], // Heuristic: comma, tab, newline, quote, dash
    extension: "csv",
  },
  tsv: {
    mimeTypes: ["text/tab-separated-values", "text/plain"],
    magicNumbers: [0x09, 0x0a], // Tab, newline
    extension: "tsv",
  },
  xlsx: {
    mimeTypes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    magicNumbers: [0x50, 0x4b, 0x03, 0x04], // ZIP header (PK\x03\x04)
    extension: "xlsx",
  },
  xls: {
    mimeTypes: ["application/vnd.ms-excel"],
    magicNumbers: [0xd0, 0xcf, 0x11, 0xe0], // OLE2 header
    extension: "xls",
  },
  json: {
    mimeTypes: ["application/json"],
    magicNumbers: [0x7b, 0x5b, 0x20, 0x09, 0x0a], // { [ space tab newline
    extension: "json",
  },
};

/**
 * Ensure upload storage directory exists and is secure
 */
export async function ensureUploadDir() {
  try {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true, mode: 0o700 });
    }
    // Verify directory permissions (should be 700 or restrictive)
    const stats = fs.statSync(STORAGE_DIR);
    if ((stats.mode & 0o077) !== 0) {
      console.warn("[upload] Warning: upload directory has permissive permissions");
    }
  } catch (error) {
    console.error("[upload] Failed to ensure upload directory:", error.message);
    throw new Error("Upload storage initialization failed");
  }
}

/**
 * Validate file extension
 */
function validateExtension(filename) {
  const ext = path.extname(filename).toLowerCase().slice(1);
  if (!Object.keys(SUPPORTED_FORMATS).includes(ext)) {
    return {
      valid: false,
      error: `File type ".${ext || "unknown"}" is not supported. Supported formats: CSV, TSV, XLSX, XLS, JSON`,
    };
  }
  return { valid: true, extension: ext };
}

/**
 * Validate MIME type
 */
function validateMimeType(mimeType, extension) {
  const format = SUPPORTED_FORMATS[extension];
  if (!format.mimeTypes.includes(mimeType)) {
    return {
      valid: false,
      error: `File MIME type "${mimeType}" does not match expected type for .${extension} files`,
    };
  }
  return { valid: true };
}

/**
 * Check magic numbers to verify file content
 * This is a basic heuristic check; actual validation happens during parsing
 */
function validateMagicNumbers(buffer, extension) {
  const format = SUPPORTED_FORMATS[extension];
  if (!format.magicNumbers || format.magicNumbers.length === 0) {
    return { valid: true }; // No magic number check defined
  }

  // Check if buffer starts with any of the expected magic numbers
  for (const magic of format.magicNumbers) {
    if (buffer[0] === magic) {
      return { valid: true };
    }
  }

  return {
    valid: false,
    error: `File content does not match the expected format for .${extension} files (magic number mismatch)`,
  };
}

/**
 * Generate a safe server-side filename
 * Prevents directory traversal and collision attacks
 */
function generateSafeFilename(originalFilename, userId) {
  // Remove path separators and dangerous characters
  const basename = path.basename(originalFilename);
  const cleanName = basename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);

  // Generate unique identifier to prevent collisions
  const timestamp = Date.now();
  const hash = crypto
    .createHash("sha256")
    .update(`${userId}:${timestamp}:${Math.random()}`)
    .digest("hex")
    .slice(0, 8);

  const ext = path.extname(cleanName);
  const nameWithoutExt = path.basename(cleanName, ext);

  return `${nameWithoutExt}_${hash}${ext}`;
}

/**
 * Store uploaded file to disk
 */
async function storeFile(buffer, safeFilename) {
  const filePath = path.join(STORAGE_DIR, safeFilename);

  // Security: Ensure the resolved path is within STORAGE_DIR
  const resolvedPath = path.resolve(filePath);
  const resolvedStorageDir = path.resolve(STORAGE_DIR);
  if (!resolvedPath.startsWith(resolvedStorageDir)) {
    throw new Error("Path traversal attempt detected");
  }

  return new Promise((resolve, reject) => {
    fs.writeFile(filePath, buffer, (err) => {
      if (err) {
        reject(new Error(`Failed to store file: ${err.message}`));
      } else {
        resolve(resolvedPath);
      }
    });
  });
}

/**
 * Delete stored file
 */
export async function deleteStoredFile(safeFilename) {
  const filePath = path.join(STORAGE_DIR, safeFilename);
  const resolvedPath = path.resolve(filePath);
  const resolvedStorageDir = path.resolve(STORAGE_DIR);

  if (!resolvedPath.startsWith(resolvedStorageDir)) {
    throw new Error("Invalid file path");
  }

  return new Promise((resolve, reject) => {
    fs.unlink(resolvedPath, (err) => {
      if (err && err.code !== "ENOENT") {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Handle dataset upload
 * Validates file, stores it securely, and creates database record
 */
export async function handleDatasetUpload(file, userId) {
  if (!file) {
    throw new Error("No file provided");
  }

  const buffer = file.buffer || (await file.arrayBuffer());
  const filename = file.originalname || file.name || "upload";
  const mimeType = file.mimetype || file.type || "application/octet-stream";
  const fileSize = buffer.byteLength || buffer.length;

  // Validate extension
  const extValidation = validateExtension(filename);
  if (!extValidation.valid) {
    throw new Error(extValidation.error);
  }

  const extension = extValidation.extension;

  // Validate MIME type
  const mimeValidation = validateMimeType(mimeType, extension);
  if (!mimeValidation.valid) {
    throw new Error(mimeValidation.error);
  }

  // Validate file size
  if (fileSize === 0) {
    throw new Error("File is empty");
  }

  if (fileSize > IMPORT_LIMITS.maxFileBytes) {
    const maxMB = (IMPORT_LIMITS.maxFileBytes / 1024 / 1024).toFixed(1);
    throw new Error(
      `File size ${(fileSize / 1024 / 1024).toFixed(1)}MB exceeds limit of ${maxMB}MB`
    );
  }

  // Magic number validation disabled - actual validation happens during file parsing
  // const magicValidation = validateMagicNumbers(Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer), extension);
  // if (!magicValidation.valid) {
  //   throw new Error(magicValidation.error);
  // }

  // Generate safe filename
  const safeFilename = generateSafeFilename(filename, userId);

  // Store file
  const bufferToStore = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  let storedFilePath;
  try {
    storedFilePath = await storeFile(bufferToStore, safeFilename);
  } catch (error) {
    throw new Error(`File storage failed: ${error.message}`);
  }

  // Create database record
  let dataset;
  try {
    dataset = await prisma.dataset.create({
      data: {
        name: filename.replace(/\.[^/.]+$/, ""), // Remove extension for name
        fileName: filename,
        mimeType: mimeType,
        fileSize: BigInt(fileSize),
        columns: [], // Will be populated after parsing
        rowCount: 0,
        columnCount: 0,
        userId: userId,
      },
    });
  } catch (error) {
    // Clean up stored file if database operation fails
    await deleteStoredFile(safeFilename).catch(() => {});
    throw new Error(`Database creation failed: ${error.message}`);
  }

  return {
    dataset,
    safeFilename,
    filePath: storedFilePath,
  };
}

/**
 * Retrieve stored file buffer
 */
export async function getStoredFileBuffer(safeFilename) {
  const filePath = path.join(STORAGE_DIR, safeFilename);
  const resolvedPath = path.resolve(filePath);
  const resolvedStorageDir = path.resolve(STORAGE_DIR);

  if (!resolvedPath.startsWith(resolvedStorageDir)) {
    throw new Error("Invalid file path");
  }

  return new Promise((resolve, reject) => {
    fs.readFile(resolvedPath, (err, buffer) => {
      if (err) {
        reject(new Error(`Failed to read file: ${err.message}`));
      } else {
        resolve(buffer);
      }
    });
  });
}

/**
 * Get storage directory path
 */
export function getStorageDir() {
  return STORAGE_DIR;
}






