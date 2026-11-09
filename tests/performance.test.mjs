import assert from "node:assert/strict";
import test from "node:test";
import { buildWeeklyPerformance } from "../scripts/performance.mjs";

function snapshot(date, rows) {
  return { date, rows };
}

function row(symbol, price, index, direction) {
  return {
    symbol,
    name: symbol,
    price,
    result: { index, direction, bias: direction === "wait" ? "neutral" : direction },
  };
}

test("tracks a prior-week signal through today's price", () => {
  const result = buildWeeklyPerformance([
    snapshot("2026-11-05", [row("AAA", 100, 70, "long")]),
    snapshot("2026-11-09", [row("AAA", 110, 20, "wait")]),
  ]);
  assert.equal(result.records.length, 1);
  assert.ok(Math.abs(result.records[0].priceChangePct - 10) < 1e-9);
  assert.ok(Math.abs(result.records[0].directionalReturnPct - 10) < 1e-9);
});

test("deduplicates a continuous same-direction signal", () => {
  const result = buildWeeklyPerformance([
    snapshot("2026-11-05", [row("AAA", 100, 65, "long")]),
    snapshot("2026-11-06", [row("AAA", 103, 75, "long")]),
    snapshot("2026-11-09", [row("AAA", 106, 10, "wait")]),
  ]);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].signalDate, "2026-11-05");
  assert.equal(result.records[0].signalPrice, 100);
});

test("short signals invert the directional return", () => {
  const result = buildWeeklyPerformance([
    snapshot("2026-11-08", [row("AAA", 100, 80, "short")]),
    snapshot("2026-11-09", [row("AAA", 90, 20, "wait")]),
  ]);
  assert.ok(Math.abs(result.records[0].priceChangePct + 10) < 1e-9);
  assert.ok(Math.abs(result.records[0].directionalReturnPct - 10) < 1e-9);
});

test("excludes today's signal and scores at the threshold", () => {
  const result = buildWeeklyPerformance([
    snapshot("2026-11-08", [row("AAA", 100, 60, "long")]),
    snapshot("2026-11-09", [row("BBB", 100, 90, "long")]),
  ]);
  assert.deepEqual(result.records, []);
});
