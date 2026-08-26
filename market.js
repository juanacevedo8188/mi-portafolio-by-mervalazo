const fmtARS = n => n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const fmtNum = n => n.toLocaleString('es-AR', { maximumFractionDigits: 2 });
const fmtPct = n => (n > 0 ? '+' : '') + n.toFixed(2) + '%';
const pctClass = n => n > 0.005 ? 'up' : n < -0.005 ? 'down' : 'flat';

async function fetchFeed(path) {
  const res = await fetch('https://data912.com/live/' + path, { cache: 'no-store' });
  if (!res.ok) throw new Error('feed ' + path + ' failed: ' + res.status);
  return res.json();
}

async function getPriceMap() {
  const [stocks, cedears] = await Promise.all([
    fetchFeed('arg_stocks'),
    fetchFeed('arg_cedears')
  ]);
  const priceMap = new Map();
  [...stocks, ...cedears].forEach(row => priceMap.set(row.symbol, row));
  return priceMap;
}

const DONUT_PALETTE = ['#3fd3c6', '#5b9cf6', '#c39bff', '#f5a623', '#f4515f', '#7dd490', '#e879c2', '#8b98a9'];
function donutColor(i) { return DONUT_PALETTE[i % DONUT_PALETTE.length]; }

function groupBySector(rows) {
  const groups = new Map();
  rows.forEach(r => {
    const key = r.sector || 'Otros';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  });
  return [...groups.entries()].map(([sector, list]) => {
    const sectorValue = list.reduce((s, r) => s + (r.value ?? r.cost), 0);
    return { sector, list: list.sort((a, b) => (b.value ?? 0) - (a.value ?? 0)), sectorValue };
  }).sort((a, b) => b.sectorValue - a.sectorValue);
}

function quickMetrics(rows) {
  const withData = rows.filter(r => r.found && r.dailyPct != null);
  if (!withData.length) return null;
  const best = withData.reduce((a, b) => (b.dailyPct > a.dailyPct ? b : a));
  const worst = withData.reduce((a, b) => (b.dailyPct < a.dailyPct ? b : a));
  const totalValue = rows.reduce((s, r) => s + (r.value ?? r.cost), 0);
  const top3 = [...rows].sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).slice(0, 3);
  const top3Pct = totalValue ? (top3.reduce((s, r) => s + (r.value ?? r.cost), 0) / totalValue) * 100 : 0;
  return { best, worst, top3Pct };
}

function renderQuickMetrics(containerId, rows) {
  const el = document.getElementById(containerId);
  const m = quickMetrics(rows);
  if (!m) {
    el.innerHTML = '<div class="empty-note">Todavía no hay datos suficientes.</div>';
    return;
  }
  el.innerHTML = `
    <div class="quick-stat">
      <div class="label">Mejor del día</div>
      <div class="val chg ${pctClass(m.best.dailyPct)}">${m.best.ticker} · ${fmtPct(m.best.dailyPct)}</div>
    </div>
    <div class="quick-stat">
      <div class="label">Peor del día</div>
      <div class="val chg ${pctClass(m.worst.dailyPct)}">${m.worst.ticker} · ${fmtPct(m.worst.dailyPct)}</div>
    </div>
    <div class="quick-stat">
      <div class="label">Concentración top 3</div>
      <div class="val">${fmtNum(m.top3Pct)}%</div>
    </div>
  `;
}

function buildDonutSVG(values, size) {
  size = size || 132;
  const r = size / 2 - 15;
  const cx = size / 2, cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const total = values.reduce((s, v) => s + v, 0) || 1;
  let cumulative = 0;
  const circles = values.map((v, i) => {
    const len = (v / total) * circumference;
    const dashoffset = -cumulative;
    cumulative += len;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${donutColor(i)}" stroke-width="16" stroke-dasharray="${len} ${circumference - len}" stroke-dashoffset="${dashoffset}"/>`;
  }).join('');
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><g transform="rotate(-90 ${cx} ${cy})">${circles}</g></svg>`;
}

function renderDonut(containerId, sectors, totalValue, activeSector, onSectorClick) {
  const el = document.getElementById(containerId);
  if (!sectors.length || !totalValue) {
    el.innerHTML = '<div class="empty-note">Todavía no hay posiciones para graficar.</div>';
    return;
  }
  const svg = buildDonutSVG(sectors.map(s => s.sectorValue));
  const legend = sectors.map((s, i) => {
    const isActive = activeSector === s.sector;
    const isDim = activeSector && !isActive;
    return `
    <div class="donut-legend-row${isActive ? ' active' : ''}${isDim ? ' dim' : ''}" data-sector="${s.sector}">
      <span class="donut-dot" style="background:${donutColor(i)}"></span>
      <span class="donut-legend-label">${s.sector}</span>
      <span class="donut-legend-pct mono">${fmtNum((s.sectorValue / totalValue) * 100)}%</span>
    </div>`;
  }).join('');
  el.innerHTML = `<div class="donut-row"><div class="donut-svg">${svg}</div><div class="donut-legend">${legend}</div></div>`;
  if (onSectorClick) {
    el.querySelectorAll('.donut-legend-row').forEach(row => {
      row.addEventListener('click', () => onSectorClick(row.dataset.sector));
    });
  }
}

const CHART_PAD = 10;

function chartCoords(points, width, height) {
  const values = points.map(p => p.value);
  const min = Math.min(...values), max = Math.max(...values);
  const range = (max - min) || 1;
  const stepX = points.length > 1 ? (width - CHART_PAD * 2) / (points.length - 1) : 0;
  return points.map((p, i) => [
    CHART_PAD + i * stepX,
    height - CHART_PAD - ((p.value - min) / range) * (height - CHART_PAD * 2)
  ]);
}

function buildLineChartSVG(points, width, height) {
  width = width || 600;
  height = height || 140;
  const coords = chartCoords(points, width, height);
  const path = coords.map((c, i) => (i === 0 ? 'M' : 'L') + c[0].toFixed(1) + ' ' + c[1].toFixed(1)).join(' ');
  const up = points[points.length - 1].value >= points[0].value;
  const color = up ? 'var(--up)' : 'var(--down)';
  const areaPath = `${path} L${coords[coords.length - 1][0].toFixed(1)} ${height - CHART_PAD} L${coords[0][0].toFixed(1)} ${height - CHART_PAD} Z`;
  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
    <path d="${areaPath}" fill="${color}" opacity="0.12" stroke="none"/>
    <path d="${path}" fill="none" stroke="${color}" stroke-width="2"/>
    <circle class="chart-hover-dot" r="4" fill="${color}" stroke="var(--card)" stroke-width="2" style="opacity:0;"/>
  </svg>`;
}

