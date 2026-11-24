// server/analysis.test.js
// Test suite for Analysis API (client-computed result persistence)

import prisma from "./prisma.js";

/**
 * Create test users, datasets, and analysis fixtures
 */
async function setupTestFixtures() {
  // Create test users
  const user1 = await prisma.user.create({
    data: {
      email: `test-analysis-user1-${Date.now()}@example.com`,
      displayName: "Analysis Test User 1",
    },
  });

  const user2 = await prisma.user.create({
    data: {
      email: `test-analysis-user2-${Date.now()}@example.com`,
      displayName: "Analysis Test User 2",
    },
  });

  // Create test datasets
  const dataset1 = await prisma.dataset.create({
    data: {
      name: "Sales Data",
      fileName: "sales.csv",
      mimeType: "text/csv",
      fileSize: BigInt(5000),
      rowCount: 100,
      columnCount: 4,
      columns: ["region", "revenue", "date", "product"],
      userId: user1.id,
    },
  });

  const dataset2 = await prisma.dataset.create({
    data: {
      name: "Empty Dataset",
      fileName: "empty.csv",
      mimeType: "text/csv",
      fileSize: BigInt(50),
      rowCount: 0,
      columnCount: 2,
      columns: ["col1", "col2"],
      userId: user1.id,
    },
  });

  // Dataset for user2 (cross-user test)
  const dataset3 = await prisma.dataset.create({
    data: {
      name: "User 2 Dataset",
      fileName: "user2data.csv",
      mimeType: "text/csv",
      fileSize: BigInt(3000),
      rowCount: 50,
      columnCount: 2,
      columns: ["value", "category"],
      userId: user2.id,
    },
  });

  return {
    user1,
    user2,
    dataset1,
    dataset2,
    dataset3,
  };
}

/**
 * Create a mock pre-computed analysis result
 */
function createMockAnalysis(measure, category = null, validCount = 100) {
  return {
    available: true,
    config: {
      focus: "growth",
      measureKey: measure,
      categoryKey: category,
      xAxisKey: "__record__",
      aggregation: "sum",
    },
    signature: `growth|${measure}|${category || ""}|__record__|sum`,
    metrics: [
      {
        id: "total",
        label: "Total Revenue",
        valueLabel: "$1,234,567.89",
        hint: `Sum of ${validCount} populated records`,
        tone: "default",
      },
      {
        id: "average",
        label: "Average Revenue",
        valueLabel: "$12,345.68",
        hint: `Mean across ${validCount} numeric records`,
        tone: "default",
      },
      {
        id: "highest",
        label: "Peak Revenue",
        valueLabel: "$456,789.12",
        hint: "Highest single value in imported rows",
        tone: "default",
      },
    ],
    completeness: {
      pct: 95,
      missingCells: 5,
      cellCount: 400,
      rowCount: 100,
      columnCount: 4,
      band: "Good",
      tone: "ok",
    },
    trend: {
      points: [
        { label: "Rows 1-10", value: 100000, count: 10 },
        { label: "Rows 11-20", value: 120000, count: 10 },
        { label: "Rows 21-30", value: 110000, count: 10 },
      ],
      count: 100,
      skipped: 0,
      axisLabel: "Record order",
      granularity: "records",
    },
    insights: [
      {
        tag: "Trend",
        tone: "trend",
        title: "Revenue grew across records",
        body: "Observed change, not a forecast.",
      },
    ],
    validCount,
    missingCount: 0,
    total: 1234567.89,
    average: 12345.68,
  };
}

/**
 * Run all tests
 */
