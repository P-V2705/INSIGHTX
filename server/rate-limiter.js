// server/rate-limiter.js
// Modular rate limiting for dataset operations
// Uses in-memory store for zero-cost local development
// Designed to work with Redis backend (future enhancement)

/**
 * In-memory rate limiter store
 * Key: "${userId}:${operation}" or "${ip}:${operation}"
 * Value: { count: number, resetAt: timestamp }
 */
class RateLimiter {
  constructor() {
    this.buckets = new Map();
    this.cleanup();
  }

  /**
   * Cleanup old buckets every 10 minutes
   */
  cleanup() {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, bucket] of this.buckets) {
        if (bucket.resetAt <= now) {
          this.buckets.delete(key);
        }
      }
    }, 10 * 60 * 1000);
    this.cleanupInterval.unref();
  }

  /**
   * Check if request is within rate limit
   * Returns: { allowed: boolean, remaining: number, resetAt: timestamp }
   */
  check(key, limit, windowMs) {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    // Create new bucket if expired or doesn't exist
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      this.buckets.set(key, bucket);
    }

    const allowed = bucket.count < limit;
    const remaining = Math.max(0, limit - bucket.count - 1);

    if (allowed) {
      bucket.count += 1;
    }

    return {
      allowed,
      remaining,
      resetAt: bucket.resetAt,
      retryAfter: bucket.resetAt - now,
    };
  }

  /**
   * Reset bucket for testing
   */
  reset(key) {
    this.buckets.delete(key);
  }

  /**
   * Destroy and cleanup
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.buckets.clear();
  }
}

/**
 * Singleton instance
 */
const limiter = new RateLimiter();

/**
 * Rate limit configuration
 * Configurable via environment variables with sensible defaults
 */
export const rateLimitConfig = {
  // Authenticated user limits per operation
  uploadPerUser: {
    limit: parseInt(process.env.RATE_LIMIT_UPLOAD_PER_USER || '10', 10),
    windowMs: parseInt(process.env.RATE_LIMIT_UPLOAD_WINDOW_MS || '3600000', 10), // 1 hour
  },
  listPerUser: {
    limit: parseInt(process.env.RATE_LIMIT_LIST_PER_USER || '30', 10),
    windowMs: parseInt(process.env.RATE_LIMIT_LIST_WINDOW_MS || '60000', 10), // 1 minute
  },
  readPerUser: {
    limit: parseInt(process.env.RATE_LIMIT_READ_PER_USER || '60', 10),
    windowMs: parseInt(process.env.RATE_LIMIT_READ_WINDOW_MS || '60000', 10), // 1 minute
  },
  deletePerUser: {
    limit: parseInt(process.env.RATE_LIMIT_DELETE_PER_USER || '5', 10),
    windowMs: parseInt(process.env.RATE_LIMIT_DELETE_WINDOW_MS || '3600000', 10), // 1 hour
  },

  // IP-based fallback limits (for unauthenticated or failed auth)
  uploadPerIp: {
    limit: parseInt(process.env.RATE_LIMIT_UPLOAD_PER_IP || '5', 10),
    windowMs: parseInt(process.env.RATE_LIMIT_UPLOAD_IP_WINDOW_MS || '3600000', 10), // 1 hour
  },
  apiPerIp: {
    limit: parseInt(process.env.RATE_LIMIT_API_PER_IP || '100', 10),
    windowMs: parseInt(process.env.RATE_LIMIT_API_IP_WINDOW_MS || '60000', 10), // 1 minute
  },
};

/**
 * Get rate limit key for a user operation
 */
function getUserKey(userId, operation) {
  return `user:${userId}:${operation}`;
}

/**
 * Get rate limit key for an IP operation
 */
function getIpKey(ip, operation) {
  return `ip:${ip}:${operation}`;
}

/**
 * Check if user is rate limited
 */
export function checkUserRateLimit(userId, operation) {
  const config = rateLimitConfig[`${operation}PerUser`];
  if (!config) {
    throw new Error(`Unknown operation: ${operation}`);
  }
  const key = getUserKey(userId, operation);
  return limiter.check(key, config.limit, config.windowMs);
}

/**
 * Check if IP is rate limited (fallback for unauthenticated)
 */
export function checkIpRateLimit(ip, operation) {
  const operationKey = operation === 'upload' ? 'upload' : 'api';
  const config = rateLimitConfig[`${operationKey}PerIp`];
  if (!config) {
    throw new Error(`Unknown operation: ${operation}`);
  }
  const key = getIpKey(ip, operationKey);
  return limiter.check(key, config.limit, config.windowMs);
}

/**
 * Express middleware for rate limiting dataset uploads
 */
export function rateLimitUpload() {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';

    // Try to use authenticated user first
    const session = require("./session.js").readSession(req);
    if (session) {
      const userId = session.record.user.id;
      const result = checkUserRateLimit(userId, 'upload');

      res.setHeader('X-RateLimit-Limit', rateLimitConfig.uploadPerUser.limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', result.resetAt);

      if (!result.allowed) {
        return res.status(429).json({
          error: 'Too many upload requests. Please try again later.',
          retryAfter: Math.ceil(result.retryAfter / 1000),
          resetAt: new Date(result.resetAt).toISOString(),
        });
      }
    } else {
      // Fallback to IP-based limit
      const result = checkIpRateLimit(ip, 'upload');

      res.setHeader('X-RateLimit-Limit', rateLimitConfig.uploadPerIp.limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', result.resetAt);

      if (!result.allowed) {
        return res.status(429).json({
          error: 'Too many upload requests from this IP. Please try again later.',
          retryAfter: Math.ceil(result.retryAfter / 1000),
        });
      }
    }

    next();
  };
}

/**
 * Express middleware for rate limiting dataset API calls
 */
export function rateLimitApi(operation = 'list') {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';

    // Try to use authenticated user first
    const session = require("./session.js").readSession(req);
    if (session) {
      const userId = session.record.user.id;
      const result = checkUserRateLimit(userId, operation);

      const config = rateLimitConfig[`${operation}PerUser`];
      res.setHeader('X-RateLimit-Limit', config.limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', result.resetAt);

      if (!result.allowed) {
        return res.status(429).json({
          error: `Too many ${operation} requests. Please try again later.`,
          retryAfter: Math.ceil(result.retryAfter / 1000),
          resetAt: new Date(result.resetAt).toISOString(),
        });
      }
    } else {
      // Fallback to IP-based limit
      const result = checkIpRateLimit(ip, 'api');

      res.setHeader('X-RateLimit-Limit', rateLimitConfig.apiPerIp.limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', result.resetAt);

      if (!result.allowed) {
        return res.status(429).json({
          error: 'Too many requests from this IP. Please try again later.',
          retryAfter: Math.ceil(result.retryAfter / 1000),
        });
      }
    }

    next();
  };
}

/**
 * Testing utility to reset rate limiter
 */

/**
 * Testing utility to expire a specific bucket (simulate time passing)
 */
export function expireBucketForTesting(key) {
  const bucket = limiter.buckets.get(key);
  if (bucket) {
    bucket.resetAt = Date.now() - 1000;
  }
}

export function resetForTesting() {
  limiter.buckets.clear();
}

export default limiter;

