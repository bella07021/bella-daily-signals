const state = { latest: null, history: [], filter: "all" };

const labels = { long: "做多", short: "做空", wait: "观望" };
const el = (id) => document.getElementById(id);

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[char]);
}

function formatNumber(value) {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString("en-US", { maximumFractionDigits: value >= 100 ? 2 : 4 });
}

function signedValue(value) {
  if (value === null || value === undefined) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
}

function formatTime(value) {
  return new Date(value).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
}

function tag(signal, text) {
  return `<span class="tag ${signal.side || ""}">${escapeHtml(text)}</span>`;
}

function arrowText(row) {
  const signal = row.result.signals.divergence;
  if (!signal.active) return "今日无箭头";
  return signal.label;
}

function arrowNote(row) {
  if (!row.result.signals.divergence.active) return "只检查最新一根日线";
  return `${row.arrow.type === "bullish" ? "↑" : "↓"} ${row.arrow.date} · 最新日线`;
}

function filteredRows() {
  const rows = state.latest?.rows ?? [];
  return rows.filter((row) => {
    const bias = row.result.direction === "wait" ? row.result.bias : row.result.direction;
    if (state.filter === "long" || state.filter === "short") return bias === state.filter;
    if (state.filter === "entry") return row.result.index >= 70;
    if (state.filter === "liquidity") return row.liquidity !== null;
    return true;
  });
}

function startClock() {
  const tick = () => {
    el("clock").textContent = new Date().toLocaleString("zh-CN", { hour12: false });
  };
  tick();
  setInterval(tick, 1000);
}

function renderStatus() {
  const { latest } = state;
  const ageHours = (Date.now() - new Date(latest.capturedAt).getTime()) / 36e5;
  const stale = ageHours > 30;
  const badge = el("freshnessBadge");
  badge.dataset.state = stale ? "stale" : "fresh";
  el("freshnessLabel").textContent = stale ? "数据过期 / STALE" : "数据最新 / UP TO DATE";
  const banner = el("staleBanner");
  banner.hidden = !stale;
  if (stale) banner.innerHTML = `<strong>数据可能过期：</strong>最后读取于 ${escapeHtml(formatTime(latest.capturedAt))}，已超过 30 小时未更新。`;

  const bars = [...new Set(latest.rows.map((row) => row.barTime))];
  el("barRange").textContent = `${latest.timeframe} · ${bars.join(" / ")}`;
  el("capturedAt").textContent = `${formatTime(latest.capturedAt)} (UTC+8)`;
  el("digestPeriod").textContent = `${latest.date} · ${latest.rows.length} 个 Favorite 标的 · ${latest.timeframe}`;
  el("sourceLabel").textContent = `来源 / SOURCE：${latest.source}`;

  const status = el("digestStatus");
  const partial = latest.rows.some((row) => row.liquidity === null) || (latest.issues || []).length;
  status.className = `status-pill ${partial ? "partial" : "complete"}`;
  status.textContent = partial ? "部分标的无信号 3 / PARTIAL" : "读取完整 / COMPLETE";
}

function renderKpis() {
  const rows = state.latest.rows;
  const top = rows[0];
  const entry = rows.filter((row) => row.result.index >= 70).length;
  const actionable = rows.filter((row) => row.result.direction !== "wait");
  const withLiquidity = rows.filter((row) => row.liquidity !== null).length;
  el("kpis").innerHTML = `
    <div><strong>${top?.result.index ?? "--"}</strong><b>${escapeHtml(top?.symbol ?? "")}</b><span>今日最高指数 / TOP INDEX</span></div>
    <div><strong>${entry}</strong><b>≥ 70</b><span>推荐进场标的 / ENTRY</span></div>
    <div><strong>${actionable.length}</strong><b>多 ${actionable.filter((r) => r.result.direction === "long").length} · 空 ${actionable.filter((r) => r.result.direction === "short").length}</b><span>方向明确 / DIRECTIONAL</span></div>
    <div><strong>${withLiquidity}<em style="font-size:16px;color:#666;font-style:normal">/${rows.length}</em></strong><b>S3</b><span>有流动性指标 / LIQUIDITY</span></div>`;
}

