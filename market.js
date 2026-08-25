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

function renderDonut(containerId, sectors, totalValue) {
  const el = document.getElementById(containerId);
  if (!sectors.length || !totalValue) {
    el.innerHTML = '<div class="empty-note">Todavía no hay posiciones para graficar.</div>';
    return;
  }
  const svg = buildDonutSVG(sectors.map(s => s.sectorValue));
  const legend = sectors.map((s, i) => `
    <div class="donut-legend-row">
      <span class="donut-dot" style="background:${donutColor(i)}"></span>
      <span class="donut-legend-label">${s.sector}</span>
      <span class="donut-legend-pct mono">${fmtNum((s.sectorValue / totalValue) * 100)}%</span>
    </div>`).join('');
  el.innerHTML = `<div class="donut-row"><div class="donut-svg">${svg}</div><div class="donut-legend">${legend}</div></div>`;
}

function buildLineChartSVG(points, width, height) {
  width = width || 600;
  height = height || 140;
  const pad = 10;
  const values = points.map(p => p.value);
  const min = Math.min(...values), max = Math.max(...values);
  const range = (max - min) || 1;
  const stepX = points.length > 1 ? (width - pad * 2) / (points.length - 1) : 0;
  const coords = points.map((p, i) => {
    const x = pad + i * stepX;
    const y = height - pad - ((p.value - min) / range) * (height - pad * 2);
    return [x, y];
  });
  const path = coords.map((c, i) => (i === 0 ? 'M' : 'L') + c[0].toFixed(1) + ' ' + c[1].toFixed(1)).join(' ');
  const up = points[points.length - 1].value >= points[0].value;
  const color = up ? 'var(--up)' : 'var(--down)';
  const areaPath = `${path} L${coords[coords.length - 1][0].toFixed(1)} ${height - pad} L${coords[0][0].toFixed(1)} ${height - pad} Z`;
  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
    <path d="${areaPath}" fill="${color}" opacity="0.12" stroke="none"/>
    <path d="${path}" fill="none" stroke="${color}" stroke-width="2"/>
  </svg>`;
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
  if (rangeEl) {
    const first = new Date(points[0].date + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
    const last = new Date(points[points.length - 1].date + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
    rangeEl.textContent = `${first} — ${last}`;
  }
}
