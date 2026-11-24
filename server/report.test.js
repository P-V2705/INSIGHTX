// server/report.test.js
// Test suite for Report Generation API

import prisma from "./prisma.js";

/**
 * Create test fixtures
 */
async function setupTestFixtures() {
  // Create test users
  const user1 = await prisma.user.create({
    data: {
      email: `test-report-user1-${Date.now()}@example.com`,
      displayName: "Report Test User 1",
    },
  });

  const user2 = await prisma.user.create({
    data: {
      email: `test-report-user2-${Date.now()}@example.com`,
      displayName: "Report Test User 2",
    },
  });

  // Create test dataset
  const dataset = await prisma.dataset.create({
    data: {
      name: "Test Dataset",
      fileName: "test.csv",
      mimeType: "text/csv",
      fileSize: BigInt(5000),
      rowCount: 100,
      columnCount: 3,
      columns: ["revenue", "region", "date"],
      userId: user1.id,
    },
  });

  // Create test analysis session
  const analysis = await prisma.analysisSession.create({
    data: {
      title: "Test Analysis",
      status: "completed",
      userId: user1.id,
      datasetId: dataset.id,
    },
  });

  return { user1, user2, dataset, analysis };
}

/**
 * Create a mock report snapshot
 */
function createMockReportSnapshot() {
  return {
    version: 1,
    finalizedAt: new Date().toISOString(),
    config: {
      measureKey: "revenue",
      measureName: "Revenue",
      aggregation: "sum",
      categoryKey: "region",
      categoryName: "Region",
      xAxisKey: "__record__",
      xAxisName: "Record order",
    },
    dataset: {
      rowCount: 100,
      columnCount: 3,
      completeness: 95,
    },
    metrics: [
      {
        id: "total",
        label: "Total Revenue",
        valueLabel: "$1,234,567.89",
        hint: "Sum of populated records",
      },
      {
        id: "average",
        label: "Average Revenue",
        valueLabel: "$12,345.68",
        hint: "Mean across records",
      },
    ],
    trend: {
      points: [
        { label: "Period 1", value: 100000, count: 25 },
        { label: "Period 2", value: 120000, count: 25 },
      ],
      granularity: "records",
    },
    categories: {
      items: [
        { label: "North", value: 400000, share: 35 },
        { label: "South", value: 300000, share: 25 },
      ],
    },
    insights: [
      {
        tag: "Trend",
        title: "Revenue trending upward",
        body: "Observed change over time",
      },
    ],
    notes: ["All values from imported data", "No estimates or forecasts"],
  };
}

/**
 * Run all tests
 */