function renderConclusions() {
  const rows = state.latest.rows;
  const lines = [];
  const entries = rows.filter((row) => row.result.index >= 70);
  if (entries.length) {
    lines.push(`今日有 <span class="hl signal">${entries.length}</span> 个标的达到推荐进场：${entries
      .map((row) => `<b>${escapeHtml(row.symbol)}</b> <span class="hl ${row.result.direction}">${labels[row.result.direction]} ${row.result.index}</span>`)
      .join("、")}。`);
  } else {
    lines.push(`今日没有标的达到 <span class="hl signal">70</span> 分进场线，整体以 <span class="hl wait">观望</span> 为主。`);
  }
  const oversold = rows.filter((row) => row.result.signals.oscillator.side === "long");
  const overbought = rows.filter((row) => row.result.signals.oscillator.side === "short");
  if (oversold.length) lines.push(`超卖区（&lt;20）：${oversold.map((row) => `<b>${escapeHtml(row.symbol)}</b> ${row.oscillator.toFixed(2)}`).join("、")}，偏多等待确认。`);
  if (overbought.length) lines.push(`超买区（&gt;80）：${overbought.map((row) => `<b>${escapeHtml(row.symbol)}</b> ${row.oscillator.toFixed(2)}`).join("、")}，偏空等待确认。`);
  if (!oversold.length && !overbought.length) lines.push("没有标的处于 20 / 80 虚线外。");
  const fresh = rows.filter((row) => row.result.signals.divergence.active);
  lines.push(fresh.length
    ? `最新日线出现背离箭头：${fresh.map((row) => `<b>${escapeHtml(row.symbol)}</b> ${escapeHtml(row.result.signals.divergence.label)}`).join("、")}。`
    : "最新一根日线没有背离箭头；历史箭头不纳入今日信号。");
  const liq = rows.filter((row) => row.liquidity !== null);
  if (liq.length) lines.push(`流动性失衡：${liq.map((row) => `<b>${escapeHtml(row.symbol)}</b> <span class="hl ${row.liquidity >= 0 ? "long" : "short"}">${signedValue(row.liquidity)}</span> ${escapeHtml(row.result.signals.liquidity.label)}`).join("、")}。`);
  el("conclusions").innerHTML = lines.map((line) => `<article><p>${line}</p></article>`).join("");
}

function renderLeaders() {
  el("leaders").innerHTML = state.latest.rows
    .map((row, index) => {
      const { result } = row;
      return `
        <button class="leader-row" type="button" data-symbol="${escapeHtml(row.symbol)}" style="animation-delay:${index * 50}ms">
          <span class="sym-cell"><b>${String(index + 1).padStart(2, "0")}</b><span class="sym">${escapeHtml(row.symbol)}</span><small>${escapeHtml(row.market)}</small></span>
          <span class="score-cell"><strong>${result.index}</strong><span class="bar"><i style="width:${result.index}%"></i></span></span>
          <span class="dir ${result.direction}">${labels[result.direction]}</span>
          <span class="tier ${result.tier}">${escapeHtml(result.tierLabel)}</span>
        </button>`;
    })
    .join("");
}

function renderMatrix() {
  const rows = filteredRows();
  if (!rows.length) {
    el("matrix").innerHTML = `<div class="empty">当前筛选下没有标的。</div>`;
    return;
  }
  el("matrix").innerHTML = rows
    .map((row) => {
      const s = row.result.signals;
      return `
        <button class="matrix-row" type="button" data-symbol="${escapeHtml(row.symbol)}">
          <span class="cell"><span class="sym">${escapeHtml(row.symbol)}</span><em>${formatNumber(row.price)}</em></span>
          <span class="cell">${tag(s.oscillator, s.oscillator.label)}<em>主线 <span class="num">${row.oscillator.toFixed(2)}</span></em></span>
          <span class="cell">${tag(s.divergence, arrowText(row))}<em>${escapeHtml(arrowNote(row))}</em></span>
          <span class="cell">${tag(s.liquidity, s.liquidity.label)}<em>读数 <span class="num">${signedValue(row.liquidity)}</span></em></span>
          <span class="ls"><b>${row.result.long}</b> / <i>${row.result.short}</i></span>
          <span class="cell"><span class="big-score">${row.result.index}</span><em class="dir ${row.result.direction}">${labels[row.result.direction]}</em></span>
        </button>`;
    })
    .join("");
}

