const DAY_MS = 86_400_000;

function dateOffset(date, days) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function percentChange(from, to) {
  return ((to / from) - 1) * 100;
}

export function buildWeeklyPerformance(snapshots, { threshold = 60, days = 7 } = {}) {
  const latest = snapshots.at(-1);
  if (!latest) return null;

  const windowStart = dateOffset(latest.date, -days);
  const windowEnd = dateOffset(latest.date, -1);
  const active = new Map();
  const episodes = [];

  for (const snapshot of snapshots.slice(0, -1)) {
    const qualified = new Set();
    for (const row of snapshot.rows) {
      if (row.result.index <= threshold || !Number.isFinite(row.price)) continue;
      const direction = row.result.direction === "wait" ? row.result.bias : row.result.direction;
      if (direction !== "long" && direction !== "short") continue;

      qualified.add(row.symbol);
      const previous = active.get(row.symbol);
      if (!previous || previous.direction !== direction) {
        const episode = {
          symbol: row.symbol,
          name: row.name,
          direction,
          signalDate: snapshot.date,
          signalIndex: row.result.index,
          signalPrice: row.price,
        };
        episodes.push(episode);
        active.set(row.symbol, episode);
      }
    }

    for (const symbol of active.keys()) {
      if (!qualified.has(symbol)) active.delete(symbol);
    }
  }

  const latestBySymbol = new Map(latest.rows.map((row) => [row.symbol, row]));
  const records = episodes
    .filter((episode) => episode.signalDate >= windowStart && episode.signalDate <= windowEnd)
    .map((episode) => {
      const current = latestBySymbol.get(episode.symbol);
      if (!current || !Number.isFinite(current.price)) return null;
      const priceChangePct = percentChange(episode.signalPrice, current.price);
      return {
        ...episode,
        currentDate: latest.date,
        currentPrice: current.price,
        priceChangePct,
        directionalReturnPct: episode.direction === "short" ? -priceChangePct : priceChangePct,
        elapsedDays: Math.round(
          (new Date(`${latest.date}T00:00:00Z`) - new Date(`${episode.signalDate}T00:00:00Z`)) / DAY_MS,
        ),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.signalDate.localeCompare(a.signalDate) || b.signalIndex - a.signalIndex);

  return { threshold, days, windowStart, windowEnd, currentDate: latest.date, records };
}