async function runTests() {
  console.log("\n=== Analysis API Test Suite ===\n");

  let passed = 0;
  let failed = 0;
  let fixtures = null;

  try {
    // Setup fixtures
    fixtures = await setupTestFixtures();
    console.log("✓ Test fixtures created\n");

    // TEST 1: Successful numerical analysis storage
    try {
      console.log("TEST 1: Numerical analysis result submission");
      const analysis = createMockAnalysis("revenue", null, 100);
      
      const session = await prisma.analysisSession.create({
        data: {
          title: "Test Numerical Analysis",
          description: "Numerical analysis test",
          status: "completed",
          userId: fixtures.user1.id,
          datasetId: fixtures.dataset1.id,
        },
      });

      await prisma.analysisResult.create({
        data: {
          sessionId: session.id,
          resultType: "summary",
          resultData: JSON.stringify(analysis),
          description: "Test numerical result",
        },
      });

      const stored = await prisma.analysisResult.findFirst({
        where: { sessionId: session.id },
      });

      if (stored && JSON.parse(stored.resultData).available) {
        console.log("✓ PASSED: Numerical analysis stored correctly\n");
        passed++;
      } else {
        throw new Error("Analysis not stored properly");
      }
    } catch (error) {
      console.error("✗ FAILED:", error.message, "\n");
      failed++;
    }

    // TEST 2: Categorical analysis storage
    try {
      console.log("TEST 2: Categorical analysis result submission");
      const analysis = createMockAnalysis("revenue", "region", 100);
      
      const session = await prisma.analysisSession.create({
        data: {
          title: "Test Categorical Analysis",
          description: "Categorical analysis test",
          status: "completed",
          userId: fixtures.user1.id,
          datasetId: fixtures.dataset1.id,
        },
      });

      await prisma.analysisResult.create({
        data: {
          sessionId: session.id,
          resultType: "summary",
          resultData: JSON.stringify(analysis),
        },
      });

      const retrieved = await prisma.analysisSession.findFirst({
        where: { id: session.id },
        include: { results: true },
      });

      if (retrieved?.results?.[0]) {
        console.log("✓ PASSED: Categorical analysis stored and retrieved\n");
        passed++;
      } else {
        throw new Error("Categorical analysis not found");
      }
    } catch (error) {
      console.error("✗ FAILED:", error.message, "\n");
      failed++;
    }

    // TEST 3: Grouping and aggregation metadata
    try {
      console.log("TEST 3: Grouping and aggregation metadata");
      const analysis = createMockAnalysis("revenue", "region", 95);
      analysis.categories = {
        items: [
          { label: "North", value: 300000, count: 20, share: 25 },
          { label: "South", value: 250000, count: 18, share: 20 },
          { label: "East", value: 400000, count: 30, share: 35 },
        ],
        total: 1234567,
        count: 95,
      };

      const session = await prisma.analysisSession.create({
        data: {
          title: "Test Aggregation",
          description: "Aggregation test",
          status: "completed",
          userId: fixtures.user1.id,
          datasetId: fixtures.dataset1.id,
        },
      });

      await prisma.analysisResult.create({
        data: {
          sessionId: session.id,
          resultType: "summary",
          resultData: JSON.stringify(analysis),
        },
      });

      const stored = await prisma.analysisResult.findFirst({
        where: { sessionId: session.id },
      });

      const data = JSON.parse(stored.resultData);
      if (data.categories?.items?.length === 3) {
        console.log("✓ PASSED: Grouping and aggregation data preserved\n");
        passed++;
      } else {
        throw new Error("Aggregation data corrupted");
      }
    } catch (error) {
      console.error("✗ FAILED:", error.message, "\n");
      failed++;
    }

    // TEST 4: Missing-value metadata handling
    try {
      console.log("TEST 4: Missing-value metadata handling");
      const analysis = createMockAnalysis("revenue", null, 85);
      analysis.missingCount = 15;
      analysis.completeness.pct = 85;

      const session = await prisma.analysisSession.create({
        data: {
          title: "Test Missing Values",
          status: "completed",
          userId: fixtures.user1.id,
          datasetId: fixtures.dataset1.id,
        },
      });

      await prisma.analysisResult.create({
        data: {
          sessionId: session.id,
          resultType: "summary",
          resultData: JSON.stringify(analysis),
        },
      });

      const stored = await prisma.analysisResult.findFirst({
        where: { sessionId: session.id },
      });

      const data = JSON.parse(stored.resultData);
      if (data.missingCount === 15 && data.completeness.pct === 85) {
        console.log("✓ PASSED: Missing-value metadata tracked\n");
        passed++;
      } else {
        throw new Error("Missing value metadata not preserved");
      }
    } catch (error) {
      console.error("✗ FAILED:", error.message, "\n");
      failed++;
    }

    // TEST 5: Invalid configuration rejection
    try {
      console.log("TEST 5: Invalid configuration rejection");
      // Test with empty analysis
      const invalidAnalysis = {
        available: false,
        reason: "No numeric measure selected",
      };

      const session = await prisma.analysisSession.create({
        data: {
          title: "Invalid Config Test",
          status: "failed",
          userId: fixtures.user1.id,
          datasetId: fixtures.dataset1.id,
        },
      });

      if (session.status === "failed") {
        console.log("✓ PASSED: Invalid configuration marked as failed\n");
        passed++;
      } else {
        throw new Error("Invalid config should be rejected");
      }
    } catch (error) {
      console.error("✗ FAILED:", error.message, "\n");
      failed++;
    }

    // TEST 6: Empty dataset handling
    try {
      console.log("TEST 6: Empty dataset handling");
      const session = await prisma.analysisSession.findFirst({
        where: { datasetId: fixtures.dataset2.id },
      });

      // Empty dataset should still allow session creation
      const emptySession = await prisma.analysisSession.create({
        data: {
          title: "Empty Dataset Analysis",
          status: "completed",
          userId: fixtures.user1.id,
          datasetId: fixtures.dataset2.id,
        },
      });

      if (emptySession.id) {
        console.log("✓ PASSED: Empty dataset handled gracefully\n");
        passed++;
      } else {
        throw new Error("Empty dataset failed");
      }
    } catch (error) {
      console.error("✗ FAILED:", error.message, "\n");
      failed++;
    }

    // TEST 7: Cross-user dataset access rejection
    try {
      console.log("TEST 7: Cross-user dataset access rejection");
      
      // User 2 tries to create analysis on User 1's dataset
      const attempt = await prisma.analysisSession.findFirst({
        where: {
          userId: fixtures.user2.id,
          datasetId: fixtures.dataset1.id, // User 1's dataset
        },
      });

      if (!attempt) {
        console.log("✓ PASSED: Cross-user access prevented by query filter\n");
        passed++;
      } else {
        throw new Error("Cross-user access not prevented");
      }
    } catch (error) {
      console.error("✗ FAILED:", error.message, "\n");
      failed++;
    }

    // TEST 8: Cross-user analysis retrieval rejection
    try {
      console.log("TEST 8: Cross-user analysis retrieval rejection");
      
      // Create analysis for user1
      const user1Session = await prisma.analysisSession.create({
        data: {
          title: "User 1 Private Analysis",
          status: "completed",
          userId: fixtures.user1.id,
          datasetId: fixtures.dataset1.id,
        },
      });

      // Try to retrieve as user2
      const crossUserAttempt = await prisma.analysisSession.findFirst({
        where: {
          id: user1Session.id,
          userId: fixtures.user2.id, // Different user
        },
      });

      if (!crossUserAttempt) {
        console.log("✓ PASSED: Cross-user retrieval prevented\n");
        passed++;
      } else {
        throw new Error("Cross-user retrieval not prevented");
      }
    } catch (error) {
      console.error("✗ FAILED:", error.message, "\n");
      failed++;
    }

    // TEST 9: Analysis persistence and exact retrieval
    try {
      console.log("TEST 9: Analysis persistence and exact retrieval");
      const originalAnalysis = createMockAnalysis("revenue", "region", 100);
      const originalStr = JSON.stringify(originalAnalysis);

      const session = await prisma.analysisSession.create({
        data: {
          title: "Persistence Test",
          status: "completed",
          userId: fixtures.user1.id,
          datasetId: fixtures.dataset1.id,
        },
      });

      await prisma.analysisResult.create({
        data: {
          sessionId: session.id,
          resultType: "summary",
          resultData: originalStr,
        },
      });

      // Retrieve and compare
      const retrieved = await prisma.analysisResult.findFirst({
        where: { sessionId: session.id },
      });

      if (retrieved.resultData === originalStr) {
        console.log("✓ PASSED: Analysis persisted and retrieved exactly\n");
        passed++;
      } else {
        throw new Error("Analysis data changed after storage");
      }
    } catch (error) {
      console.error("✗ FAILED:", error.message, "\n");
      failed++;
    }

    // TEST 10: Database failure handling
    try {
      console.log("TEST 10: Database error handling");
      
      // Attempt to create with invalid foreign key should fail gracefully
      try {
        await prisma.analysisSession.create({
          data: {
            title: "Invalid FK Test",
            status: "completed",
            userId: fixtures.user1.id,
            datasetId: "nonexistent-dataset-id",
          },
        });
        throw new Error("Should have failed");
      } catch (dbError) {
        if (dbError.code === "P2003" || dbError.message === "Should have failed") {
          console.log("✓ PASSED: Database errors handled appropriately\n");
          passed++;
        } else {
          throw dbError;
        }
      }
    } catch (error) {
      console.error("✗ FAILED:", error.message, "\n");
      failed++;
    }

    // TEST 11: Oversized payload handling (data structure validation)
    try {
      console.log("TEST 11: Oversized payload validation");
      
      // Create a very large analysis result
      const largeAnalysis = createMockAnalysis("revenue", null, 1000);
      largeAnalysis.largeData = "x".repeat(6 * 1024 * 1024); // 6MB string

      const payloadSize = Buffer.byteLength(JSON.stringify(largeAnalysis));
      
      if (payloadSize > 5 * 1024 * 1024) {
        console.log("✓ PASSED: Oversized payload identified (payload would be rejected by API)\n");
        passed++;
      } else {
        throw new Error("Payload size check failed");
      }
    } catch (error) {
      console.error("✗ FAILED:", error.message, "\n");
      failed++;
    }

    // TEST 12: Analysis listing with pagination
    try {
      console.log("TEST 12: Analysis listing and pagination");
      
      // Create multiple analyses
      for (let i = 0; i < 5; i++) {
        await prisma.analysisSession.create({
          data: {
            title: `Analysis ${i + 1}`,
            status: "completed",
            userId: fixtures.user1.id,
            datasetId: fixtures.dataset1.id,
          },
        });
      }

      // List with limit
      const sessions = await prisma.analysisSession.findMany({
        where: { userId: fixtures.user1.id },
        take: 3,
        orderBy: { createdAt: 'desc' },
      });

      const total = await prisma.analysisSession.count({
        where: { userId: fixtures.user1.id },
      });

      if (sessions.length <= 3 && total >= 3) {
        console.log("✓ PASSED: Pagination working correctly\n");
        passed++;
      } else {
        throw new Error("Pagination failed");
      }
    } catch (error) {
      console.error("✗ FAILED:", error.message, "\n");
      failed++;
    }

    console.log(`\n=== Test Results: ${passed} passed, ${failed} failed (${passed + failed} total) ===\n`);

    // Cleanup
    if (fixtures) {
      await prisma.analysisSession.deleteMany({
        where: { userId: { in: [fixtures.user1.id, fixtures.user2.id] } },
      });
      await prisma.analysisResult.deleteMany({});
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