function renderQuality() {
  el("captureNote").textContent = state.latest.note || "";
  const missing = state.latest.rows.filter((row) => row.liquidity === null).map((row) => row.symbol);
  const issues = [...(state.latest.issues || [])];
  if (missing.length) issues.unshift(`没有流动性失衡指标：${missing.join("、")}，这些标的指数上限为 80。`);
  el("issues").innerHTML = (issues.length ? issues : ["没有读取异常。"])
    .map((issue) => `<article><p>${escapeHtml(issue)}</p></article>`)
    .join("");
}

function historyBars(symbol) {
  const values = state.history.slice(-30).map((day) => day.values[symbol]).filter(Boolean);
  if (values.length < 2) return `<p class="hint">历史记录从今天开始累计，满两天后显示趋势。</p>`;
  return `<div class="history">${values
    .map((value) => `<i class="${value.direction}" style="height:${Math.max(value.index, 4)}%" title="${value.index}"></i>`)
    .join("")}</div>`;
}

function openDetail(symbol) {
  const row = state.latest.rows.find((item) => item.symbol === symbol);
  if (!row) return;
  const { result } = row;
  const s = result.signals;
  const liquidityPoints = s.liquidity.available
    ? `${s.liquidity.points ? `+${s.liquidity.points}` : "0"}${s.liquidity.penalty ? ` / −${s.liquidity.penalty}` : ""}`
    : "—";
  el("detailBody").innerHTML = `
    <div class="detail-head">
      <span class="big">${result.index}</span>
      <div>
        <small>${escapeHtml(row.market)} · ${escapeHtml(row.barTime)}</small>
        <h2>${escapeHtml(row.symbol)} <span style="color:#666;font-size:12px;font-weight:400">${escapeHtml(row.name)}</span></h2>
        <span class="dir ${result.direction}">${labels[result.direction]}</span> <span class="tier ${result.tier}">· ${escapeHtml(result.tierLabel)}</span>
      </div>
    </div>
    <div class="breakdown">
      <div><b>S1</b><span>${escapeHtml(s.oscillator.label)}，主线 ${row.oscillator.toFixed(2)}</span><span class="pts">${s.oscillator.side ? `+${s.oscillator.points}` : "0"}</span></div>
      <div><b>S2</b><span>${escapeHtml(arrowText(row))}${row.arrow ? `（${escapeHtml(row.arrow.date)}）` : ""}</span><span class="pts">${s.divergence.side ? `+${s.divergence.points}` : "0"}</span></div>
      <div><b>S3</b><span>${escapeHtml(s.liquidity.label)}，读数 ${signedValue(row.liquidity)}</span><span class="pts">${liquidityPoints}</span></div>
      <div><b>结果</b><span>做多 ${result.long} / 做空 ${result.short}${result.capped ? "；缺少 S3，按 80 分上限换算" : ""}<br />${escapeHtml(row.reason)}</span><span class="pts">${result.index}</span></div>
    </div>
    <div class="history-wrap">
      <small>近 30 日指数 / LAST 30 DAILY READINGS</small>
      ${historyBars(row.symbol)}
    </div>`;
  el("detail").showModal();
}

function bindEvents() {
  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((item) => item.classList.toggle("active", item === button));
      renderMatrix();
    });
  });
  el("refreshButton").addEventListener("click", () => load());
  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-symbol]");
    if (target) openDetail(target.dataset.symbol);
    if (event.target.matches("[data-close]") || event.target === el("detail")) el("detail").close();
  });
}

async function load() {
  el("freshnessBadge").dataset.state = "checking";
  el("freshnessLabel").textContent = "检查中 / CHECKING";
  try {
    const [latest, history] = await Promise.all([
      fetch("/data/latest.json", { cache: "no-store" }).then((response) => response.json()),
      fetch("/data/history.json", { cache: "no-store" }).then((response) => response.json()),
    ]);
    Object.assign(state, { latest, history });
    renderStatus();
    renderKpis();
    renderConclusions();
    renderLeaders();
    renderMatrix();
    renderQuality();
  } catch (error) {
    el("freshnessBadge").dataset.state = "error";
    el("freshnessLabel").textContent = "读取失败 / ERROR";
    el("matrix").innerHTML = `<div class="empty">无法读取信号数据，请稍后刷新。</div>`;
    console.error(error);
  }
}

bindEvents();
startClock();
load();
