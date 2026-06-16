import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { rateLimit, __resetStore } from "./rateLimit.mjs";

beforeEach(() => __resetStore());

test("allows requests below the limit and counts down remaining", () => {
  const opts = { max: 3, windowMs: 1000, now: 1000 };
  assert.equal(rateLimit("a", opts).remaining, 2);
  assert.equal(rateLimit("a", opts).remaining, 1);
  const third = rateLimit("a", opts);
  assert.equal(third.limited, false);
  assert.equal(third.remaining, 0);
});

test("blocks the request that exceeds the limit", () => {
  const opts = { max: 2, windowMs: 1000, now: 1000 };
  rateLimit("a", opts);
  rateLimit("a", opts);
  const blocked = rateLimit("a", opts);
  assert.equal(blocked.limited, true);
  assert.equal(blocked.remaining, 0);
  assert.ok(blocked.retryAfter >= 1);
});

test("keys are isolated from one another", () => {
  const opts = { max: 1, windowMs: 1000, now: 1000 };
  assert.equal(rateLimit("a", opts).limited, false);
  assert.equal(rateLimit("b", opts).limited, false);
  assert.equal(rateLimit("a", opts).limited, true);
});

test("hits outside the window no longer count", () => {
  const max = 1;
  const windowMs = 1000;
  assert.equal(rateLimit("a", { max, windowMs, now: 1000 }).limited, false);
  // Same instant: limited.
  assert.equal(rateLimit("a", { max, windowMs, now: 1000 }).limited, true);
  // After the window has fully elapsed: allowed again.
  assert.equal(rateLimit("a", { max, windowMs, now: 2500 }).limited, false);
});

test("retryAfter reflects when the oldest hit ages out", () => {
  const opts = { max: 1, windowMs: 10_000, now: 5000 };
  rateLimit("a", opts);
  const blocked = rateLimit("a", { ...opts, now: 6000 });
  assert.equal(blocked.limited, true);
  // oldest hit at 5000 + 10000 window = reset at 15000; 9s from now (6000).
  assert.equal(blocked.retryAfter, 9);
});
