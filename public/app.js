const state = { latest: null, history: [], filter: "all" };

const labels = {
  long: "做多",
  short: "做空",
  wait: "观望",
};

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
  if (value === null || value === undefined) return "无";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
}

function tone(direction) {
  return direction === "long" ? "var(--long)" : direction === "short" ? "var(--short)" : "var(--wait)";
}

function chip(signal, text) {
  const active = Boolean(signal.side);
  return `<span class="chip ${active ? `on ${signal.side}` : "off"}">${escapeHtml(text)}</span>`;
}

function arrowText(row) {
  const signal = row.result.signals.divergence;
  if (!row.arrow) return "无箭头";
  return signal.active ? `${signal.label} · ${row.arrow.barsAgo} 根前` : `${signal.label} · ${row.arrow.date}`;
}

function filteredRows() {
  const rows = state.latest?.rows ?? [];
  return rows.filter((row) => {
    if (state.filter === "long" || state.filter === "short") return row.result.direction === state.filter;
    if (state.filter === "entry") return row.result.index >= 70;
    if (state.filter === "liquidity") return row.liquidity !== null;
    return true;
  });
}

function renderSummary() {
  const rows = state.latest.rows;
  const top = rows[0];
  el("topScore").textContent = top?.result.index ?? "--";
  el("topSymbol").textContent = top ? `${top.symbol} · ${labels[top.result.direction]} · ${top.result.tierLabel}` : "无数据";
  el("symbolCount").textContent = rows.length;
  el("longCount").textContent = rows.filter((row) => row.result.direction === "long").length;
  el("shortCount").textContent = rows.filter((row) => row.result.direction === "short").length;

  const captured = new Date(state.latest.capturedAt);
  const ageHours = (Date.now() - captured.getTime()) / 36e5;
  const time = captured.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
  el("freshness").textContent = `${ageHours > 30 ? "数据可能过期 · " : ""}更新于 ${time} · ${state.latest.timeframe}`;
}

function renderRanking() {
  const rows = filteredRows();
  if (!rows.length) {
    el("ranking").innerHTML = `<div class="empty">当前筛选下没有标的。</div>`;
    return;
  }
  el("ranking").innerHTML = rows
    .map((row, index) => {
      const { result } = row;
      const signals = result.signals;
      return `
        <button class="signal-row" data-symbol="${escapeHtml(row.symbol)}" style="animation-delay:${index * 45}ms">
          <span class="score-orb" style="--score:${result.index};--tone:${tone(result.direction)}">${result.index}</span>
          <span class="symbol-name"><strong>${escapeHtml(row.symbol)}</strong><span>${escapeHtml(row.name)} · ${formatNumber(row.price)}</span></span>
          <span class="details">
            <span class="chips">
              ${chip(signals.oscillator, `S1 ${row.oscillator.toFixed(2)} ${signals.oscillator.label}`)}
              ${chip(signals.divergence, `S2 ${arrowText(row)}`)}
              ${chip(signals.liquidity, `S3 ${signedValue(row.liquidity)} ${signals.liquidity.label}`)}
            </span>
            <span class="reason">${escapeHtml(row.reason)}</span>
          </span>
          <span class="verdict">
            <span class="direction ${result.direction}">${labels[result.direction]}</span>
            <small>${escapeHtml(result.tierLabel)} · 多 ${result.long} / 空 ${result.short}</small>
          </span>
        </button>`;
    })
    .join("");
}

function renderMatrix() {
  el("matrix").innerHTML = state.latest.rows
    .map((row) => {
      const signals = row.result.signals;
      return `
        <tr data-symbol="${escapeHtml(row.symbol)}">
          <td>${escapeHtml(row.symbol)}</td>
          <td>${chip(signals.oscillator, signals.oscillator.label)} <span class="value">${row.oscillator.toFixed(2)}</span></td>
          <td>${chip(signals.divergence, arrowText(row))}</td>
          <td>${chip(signals.liquidity, signals.liquidity.label)} <span class="value">${signedValue(row.liquidity)}</span></td>
          <td><span class="direction ${row.result.direction}">${row.result.index} · ${labels[row.result.direction]}</span></td>
        </tr>`;
    })
    .join("");
}

function renderQuality() {
  el("captureNote").textContent = state.latest.note || "";
  const missing = state.latest.rows.filter((row) => row.liquidity === null).map((row) => row.symbol);
  const issues = [...(state.latest.issues || [])];
  if (missing.length) issues.unshift(`没有流动性失衡指标：${missing.join("、")}，指数上限为 80。`);
  el("issues").innerHTML = issues.length
    ? issues.map((issue) => `<li>${escapeHtml(issue)}</li>`).join("")
    : "<li>没有读取异常。</li>";
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
  const liquidityPoints = s.liquidity.available ? `+${s.liquidity.points}` : "—";
  el("detailBody").innerHTML = `
    <div class="detail-top">
      <span class="score-orb" style="--score:${result.index};--tone:${tone(result.direction)}">${result.index}</span>
      <div>
        <p class="eyebrow">${escapeHtml(row.market)} · ${escapeHtml(row.barTime)}</p>
        <h2>${escapeHtml(row.symbol)}</h2>
        <span class="direction ${result.direction}">${labels[result.direction]} · ${escapeHtml(result.tierLabel)}</span>
      </div>
    </div>
    <div class="breakdown">
      <div><b>信号 1</b><span>${escapeHtml(s.oscillator.label)}，主线 ${row.oscillator.toFixed(2)}</span><span class="points">${s.oscillator.side ? `+${s.oscillator.points}` : "0"}</span></div>
      <div><b>信号 2</b><span>${escapeHtml(arrowText(row))}</span><span class="points">${s.divergence.side ? `+${s.divergence.points}` : "0"}</span></div>
      <div><b>信号 3</b><span>${escapeHtml(s.liquidity.label)}，读数 ${signedValue(row.liquidity)}</span><span class="points">${liquidityPoints}</span></div>
      <div><b>结果</b><span>做多 ${result.long} / 做空 ${result.short}${result.capped ? "，缺少信号 3，已按 80 分上限换算" : ""}</span><span class="points">${result.index}</span></div>
    </div>
    <p class="eyebrow">Last 30 daily readings</p>
    ${historyBars(row.symbol)}
  `;
  el("detail").showModal();
}

function bindEvents() {
  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((item) => item.classList.toggle("active", item === button));
      renderRanking();
    });
  });
  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-symbol]");
    if (target) openDetail(target.dataset.symbol);
    if (event.target.matches("[data-close]") || event.target === el("detail")) el("detail").close();
  });
}

async function init() {
  bindEvents();
  try {
    const [latest, history] = await Promise.all([
      fetch("/data/latest.json", { cache: "no-store" }).then((response) => response.json()),
      fetch("/data/history.json", { cache: "no-store" }).then((response) => response.json()),
    ]);
    Object.assign(state, { latest, history });
    renderSummary();
    renderRanking();
    renderMatrix();
    renderQuality();
  } catch (error) {
    el("freshness").textContent = "数据读取失败";
    el("ranking").innerHTML = `<div class="empty">无法读取信号数据，请稍后刷新。</div>`;
    console.error(error);
  }
}

init();