function attachChartHover(containerId, points, width, height) {
  const container = document.getElementById(containerId);
  const svg = container.querySelector('svg');
  const dot = container.querySelector('.chart-hover-dot');
  if (!svg || points.length < 2) return;

  let tooltip = document.getElementById('chartTooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'chartTooltip';
    tooltip.className = 'chart-tooltip';
    document.body.appendChild(tooltip);
  }

  const coords = chartCoords(points, width, height);
  const stepX = points.length > 1 ? (width - CHART_PAD * 2) / (points.length - 1) : 0;

  function handleMove(e) {
    const rect = svg.getBoundingClientRect();
    const scaleX = width / rect.width;
    const relX = (e.clientX - rect.left) * scaleX;
    let idx = Math.round((relX - CHART_PAD) / (stepX || 1));
    idx = Math.max(0, Math.min(points.length - 1, idx));
    const p = points[idx];
    const prev = points[idx - 1];
    const change = prev ? ((p.value - prev.value) / prev.value) * 100 : null;
    const dateLabel = new Date(p.date + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });

    dot.setAttribute('cx', coords[idx][0]);
    dot.setAttribute('cy', coords[idx][1]);
    dot.style.opacity = '1';

    tooltip.innerHTML = `<div class="ct-date">${dateLabel}</div><div class="ct-value mono">${fmtARS(p.value)}</div>` +
      (change != null ? `<div class="ct-change ${pctClass(change)}">${fmtPct(change)} vs día anterior</div>` : '');
    tooltip.style.left = Math.min(e.clientX + 14, window.innerWidth - 190) + 'px';
    tooltip.style.top = Math.max(8, e.clientY - 56) + 'px';
    tooltip.style.display = 'block';
  }

  container.addEventListener('mousemove', handleMove);
  container.addEventListener('mouseleave', () => {
    tooltip.style.display = 'none';
    dot.style.opacity = '0';
  });
}

function tvMiniWidgetUrl(ticker) {
  const config = {
    symbol: 'BCBA:' + ticker,
    width: 300,
    height: 160,
    locale: 'es',
    dateRange: '1M',
    colorTheme: 'dark',
    isTransparent: false,
    autosize: false,
    largeChartUrl: ''
  };
  return 'https://s.tradingview.com/embed-widget/mini-symbol-overview/#' + encodeURIComponent(JSON.stringify(config));
}

function tvLink(ticker) {
  return `<a href="https://www.tradingview.com/symbols/BCBA-${ticker}/" target="_blank" rel="noopener" class="tk tk-link" data-ticker="${ticker}">${ticker}</a>`;
}

let tvHoverInitialized = false;
function initTVHover() {
  if (tvHoverInitialized) return;
  tvHoverInitialized = true;

  const tooltip = document.createElement('div');
  tooltip.id = 'tvPreview';
  tooltip.innerHTML = '<iframe frameborder="0" width="300" height="160"></iframe>';
  document.body.appendChild(tooltip);
  const iframe = tooltip.querySelector('iframe');
  let hideTimer = null;

  document.addEventListener('mouseover', e => {
    const link = e.target.closest('.tk-link');
    if (!link) return;
    clearTimeout(hideTimer);
    const ticker = link.dataset.ticker;
    if (iframe.dataset.ticker !== ticker) {
      iframe.src = tvMiniWidgetUrl(ticker);
      iframe.dataset.ticker = ticker;
    }
    const rect = link.getBoundingClientRect();
    let left = rect.right + 10;
    let top = rect.top;
    if (left + 310 > window.innerWidth) left = rect.left - 310;
    if (top + 170 > window.innerHeight) top = window.innerHeight - 170;
    tooltip.style.left = Math.max(8, left) + 'px';
    tooltip.style.top = Math.max(8, top) + 'px';
    tooltip.style.display = 'block';
  });

  document.addEventListener('mouseout', e => {
    const link = e.target.closest('.tk-link');
    if (!link) return;
    hideTimer = setTimeout(() => { tooltip.style.display = 'none'; }, 100);
  });
}

function renderHistory(chartId, rangeId, points) {
  const chartEl = document.getElementById(chartId);
  const rangeEl = document.getElementById(rangeId);
  if (points.length < 2) {
    chartEl.innerHTML = '<div class="empty-note">Todavía no hay suficiente historial para graficar la evolución — se guarda una foto por día, volvé en un par de días.</div>';
    if (rangeEl) rangeEl.textContent = '';
    return;
  }
  chartEl.innerHTML = buildLineChartSVG(points, 600, 140);
  attachChartHover(chartId, points, 600, 140);
  if (rangeEl) {
    const first = new Date(points[0].date + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
    const last = new Date(points[points.length - 1].date + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
    rangeEl.textContent = `${first} — ${last}`;
  }
}
