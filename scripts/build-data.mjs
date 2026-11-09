import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, scoreTimeframe } from "./scoring.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readingsDir = path.join(root, "data", "readings");
const outDir = path.join(root, "public", "data");

function validate(file, snapshot) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(snapshot.date)) throw new Error(`${file}: invalid date`);
  if (!Array.isArray(snapshot.symbols) || !snapshot.symbols.length) throw new Error(`${file}: no symbols`);
  for (const item of snapshot.symbols) {
    if (!item.symbol || !Number.isFinite(item.oscillator)) {
      throw new Error(`${file}: ${item.symbol || "unknown"} needs symbol and oscillator`);
    }
    if (item.liquidity !== null && !Number.isFinite(item.liquidity)) {
      throw new Error(`${file}: ${item.symbol} liquidity must be a number or null`);
    }
  }
}

function buildSnapshot(snapshot) {
  const rows = snapshot.symbols.map((item) => {
    const result = scoreTimeframe(item);
    return { ...item, result, reason: describe(item, result) };
  });
  rows.sort((a, b) => b.result.index - a.result.index || a.symbol.localeCompare(b.symbol));
  return { ...snapshot, rows };
}

const files = (await readdir(readingsDir)).filter((name) => name.endsWith(".json")).sort();
if (!files.length) throw new Error("No readings found in data/readings");

const snapshots = [];
for (const file of files) {
  const snapshot = JSON.parse(await readFile(path.join(readingsDir, file), "utf8"));
  validate(file, snapshot);
  snapshots.push(buildSnapshot(snapshot));
}

const latest = snapshots.at(-1);
const history = snapshots.slice(-90).map((snapshot) => ({
  date: snapshot.date,
  values: Object.fromEntries(
    snapshot.rows.map((row) => [row.symbol, { index: row.result.index, direction: row.result.direction }]),
  ),
}));

await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, "latest.json"), `${JSON.stringify(latest, null, 2)}\n`);
await writeFile(path.join(outDir, "history.json"), `${JSON.stringify(history, null, 2)}\n`);
console.log(`Built ${latest.date}: ${latest.rows.length} symbols, ${history.length} history day(s).`);
