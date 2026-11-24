// server/dataset-upload.test.js - FIXED VERSION
// Test suite for dataset upload functionality

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  handleDatasetUpload,
  deleteStoredFile,
  ensureUploadDir,
} from "./dataset-upload.js";
import prisma from "./prisma.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Test utilities
function createTestFile(content, filename, mimeType = "text/csv") {
  const buffer = Buffer.from(content);
  return {
    buffer,
    originalname: filename,
    mimetype: mimeType,
    name: filename,
    type: mimeType,
  };
}

async function runTests() {
  console.log("\n=== Dataset Upload Test Suite ===\n");

  let passed = 0;
  let failed = 0;
  let testUser = null;

  try {
    // Initialize storage
    await ensureUploadDir();
    console.log("? Upload directory initialized\n");

    // Create a test user in the database
    testUser = await prisma.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        displayName: "Test User",
      },
    });
    console.log(`? Created test user: ${testUser.id}\n`);

    // Test 1: Valid CSV upload
    try {
      console.log("TEST 1: Valid CSV upload");
      const csvContent = "Name,Age,City\nAlice,30,NYC\nBob,25,LA\n";
      const file = createTestFile(csvContent, "test.csv", "text/csv");

      const result = await handleDatasetUpload(file, testUser.id);
      if (result.dataset.id && result.safeFilename) {
        console.log("? PASSED: CSV uploaded successfully\n");
        passed++;

        // Cleanup
        await deleteStoredFile(result.safeFilename);
        await prisma.dataset.delete({ where: { id: result.dataset.id } });
      } else {
        throw new Error("Missing dataset ID or safe filename");
      }
    } catch (error) {
      console.error("? FAILED:", error.message, "\n");
      failed++;
    }

    // Test 2: Valid TSV upload
    try {
      console.log("TEST 2: Valid TSV upload");
      const tsvContent = "Name\tAge\tCity\nAlice\t30\tNYC\n";
      const file = createTestFile(tsvContent, "test.tsv", "text/tab-separated-values");

      const result = await handleDatasetUpload(file, testUser.id);
      if (result.dataset.id) {
        console.log("? PASSED: TSV uploaded successfully\n");
        passed++;
        await deleteStoredFile(result.safeFilename);
        await prisma.dataset.delete({ where: { id: result.dataset.id } });
      } else {
        throw new Error("Missing dataset ID");
      }
    } catch (error) {
      console.error("? FAILED:", error.message, "\n");
      failed++;
    }

    // Test 3: Valid JSON upload
    try {
      console.log("TEST 3: Valid JSON upload");
      const jsonContent = '[{"id":1,"name":"Test"}]';
      const file = createTestFile(jsonContent, "test.json", "application/json");

      const result = await handleDatasetUpload(file, testUser.id);
      if (result.dataset.id) {
        console.log("? PASSED: JSON uploaded successfully\n");
        passed++;
        await deleteStoredFile(result.safeFilename);
        await prisma.dataset.delete({ where: { id: result.dataset.id } });
      } else {
        throw new Error("Missing dataset ID");
      }
    } catch (error) {
      console.error("? FAILED:", error.message, "\n");
      failed++;
    }

    // Test 4: Unsupported file format rejection
    try {
      console.log("TEST 4: Unsupported file format rejection");
      const file = createTestFile("content", "test.exe", "application/octet-stream");

      try {
        await handleDatasetUpload(file, testUser.id);
        console.error("? FAILED: Should have rejected .exe file\n");
        failed++;
      } catch (error) {
        if (error.message.includes("not supported")) {
          console.log("? PASSED: Unsupported format rejected\n");
          passed++;
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error("? FAILED:", error.message, "\n");
      failed++;
    }

    // Test 5: Oversized file rejection
    try {
      console.log("TEST 5: Oversized file rejection");
      const largeBuffer = Buffer.alloc(16 * 1024 * 1024 + 1);
      const file = {
        buffer: largeBuffer,
        originalname: "large.csv",
        mimetype: "text/csv",
      };

      try {
        await handleDatasetUpload(file, testUser.id);
        console.error("? FAILED: Should have rejected oversized file\n");
        failed++;
      } catch (error) {
        if (error.message.includes("exceeds limit")) {
          console.log("? PASSED: Oversized file rejected\n");
          passed++;
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error("? FAILED:", error.message, "\n");
      failed++;
    }

    // Test 6: Empty file rejection
    try {
      console.log("TEST 6: Empty file rejection");
      const file = createTestFile("", "empty.csv", "text/csv");

      try {
        await handleDatasetUpload(file, testUser.id);
        console.error("? FAILED: Should have rejected empty file\n");
        failed++;
      } catch (error) {
        if (error.message.includes("empty")) {
          console.log("? PASSED: Empty file rejected\n");
          passed++;
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error("? FAILED:", error.message, "\n");
      failed++;
    }

    // Test 7: User ownership isolation
    try {
      console.log("TEST 7: User ownership isolation");
      const csvContent = "Name,Value\nTest,123\n";
      const file = createTestFile(csvContent, "test.csv", "text/csv");

      const result = await handleDatasetUpload(file, testUser.id);
      const dataset = await prisma.dataset.findUnique({
        where: { id: result.dataset.id },
      });

      if (dataset.userId === testUser.id) {
        console.log("? PASSED: Dataset ownership verified\n");
        passed++;
        await deleteStoredFile(result.safeFilename);
        await prisma.dataset.delete({ where: { id: result.dataset.id } });
      } else {
        throw new Error("Ownership not correctly assigned");
      }
    } catch (error) {
      console.error("? FAILED:", error.message, "\n");
      failed++;
    }

    // Test 8: Path traversal prevention
    try {
      console.log("TEST 8: Path traversal prevention");
      const csvContent = "Name,Value\nTest,123\n";
      const file = createTestFile(csvContent, "../../../etc/passwd.csv", "text/csv");

      const result = await handleDatasetUpload(file, testUser.id);
      if (result.safeFilename && !result.safeFilename.includes("..")) {
        console.log("? PASSED: Path traversal prevented\n");
        passed++;
        await deleteStoredFile(result.safeFilename);
        await prisma.dataset.delete({ where: { id: result.dataset.id } });
      } else {
        throw new Error("Path traversal not prevented");
      }
    } catch (error) {
      console.error("? FAILED:", error.message, "\n");
      failed++;
    }

    // Test 9: Duplicate filename handling
    try {
      console.log("TEST 9: Duplicate filename handling");
      const csvContent = "Name,Value\nTest,123\n";
      const file1 = createTestFile(csvContent, "test.csv", "text/csv");
      const file2 = createTestFile(csvContent, "test.csv", "text/csv");

      const result1 = await handleDatasetUpload(file1, testUser.id);
      const result2 = await handleDatasetUpload(file2, testUser.id);

      if (result1.safeFilename !== result2.safeFilename) {
        console.log("? PASSED: Duplicate filenames handled with unique IDs\n");
        passed++;
        await deleteStoredFile(result1.safeFilename);
        await deleteStoredFile(result2.safeFilename);
        await prisma.dataset.delete({ where: { id: result1.dataset.id } });
        await prisma.dataset.delete({ where: { id: result2.dataset.id } });
      } else {
        throw new Error("Filenames not differentiated");
      }
    } catch (error) {
      console.error("? FAILED:", error.message, "\n");
      failed++;
    }

    // Test 10: MIME type mismatch rejection
    try {
      console.log("TEST 10: MIME type mismatch rejection");
      const csvContent = "Name,Value\nTest,123\n";
      const file = createTestFile(csvContent, "test.csv", "application/json");

      try {
        await handleDatasetUpload(file, testUser.id);
        console.error("? FAILED: Should have rejected MIME type mismatch\n");
        failed++;
      } catch (error) {
        if (error.message.includes("MIME type")) {
          console.log("? PASSED: MIME type mismatch rejected\n");
          passed++;
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error("? FAILED:", error.message, "\n");
      failed++;
    }

    console.log(
      `\n=== Test Results: ${passed} passed, ${failed} failed (${passed + failed} total) ===\n`
    );

    // Cleanup
    if (testUser) {
      await prisma.user.delete({ where: { id: testUser.id } });
      console.log("? Cleaned up test user\n");
    }

    if (failed === 0) {
      console.log("? All tests passed!\n");
      process.exit(0);
    } else {
      console.error("? Some tests failed\n");
      process.exit(1);
    }
  } catch (error) {
    console.error("Test suite error:", error.message);
    if (testUser) {
      try {
        await prisma.user.delete({ where: { id: testUser.id } });
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run tests
runTests();