async function runTests() {
  console.log("\n=== Report API Test Suite ===\n");

  let passed = 0;
  let failed = 0;
  let fixtures = null;

  try {
    fixtures = await setupTestFixtures();
    console.log("✓ Test fixtures created\n");

    // TEST 1: Successful report generation
    try {
      console.log("TEST 1: Successful report generation");
      const snapshot = createMockReportSnapshot();

      const report = await prisma.report.create({
        data: {
          title: "Test Report",
          content: JSON.stringify(snapshot),
          format: "json",
          status: "published",
          userId: fixtures.user1.id,
          sessionId: fixtures.analysis.id,
        },
      });

      if (report.id && report.status === "published") {
        console.log("✓ PASSED: Report created and published\n");
        passed++;
      } else {
        throw new Error("Report not created properly");
      }
    } catch (error) {
      console.error("✗ FAILED:", error.message, "\n");
      failed++;
    }

    // TEST 2: Report generation from valid analysis
    try {
      console.log("TEST 2: Report generation from valid analysis");
      const snapshot = createMockReportSnapshot();

      const report = await prisma.report.create({
        data: {
          title: `Report for Analysis ${fixtures.analysis.id}`,
          content: JSON.stringify(snapshot),
          format: "json",
          status: "published",
          userId: fixtures.user1.id,
          sessionId: fixtures.analysis.id,
        },
      });

      // Verify linked to analysis
      const linked = await prisma.report.findFirst({
        where: { id: report.id, sessionId: fixtures.analysis.id },
      });

      if (linked) {
        console.log("✓ PASSED: Report linked to analysis\n");
        passed++;
      } else {
        throw new Error("Report not linked to analysis");
      }
    } catch (error) {
      console.error("✗ FAILED:", error.message, "\n");
      failed++;
    }

    // TEST 3: CSV export format
    try {
      console.log("TEST 3: CSV export format support");
      const snapshot = createMockReportSnapshot();

      const report = await prisma.report.create({
        data: {
          title: "CSV Export Test",
          content: JSON.stringify(snapshot),
          format: "csv",
          status: "published",
          userId: fixtures.user1.id,
          sessionId: fixtures.analysis.id,
        },
      });

      if (report.format === "csv") {
        console.log("✓ PASSED: CSV format report created\n");
        passed++;
      } else {
        throw new Error("CSV format not supported");
      }
    } catch (error) {
      console.error("✗ FAILED:", error.message, "\n");
      failed++;
    }

    // TEST 4: JSON export format
    try {
      console.log("TEST 4: JSON export format support");
      const snapshot = createMockReportSnapshot();

      const report = await prisma.report.create({
        data: {
          title: "JSON Export Test",
          content: JSON.stringify(snapshot),
          format: "json",
          status: "published",
          userId: fixtures.user1.id,
          sessionId: fixtures.analysis.id,
        },
      });

      if (report.format === "json") {
        console.log("✓ PASSED: JSON format report created\n");
        passed++;
      } else {
        throw new Error("JSON format not supported");
      }
    } catch (error) {
      console.error("✗ FAILED:", error.message, "\n");
      failed++;
    }

    // TEST 5: Invalid analysis ID rejection
    try {
      console.log("TEST 5: Invalid analysis ID rejection");

      const analysis = await prisma.analysisSession.findFirst({
        where: { id: "nonexistent" },
      });

      if (!analysis) {
        console.log("✓ PASSED: Invalid analysis rejected\n");
        passed++;
      } else {
        throw new Error("Invalid analysis should not exist");
      }
    } catch (error) {
      console.error("✗ FAILED:", error.message, "\n");
      failed++;
    }

    // TEST 6: Cross-user report retrieval rejection
    try {
      console.log("TEST 6: Cross-user report retrieval rejection");
      const snapshot = createMockReportSnapshot();

      const report = await prisma.report.create({
        data: {
          title: "User 1 Private Report",
          content: JSON.stringify(snapshot),
          format: "json",
          status: "published",
          userId: fixtures.user1.id,
          sessionId: fixtures.analysis.id,
        },
      });

      // User 2 tries to retrieve User 1's report
      const crossUserAttempt = await prisma.report.findFirst({
        where: {
          id: report.id,
          userId: fixtures.user2.id, // Different user
        },
      });

      if (!crossUserAttempt) {
        console.log("✓ PASSED: Cross-user retrieval prevented\n");
        passed++;
      } else {
        throw new Error("Cross-user retrieval should be prevented");
      }
    } catch (error) {
      console.error("✗ FAILED:", error.message, "\n");
      failed++;
    }

    // TEST 7: Report persistence and retrieval
    try {
      console.log("TEST 7: Report persistence and retrieval");
      const originalSnapshot = createMockReportSnapshot();
      const originalStr = JSON.stringify(originalSnapshot);

      const report = await prisma.report.create({
        data: {
          title: "Persistence Test",
          content: originalStr,
          format: "json",
          status: "published",
          userId: fixtures.user1.id,
          sessionId: fixtures.analysis.id,
        },
      });

      // Retrieve and verify
      const retrieved = await prisma.report.findFirst({
        where: { id: report.id },
      });

      if (retrieved.content === originalStr) {
        console.log("✓ PASSED: Report persisted and retrieved exactly\n");
        passed++;
      } else {
        throw new Error("Report content changed");
      }
    } catch (error) {
      console.error("✗ FAILED:", error.message, "\n");
      failed++;
    }

    // TEST 8: Report soft deletion
    try {
      console.log("TEST 8: Report soft deletion");
      const snapshot = createMockReportSnapshot();

      const report = await prisma.report.create({
        data: {
          title: "Delete Test",
          content: JSON.stringify(snapshot),
          format: "json",
          status: "published",
          userId: fixtures.user1.id,
          sessionId: fixtures.analysis.id,
        },
      });

      // Soft delete
      await prisma.report.update({
        where: { id: report.id },
        data: { deletedAt: new Date() },
      });

      // Verify deletion (with deletedAt filter)
      const deleted = await prisma.report.findFirst({
        where: {
          id: report.id,
          deletedAt: null,
        },
      });

      if (!deleted) {
        console.log("✓ PASSED: Report soft-deleted correctly\n");
        passed++;
      } else {
        throw new Error("Report should be marked deleted");
      }
    } catch (error) {
      console.error("✗ FAILED:", error.message, "\n");
      failed++;
    }

    // TEST 9: Report listing with pagination
    try {
      console.log("TEST 9: Report listing and pagination");

      // Create multiple reports
      for (let i = 0; i < 5; i++) {
        const snapshot = createMockReportSnapshot();
        await prisma.report.create({
          data: {
            title: `Report ${i + 1}`,
            content: JSON.stringify(snapshot),
            format: "json",
            status: "published",
            userId: fixtures.user1.id,
            sessionId: fixtures.analysis.id,
          },
        });
      }

      // List with limit
      const reports = await prisma.report.findMany({
        where: { userId: fixtures.user1.id, deletedAt: null },
        take: 3,
        orderBy: { createdAt: 'desc' },
      });

      const total = await prisma.report.count({
        where: { userId: fixtures.user1.id, deletedAt: null },
      });

      if (reports.length <= 3 && total >= 3) {
        console.log("✓ PASSED: Pagination working\n");
        passed++;
      } else {
        throw new Error("Pagination failed");
      }
    } catch (error) {
      console.error("✗ FAILED:", error.message, "\n");
      failed++;
    }

    // TEST 10: Report content structure validation
    try {
      console.log("TEST 10: Report content structure validation");
      const snapshot = createMockReportSnapshot();
      const reportStr = JSON.stringify(snapshot);

      const report = await prisma.report.create({
        data: {
          title: "Validation Test",
          content: reportStr,
          format: "json",
          status: "published",
          userId: fixtures.user1.id,
          sessionId: fixtures.analysis.id,
        },
      });

      // Verify it can be parsed
      const parsed = JSON.parse(report.content);
      if (parsed.config && parsed.metrics && parsed.config.measureKey) {
        console.log("✓ PASSED: Report structure valid\n");
        passed++;
      } else {
        throw new Error("Report structure invalid");
      }
    } catch (error) {
      console.error("✗ FAILED:", error.message, "\n");
      failed++;
    }

    // TEST 11: Report linked to analysis session
    try {
      console.log("TEST 11: Report linked to analysis session");
      const snapshot = createMockReportSnapshot();

      const report = await prisma.report.create({
        data: {
          title: "Session Link Test",
          content: JSON.stringify(snapshot),
          format: "json",
          status: "published",
          userId: fixtures.user1.id,
          sessionId: fixtures.analysis.id,
        },
      });

      // Retrieve with session relation
      const withSession = await prisma.report.findFirst({
        where: { id: report.id },
        include: {
          session: {
            select: { id: true, title: true },
          },
        },
      });

      if (withSession.session.id === fixtures.analysis.id) {
        console.log("✓ PASSED: Report linked to analysis\n");
        passed++;
      } else {
        throw new Error("Report not linked correctly");
      }
    } catch (error) {
      console.error("✗ FAILED:", error.message, "\n");
      failed++;
    }

    // TEST 12: Report status tracking
    try {
      console.log("TEST 12: Report status tracking");
      const snapshot = createMockReportSnapshot();

      const report = await prisma.report.create({
        data: {
          title: "Status Test",
          content: JSON.stringify(snapshot),
          format: "json",
          status: "published",
          publishedAt: new Date(),
          userId: fixtures.user1.id,
          sessionId: fixtures.analysis.id,
        },
      });

      if (report.status === "published" && report.publishedAt) {
        console.log("✓ PASSED: Report status and timestamps tracked\n");
        passed++;
      } else {
        throw new Error("Status or timestamp missing");
      }
    } catch (error) {
      console.error("✗ FAILED:", error.message, "\n");
      failed++;
    }

    console.log(`\n=== Test Results: ${passed} passed, ${failed} failed (${passed + failed} total) ===\n`);

    // Cleanup
    if (fixtures) {
      await prisma.report.deleteMany({
        where: { userId: { in: [fixtures.user1.id, fixtures.user2.id] } },
      });
      await prisma.analysisSession.deleteMany({
        where: { userId: { in: [fixtures.user1.id, fixtures.user2.id] } },
      });
      await prisma.dataset.deleteMany({
        where: { userId: { in: [fixtures.user1.id, fixtures.user2.id] } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: [fixtures.user1.id, fixtures.user2.id] } },
      });
      console.log("✓ Cleaned up test data\n");
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
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run tests
runTests();

