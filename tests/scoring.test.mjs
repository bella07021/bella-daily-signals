import assert from "node:assert/strict";
import test from "node:test";
import { scoreTimeframe } from "../scripts/scoring.mjs";

test("liquidity alone stays observation-only", () => {
  const result = scoreTimeframe({ oscillator: 50, arrow: null, liquidity: 22 });
  assert.equal(result.long, 45);
  assert.equal(result.direction, "long");
  assert.equal(result.tierLabel, "观察");
});

test("fresh divergence plus strong liquidity is an entry", () => {
  const result = scoreTimeframe({
    oscillator: 18,
    arrow: { type: "bullish", barsAgo: 0 },
    liquidity: 21,
  });
  assert.equal(result.long, 95);
  assert.equal(result.direction, "long");
  assert.equal(result.tierLabel, "强烈推荐");
});

test("opposite strong liquidity penalizes the bearish setup", () => {
  const result = scoreTimeframe({
    oscillator: 85,
    arrow: { type: "bearish", barsAgo: 0 },
    liquidity: 20.5,
  });
  assert.equal(result.short, 20);
  assert.equal(result.long, 45);
});

test("missing liquidity is scaled and capped at 80", () => {
  const result = scoreTimeframe({
    oscillator: 5,
    arrow: { type: "bullish", barsAgo: 0 },
    liquidity: null,
  });
  assert.equal(result.long, 80);
  assert.equal(result.capped, true);
});

test("previous-day arrows do not score", () => {
  const result = scoreTimeframe({
    oscillator: 40,
    arrow: { type: "bullish", barsAgo: 1 },
    liquidity: null,
  });
  assert.equal(result.index, 0);
  assert.equal(result.signals.divergence.stale, true);
});

test("negative liquidity favors short", () => {
  const result = scoreTimeframe({
    oscillator: 84,
    arrow: { type: "bearish", barsAgo: 0 },
    liquidity: -16,
  });
  assert.equal(result.short, 80);
  assert.equal(result.direction, "short");
});
