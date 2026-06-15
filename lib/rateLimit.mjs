/**
 * Pure, dependency-free sliding-window rate limiter.
 *
 * Edge-runtime safe: relies only on `Map` and `Date.now()`. State is held in a
 * module-level Map (per-instance) and self-prunes stale keys so memory stays
 * bounded. For a multi-instance production deployment, back this with a shared
 * store (Redis / Upstash) instead.
 */

const DEFAULT_MAX = 20;
const DEFAULT_WINDOW_MS = 60_000;

// Drop a key once its newest hit is older than this, to bound memory growth.
const STALE_AFTER_MS = 10 * 60_000;

// key -> array of hit timestamps (ms) that fall within the live window
const store = new Map();
let lastSweep = 0;

function sweep(now, windowMs) {
  // Sweep at most once per window — cheap amortised cleanup.
  if (now - lastSweep < windowMs) return;
  lastSweep = now;
  for (const [key, hits] of store) {
    if (hits.length === 0 || hits[hits.length - 1] <= now - STALE_AFTER_MS) {
      store.delete(key);
    }
  }
}

/**
 * Record a hit for `key` and return the limiter decision.
 *
 * @param {string} key - client identifier (e.g. IP address)
 * @param {{ max?: number, windowMs?: number, now?: number }} [opts]
 * @returns {{ limited: boolean, limit: number, remaining: number, reset: number, retryAfter: number }}
 *   `reset` is an epoch-ms timestamp; `retryAfter` is whole seconds.
 */
export function rateLimit(key, opts = {}) {
  const max = opts.max ?? DEFAULT_MAX;
  const windowMs = opts.windowMs ?? DEFAULT_WINDOW_MS;
  const now = opts.now ?? Date.now();
  const windowStart = now - windowMs;

  const recent = (store.get(key) || []).filter((ts) => ts > windowStart);

  if (recent.length >= max) {
    store.set(key, recent);
    const reset = recent[0] + windowMs;
    return {
      limited: true,
      limit: max,
      remaining: 0,
      reset,
      retryAfter: Math.max(Math.ceil((reset - now) / 1000), 1),
    };
  }

  recent.push(now);
  store.set(key, recent);
  sweep(now, windowMs);

  return {
    limited: false,
    limit: max,
    remaining: max - recent.length,
    reset: now + windowMs,
    retryAfter: 0,
  };
}

/** Clear all limiter state. Intended for tests. */
export function __resetStore() {
  store.clear();
  lastSweep = 0;
}
