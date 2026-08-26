const fmtARS = n => n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const fmtUSD = n => {
  const digits = Math.abs(n) < 1 ? 6 : 2;
  return 'US$' + n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
};
const fmtNum = n => n.toLocaleString('es-AR', { maximumFractionDigits: 2 });
const fmtPct = n => (n > 0 ? '+' : '') + n.toFixed(2) + '%';
const pctClass = n => n > 0.005 ? 'up' : n < -0.005 ? 'down' : 'flat';

async function fetchFeed(path) {
  const res = await fetch('https://data912.com/live/' + path, { cache: 'no-store' });
  if (!res.ok) throw new Error('feed ' + path + ' failed: ' + res.status);
  return res.json();
}

const CRYPTO_LIST = [
  { id: 'bitcoin', symbol: 'BTC' },
  { id: 'ethereum', symbol: 'ETH' },
  { id: 'binancecoin', symbol: 'BNB' },
  { id: 'ripple', symbol: 'XRP' },
  { id: 'solana', symbol: 'SOL' },
  { id: 'cardano', symbol: 'ADA' },
  { id: 'dogecoin', symbol: 'DOGE' },
  { id: 'tron', symbol: 'TRX' },
  { id: 'polkadot', symbol: 'DOT' },
  { id: 'avalanche-2', symbol: 'AVAX' },
  { id: 'chainlink', symbol: 'LINK' },
  { id: 'litecoin', symbol: 'LTC' },
  { id: 'bitcoin-cash', symbol: 'BCH' },
  { id: 'cosmos', symbol: 'ATOM' },
  { id: 'ethereum-classic', symbol: 'ETC' },
  { id: 'stellar', symbol: 'XLM' },
  { id: 'shiba-inu', symbol: 'SHIB' },
  { id: 'matic-network', symbol: 'MATIC' },
  { id: 'tether', symbol: 'USDT' },
  { id: 'usd-coin', symbol: 'USDC' }
];

async function getUsdArsRate() {
  const data = await fetchFeed('mep');
  const rates = data.map(d => d.close).filter(v => typeof v === 'number' && v > 0);
  if (!rates.length) throw new Error('sin datos de dólar MEP');
  return rates.reduce((s, v) => s + v, 0) / rates.length;
}

async function getOficialRate() {
  const res = await fetch('https://dolarapi.com/v1/dolares/oficial', { cache: 'no-store' });
  if (!res.ok) throw new Error('dolar oficial failed: ' + res.status);
  const data = await res.json();
  return { compra: data.compra, venta: data.venta };
}

// Cripto se cotiza en dólares (es lo natural para leer su precio) pero para
// que sume bien en el total de la cartera (en pesos) tambien se guarda el
// equivalente en ARS usando el dolar MEP promedio del momento.
async function getCryptoMap() {
  const ids = CRYPTO_LIST.map(c => c.id).join(',');
  const [res, usdArsRate] = await Promise.all([
    fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=' + ids, { cache: 'no-store' }),
    getUsdArsRate()
  ]);
  if (!res.ok) throw new Error('crypto feed failed: ' + res.status);
  const data = await res.json();
  const map = new Map();
  data.forEach(coin => {
    const entry = CRYPTO_LIST.find(c => c.id === coin.id);
    if (!entry) return;
    map.set(entry.symbol, {
      symbol: entry.symbol,
      usd: coin.current_price,
      c: coin.current_price * usdArsRate,
      pct_change: coin.price_change_percentage_24h,
      name: coin.name
    });
  });
  map.usdArsRate = usdArsRate;
  return map;
}

async function getPriceMap(includeCrypto) {
  const [stocks, cedears] = await Promise.all([
    fetchFeed('arg_stocks'),
    fetchFeed('arg_cedears')
  ]);
  const priceMap = new Map();
  [...stocks, ...cedears].forEach(row => priceMap.set(row.symbol, row));
  if (includeCrypto) {
    try {
      const cryptoMap = await getCryptoMap();
      cryptoMap.forEach((v, k) => priceMap.set(k, v));
      priceMap.usdArsRate = cryptoMap.usdArsRate;
    } catch (err) {
      console.error('no se pudo cargar precios de cripto', err);
    }
  }
  return priceMap;
}

function tipoLabel(tipo) {
  return tipo === 'cedear' ? 'CEDEAR' : tipo === 'cripto' ? 'Cripto' : 'Acción';
}

const DONUT_PALETTE = ['#f1a887', '#4fa8a0', '#f2c879', '#7fa8d9', '#d98880', '#8cc7b5', '#b39ddb', '#93a3a1'];
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

function benchmarkTile(priceMap, weightedDaily) {
  const spy = priceMap ? priceMap.get('SPY') : null;
  if (!spy || weightedDaily == null) return '';
  const diff = weightedDaily - spy.pct_change;
  return `
    <div class="quick-stat">
      <div class="label">vs S&amp;P 500 (CEDEAR)</div>
      <div class="val chg ${pctClass(diff)}">${fmtPct(diff)}</div>
      <div class="note">Cartera ${fmtPct(weightedDaily)} · SPY ${fmtPct(spy.pct_change)}</div>
    </div>`;
}

function renderQuickMetrics(containerId, rows, priceMap, weightedDaily) {
  const el = document.getElementById(containerId);
  const m = quickMetrics(rows);
  const spyTile = benchmarkTile(priceMap, weightedDaily);
  if (!m) {
    el.innerHTML = '<div class="empty-note">Todavía no hay datos suficientes.</div>' + spyTile;
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
    ${spyTile}
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

function tvSymbol(ticker, tipo) {
  return tipo === 'cripto' ? 'BINANCE:' + ticker + 'USDT' : 'BCBA:' + ticker;
}

function tvUrl(ticker, tipo) {
  return tipo === 'cripto'
    ? 'https://www.tradingview.com/symbols/' + ticker + 'USDT/'
    : 'https://www.tradingview.com/symbols/BCBA-' + ticker + '/';
}

function tvMiniWidgetUrl(ticker, tipo) {
  const config = {
    symbol: tvSymbol(ticker, tipo),
    width: 300,
    height: 160,
    locale: 'es',
    dateRange: '1M',
    colorTheme: 'dark',
    isTransparent: false,
    autosize: false,
    largeChartUrl: ''
  };
  // El query param con el ticker (no solo el hash) es necesario para que el
  // iframe realmente recargue al cambiar de activo — si solo cambia el hash,
  // algunos navegadores lo tratan como navegacion interna y no re-renderizan.
  return 'https://s.tradingview.com/embed-widget/mini-symbol-overview/?t=' + encodeURIComponent(ticker) +
    '#' + encodeURIComponent(JSON.stringify(config));
}

function tvLink(ticker, tipo) {
  return `<a href="${tvUrl(ticker, tipo)}" target="_blank" rel="noopener" class="tk tk-link" data-ticker="${ticker}" data-tipo="${tipo || 'accion'}">${ticker}</a>`;
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
    const tipo = link.dataset.tipo;
    if (iframe.dataset.ticker !== ticker) {
      iframe.src = tvMiniWidgetUrl(ticker, tipo);
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
