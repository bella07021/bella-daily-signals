// Daily signal scoring. Each timeframe is scored independently; this version only scores 1D.

export const TIERS = [
  { min: 85, label: "强烈推荐", key: "strong" },
  { min: 70, label: "推荐进场", key: "entry" },
  { min: 50, label: "潜在机会", key: "potential" },
  { min: 30, label: "观察", key: "watch" },
  { min: 0, label: "无信号", key: "none" },
];

const NO_LIQUIDITY_CAP = 80;
const MAX_WITHOUT_LIQUIDITY = 55; // 25 (signal 1) + 30 (signal 2)
const ARROW_WINDOW_BARS = 3;

export function scoreOscillator(value) {
  if (!Number.isFinite(value)) return { side: null, points: 0, label: "缺失" };
  if (value <= 10) return { side: "long", points: 25, label: "深度超卖" };
  if (value < 20) return { side: "long", points: 20, label: "超卖" };
  if (value >= 90) return { side: "short", points: 25, label: "深度超买" };
  if (value > 80) return { side: "short", points: 20, label: "超买" };
  return { side: null, points: 0, label: "中性" };
}

export function scoreArrow(arrow) {
  if (!arrow) return { side: null, points: 0, label: "无箭头", active: false };
  const side = arrow.type === "bullish" ? "long" : "short";
  const name = arrow.type === "bullish" ? "底背离" : "顶背离";
  const bars = arrow.barsAgo;
  if (!Number.isFinite(bars) || bars >= ARROW_WINDOW_BARS) {
    return { side: null, points: 0, label: `${name}已过期`, active: false, stale: true };
  }
  // barsAgo 0 = latest closed/current bar, 1 = previous bar.
  if (bars <= 1) return { side, points: 30, label: `新${name}`, active: true };
  return { side, points: 20, label: name, active: true };
}

export function liquidityStrength(value) {
  const abs = Math.abs(value);
  if (abs >= 20) return { key: "strong", label: "强烈", points: 45, penalty: 30 };
  if (abs >= 15) return { key: "potential", label: "潜在机会", points: 30, penalty: 20 };
  if (abs >= 10) return { key: "medium", label: "中等", points: 15, penalty: 0 };
  return { key: "weak", label: "弱", points: 5, penalty: 0 };
}

export function scoreLiquidity(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return { side: null, points: 0, penalty: 0, label: "无此指标", available: false };
  }
  const strength = liquidityStrength(value);
  const side = value > 0 ? "long" : value < 0 ? "short" : null;
  const sideLabel = side === "long" ? "买方" : side === "short" ? "卖方" : "平衡";
  return {
    side,
    points: side ? strength.points : 0,
    penalty: side ? strength.penalty : 0,
    label: `${sideLabel}${strength.label}`,
    strength: strength.key,
    available: true,
  };
}

export function tierFor(index) {
  return TIERS.find((tier) => index >= tier.min);
}

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function scoreTimeframe(reading) {
  const s1 = scoreOscillator(reading.oscillator);
  const s2 = scoreArrow(reading.arrow);
  const s3 = scoreLiquidity(reading.liquidity);
  const raw = { long: 0, short: 0 };

  for (const signal of [s1, s2]) {
    if (signal.side) raw[signal.side] += signal.points;
  }

  let long;
  let short;
  if (s3.available) {
    if (s3.side) {
      raw[s3.side] += s3.points;
      const opposite = s3.side === "long" ? "short" : "long";
      raw[opposite] -= s3.penalty;
    }
    long = clamp(raw.long);
    short = clamp(raw.short);
  } else {
    long = clamp((raw.long / MAX_WITHOUT_LIQUIDITY) * NO_LIQUIDITY_CAP);
    short = clamp((raw.short / MAX_WITHOUT_LIQUIDITY) * NO_LIQUIDITY_CAP);
  }

  const index = Math.max(long, short);
  const bias = long === short ? "neutral" : long > short ? "long" : "short";
  const decisive = Math.abs(long - short) >= 10;
  const tier = tierFor(index);
  const direction = decisive && index >= 30 ? bias : "wait";

  return {
    index,
    long,
    short,
    bias,
    direction,
    tier: tier.key,
    tierLabel: tier.label,
    signals: { oscillator: s1, divergence: s2, liquidity: s3 },
    capped: !s3.available,
  };
}

export function describe(symbol, result) {
  const parts = [];
  const { oscillator, divergence, liquidity } = result.signals;
  if (oscillator.side) parts.push(`${oscillator.label} ${symbol.oscillator.toFixed(2)}`);
  if (divergence.active) parts.push(`${divergence.label}箭头（${symbol.arrow.barsAgo} 根前）`);
  if (liquidity.available) {
    parts.push(`流动性 ${symbol.liquidity > 0 ? "+" : ""}${symbol.liquidity.toFixed(2)}（${liquidity.label}）`);
  }
  if (!parts.length) parts.push("三项信号都没有触发");
  if (!liquidity.available) parts.push("缺少流动性确认");
  if (divergence.stale) parts.push(`最近一次${divergence.label.replace("已过期", "")}已超出 3 根 K 线`);
  return parts.join("，");
}
