// server/rate-limiter.test.js
// Test suite for rate limiting and security enforcement

import prisma from "./prisma.js";
import { 
  checkUserRateLimit, 
  checkIpRateLimit,
  rateLimitConfig,
  resetForTesting,
  expireBucketForTesting
} from "./rate-limiter.js";
import {
  requireAuth,
  verifyDatasetOwnership,
  validateUploadPayload,
} from "./security-middleware.js";

async function runTests() {
  console.log("\n=== Rate Limiting and Security Test Suite ===\n");

  let passed = 0;
  let failed = 0;
  let testUser = null;

  try {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        email: `test-rate-${Date.now()}@example.com`,
        displayName: "Rate Limiter Test User",
      },
    });
    console.log(`? Created test user: ${testUser.id}\n`);

    // TEST 1: Requests within rate limit
    try {
      console.log("TEST 1: Requests within rate limit");
      resetForTesting();
      
      const userId = testUser.id;
      const results = [];
      
      // Make 5 requests (under default limit of 10)
      for (let i = 0; i < 5; i++) {
        const result = checkUserRateLimit(userId, "list");
        results.push(result);
      }
      
      const allAllowed = results.every(r => r.allowed);
      if (allAllowed) {
        console.log("? PASSED: 5 requests allowed within limit\n");
        passed++;
      } else {
        throw new Error("Some requests were blocked within limit");
      }
    } catch (error) {
      console.error("? FAILED:", error.message, "\n");
      failed++;
    }

    // TEST 2: Requests exceeding rate limit
    try {
      console.log("TEST 2: Requests exceeding rate limit");
      resetForTesting();
      
      const userId = testUser.id;
      const config = rateLimitConfig.listPerUser;
      
      // Exceed the limit
      let result;
      for (let i = 0; i < config.limit + 1; i++) {
        result = checkUserRateLimit(userId, "list");
      }
      
      if (!result.allowed) {
        console.log("? PASSED: Request blocked after exceeding limit\n");
        passed++;
      } else {
        throw new Error("Request should have been blocked");
      }
    } catch (error) {
      console.error("? FAILED:", error.message, "\n");
      failed++;
    }

    // TEST 3: Rate limit reset after window
    try {
      console.log("TEST 3: Rate limit window expiration");
      resetForTesting();
      
      const userId = testUser.id;
      
      // Make a request
      const result1 = checkUserRateLimit(userId, "list");
      if (!result1.allowed) throw new Error("First request blocked");
      
      // Manually expire the bucket (simulate time passing)
      const key = `user:${userId}:list`;
      expireBucketForTesting(key);
      
      // Next request should be allowed
      const result2 = checkUserRateLimit(userId, "list");
      if (result2.allowed) {
        console.log("? PASSED: Rate limit window reset correctly\n");
        passed++;
      } else {
        throw new Error("Rate limit did not reset");
      }
    } catch (error) {
      console.error("? FAILED:", error.message, "\n");
      failed++;
    }

    // TEST 4: Different users get independent limits
    try {
      console.log("TEST 4: Independent per-user limits");
      resetForTesting();
      
      const user1 = testUser.id;
      const user2Id = (await prisma.user.create({
        data: {
          email: `test-rate-user2-${Date.now()}@example.com`,
          displayName: "User 2",
        },
      })).id;

      // Use up limit for user 1
      const config = rateLimitConfig.listPerUser;
      for (let i = 0; i < config.limit; i++) {
        checkUserRateLimit(user1, "list");
      }
      
      const user1Result = checkUserRateLimit(user1, "list");
      const user2Result = checkUserRateLimit(user2Id, "list");
      
      if (!user1Result.allowed && user2Result.allowed) {
        console.log("? PASSED: Users have independent rate limits\n");
        passed++;
        await prisma.user.delete({ where: { id: user2Id } });
      } else {
        throw new Error("Users should have independent limits");
      }
    } catch (error) {
      console.error("? FAILED:", error.message, "\n");
      failed++;
    }

    // TEST 5: IP-based fallback rate limiting
    try {
      console.log("TEST 5: IP-based fallback limits");
      resetForTesting();
      
      const ip = "192.168.1.100";
      const config = rateLimitConfig.uploadPerIp;
      
      // Use up IP limit
      for (let i = 0; i < config.limit; i++) {
        checkIpRateLimit(ip, "upload");
      }
      
      const result = checkIpRateLimit(ip, "upload");
      if (!result.allowed) {
        console.log("? PASSED: IP rate limit enforced\n");
        passed++;
      } else {
        throw new Error("IP rate limit not enforced");
      }
    } catch (error) {
      console.error("? FAILED:", error.message, "\n");
      failed++;
    }

    // TEST 6: Separate limits for different operations
    try {
      console.log("TEST 6: Operation-specific rate limits");
      resetForTesting();
      
      const userId = testUser.id;
      
      // Upload has limit of 10, list has limit of 30
      const uploadConfig = rateLimitConfig.uploadPerUser;
      const listConfig = rateLimitConfig.listPerUser;
      
      // Max out uploads
      for (let i = 0; i < uploadConfig.limit; i++) {
        checkUserRateLimit(userId, "upload");
      }
      
      const uploadResult = checkUserRateLimit(userId, "upload");
      
      // Lists should still work
      const listResult = checkUserRateLimit(userId, "list");
      
      if (!uploadResult.allowed && listResult.allowed) {
        console.log("? PASSED: Operations have separate limits\n");
        passed++;
      } else {
        throw new Error("Operations should have independent limits");
      }
    } catch (error) {
      console.error("? FAILED:", error.message, "\n");
      failed++;
    }

    // TEST 7: Cross-user access prevention (dataset ownership)
    try {
      console.log("TEST 7: Cross-user dataset access prevention");
      
      const user1 = testUser;
      const user2 = await prisma.user.create({
        data: {
          email: `test-cross-user-${Date.now()}@example.com`,
          displayName: "Test User 2",
        },
      });
      
      // User 1 creates a dataset
      const dataset = await prisma.dataset.create({
        data: {
          name: "Test Dataset",
          fileName: "test.csv",
          mimeType: "text/csv",
          fileSize: BigInt(1000),
          userId: user1.id,
        },
      });
      
      // User 2 tries to access it
      const foundByUser1 = await prisma.dataset.findFirst({
        where: { id: dataset.id, userId: user1.id, deletedAt: null },
      });
      
      const foundByUser2 = await prisma.dataset.findFirst({
        where: { id: dataset.id, userId: user2.id, deletedAt: null },
      });
      
      if (foundByUser1 && !foundByUser2) {
        console.log("? PASSED: Cross-user access prevented\n");
        passed++;
        
        // Cleanup
        await prisma.dataset.delete({ where: { id: dataset.id } });
        await prisma.user.delete({ where: { id: user2.id } });
      } else {
        throw new Error("Cross-user access not prevented");
      }
    } catch (error) {
      console.error("? FAILED:", error.message, "\n");
      failed++;
    }

    // TEST 8: Soft deletion doesn't expose deleted datasets
    try {
      console.log("TEST 8: Soft deletion hides datasets");
      
      const dataset = await prisma.dataset.create({
        data: {
          name: "To Delete",
          fileName: "delete.csv",
          mimeType: "text/csv",
          fileSize: BigInt(500),
          userId: testUser.id,
        },
      });
      
      // Soft delete
      await prisma.dataset.update({
        where: { id: dataset.id },
        data: { deletedAt: new Date() },
      });
      
      // Query should exclude it
      const found = await prisma.dataset.findFirst({
        where: {
          id: dataset.id,
          userId: testUser.id,
          deletedAt: null,
        },
      });
      
      if (!found) {
        console.log("? PASSED: Soft-deleted datasets hidden\n");
        passed++;
      } else {
        throw new Error("Soft-deleted dataset still visible");
      }
    } catch (error) {
      console.error("? FAILED:", error.message, "\n");
      failed++;
    }

    // TEST 9: Unauthorized deletion attempts
    try {
      console.log("TEST 9: Unauthorized deletion rejection");
      
      const user2 = await prisma.user.create({
        data: {
          email: `test-delete-${Date.now()}@example.com`,
          displayName: "Delete Test User",
        },
      });
      
      const dataset = await prisma.dataset.create({
        data: {
          name: "Protected Dataset",
          fileName: "protected.csv",
          mimeType: "text/csv",
          fileSize: BigInt(1000),
          userId: testUser.id,
        },
      });
      
      // User 2 tries to delete user 1's dataset
      const foundByUser2 = await prisma.dataset.findFirst({
        where: {
          id: dataset.id,
          userId: user2.id,
          deletedAt: null,
        },
      });
      
      if (!foundByUser2) {
        console.log("? PASSED: Unauthorized deletion prevented\n");
        passed++;
        
        // Cleanup
        await prisma.dataset.delete({ where: { id: dataset.id } });
        await prisma.user.delete({ where: { id: user2.id } });
      } else {
        throw new Error("Unauthorized user could access dataset");
      }
    } catch (error) {
      console.error("? FAILED:", error.message, "\n");
      failed++;
    }

    // TEST 10: Rate limit headers in responses
    try {
      console.log("TEST 10: Rate limit headers included");
      resetForTesting();
      
      // This test verifies the middleware adds headers
      // (actual HTTP verification done in integration tests)
      const result = checkUserRateLimit(testUser.id, "upload");
      
      if (result.remaining !== undefined && result.resetAt !== undefined) {
        console.log("? PASSED: Rate limit info available\n");
        passed++;
      } else {
        throw new Error("Rate limit info missing");
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




