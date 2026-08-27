const fmtARS = n => n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const fmtUSD = n => {
  const digits = Math.abs(n) < 1 ? 6 : 2;
  return 'US$' + n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
};
const fmtNum = n => n.toLocaleString('es-AR', { maximumFractionDigits: 2 });
const fmtPct = n => n == null || isNaN(n) ? '—' : (n > 0 ? '+' : '') + n.toFixed(2) + '%';
const pctClass = n => n == null || isNaN(n) ? 'flat' : n > 0.005 ? 'up' : n < -0.005 ? 'down' : 'flat';

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

async function getAllDolarRates() {
  const res = await fetch('https://dolarapi.com/v1/dolares', { cache: 'no-store' });
  if (!res.ok) throw new Error('dolares failed: ' + res.status);
  return res.json();
}

// Historico diario por tipo de dolar (casa: oficial/blue/bolsa/mayorista/
// cripto/tarjeta/contadoconliqui) — mismos slugs que devuelve dolarapi.com,
// asi que no hace falta traducir nombres entre las dos APIs.
async function getDolarHistory(casa, days) {
  const res = await fetch(`https://api.argentinadatos.com/v1/cotizaciones/dolares/${casa}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('dolar historico failed: ' + res.status);
  const data = await res.json();
  return data.slice(-(days || 30)).map(d => ({ date: d.fecha, value: d.venta }));
}

// API publica y gratuita del BCRA (Banco Central de la Republica Argentina).
// La API es propensa a fallas puntuales/lentitud, asi que reintenta antes
// de darse por vencida en vez de mostrar un error por una falla transitoria.
async function fetchBcra(url, retries) {
  const attempts = retries == null ? 2 : retries;
  let lastErr;
  for (let i = 0; i <= attempts; i++) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('bcra failed: ' + res.status);
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (i < attempts) await new Promise(r => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw lastErr;
}

async function getBcraVariables() {
  const data = await fetchBcra('https://api.bcra.gob.ar/estadisticas/v4.0/monetarias?limit=1000');
  return data.results.filter(r => r.categoria === 'Principales Variables');
}

async function getBcraSeries(idVariable, limit) {
  const data = await fetchBcra(`https://api.bcra.gob.ar/estadisticas/v4.0/monetarias/${idVariable}?limit=${limit || 1001}`);
  return data.results[0].detalle; // [{ fecha, valor }], mas reciente primero
}

// Letras capitalizables (LECAP/BONCAP): fechas/valor final de argentinadatos.com,
// precio actual de mercado del feed de data912 (notas y bonos). El DTM resta un
// dia por la liquidacion T+1 — sin ese ajuste el TNA/TEA/TEM no coinciden con
// los que muestran las calculadoras de referencia del mercado.
async function getLecapData() {
  const [letras, notes, bonds] = await Promise.all([
    fetch('https://api.argentinadatos.com/v1/finanzas/letras', { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error('letras failed: ' + r.status); return r.json(); }),
    fetchFeed('arg_notes'),
    fetchFeed('arg_bonds')
  ]);
  const priceMap = new Map();
  [...notes, ...bonds].forEach(row => priceMap.set(row.symbol, row));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return letras
    .map(l => {
      const q = priceMap.get(l.ticker);
      if (!q || !q.c || !l.fechaVencimiento || !l.vpv) return null;
      const vencimiento = new Date(l.fechaVencimiento + 'T00:00:00');
      const calendarDays = Math.round((vencimiento - today) / 86400000);
      const dtm = calendarDays - 1;
      if (dtm < 1) return null; // vencida o vence manana: fuera de rango util
      const ratio = l.vpv / q.c;
      return {
        ticker: l.ticker,
        vencimiento: l.fechaVencimiento,
        dtm,
        price: q.c,
        pctChange: q.pct_change,
        tem: (Math.pow(ratio, 30 / dtm) - 1) * 100,
        tna: (ratio - 1) * (365 / dtm) * 100,
        tea: (Math.pow(ratio, 365 / dtm) - 1) * 100
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.dtm - b.dtm);
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
      name: coin.name,
      marketCap: coin.market_cap
    });
  });
  map.usdArsRate = usdArsRate;
  return map;
}

// Precios de LECAP/BONCAP con la misma forma {c, pct_change} que ya usan
// las filas de acciones/CEDEARs — asi se puede mergear en el mismo Map y
// el resto del codigo (render, fmtPrice, etc.) no necesita casos especiales
// por tipo de activo.
async function getLetraPriceMap() {
  const letras = await getLecapData();
  const map = new Map();
  letras.forEach(l => map.set(l.ticker, { c: l.price, pct_change: l.pctChange }));
  return map;
}

async function getPriceMap(includeCrypto, includeLetras) {
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
  if (includeLetras) {
    try {
      const letraMap = await getLetraPriceMap();
      letraMap.forEach((v, k) => priceMap.set(k, v));
    } catch (err) {
      console.error('no se pudo cargar precios de letras', err);
    }
  }
  return priceMap;
}

function tipoLabel(tipo) {
  if (tipo === 'cedear') return 'CEDEAR';
  if (tipo === 'cripto') return 'Cripto';
  if (tipo === 'letra') return 'Letra';
  return 'Acción';
}

const DONUT_PALETTE = ['#f0904f', '#29a89c', '#f0b429', '#4f8fd9', '#e0655a', '#4fbf9a', '#9b6fd4', '#6b93a0'];
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

// Gauge de "humor del mercado": semicírculo de 5 zonas + aguja, en base al
// % de acciones/CEDEARs que suben hoy.
const MOOD_ZONES = [
  { label: 'Pánico', from: 0, to: 20, color: '#c94a41' },
  { label: 'Bajista', from: 20, to: 40, color: '#e0655a' },
  { label: 'Neutral', from: 40, to: 60, color: '#6b7280' },
  { label: 'Alcista', from: 60, to: 80, color: '#4fbf9a' },
  { label: 'Eufórico', from: 80, to: 100, color: '#22c55e' }
];

function moodPoint(cx, cy, r, pct) {
  const angleDeg = 180 - (pct / 100) * 180;
  const rad = angleDeg * Math.PI / 180;
  return [cx + r * Math.cos(rad), cy - r * Math.sin(rad)];
}

function moodLabel(pct) {
  const zone = MOOD_ZONES.find(z => pct >= z.from && pct <= z.to);
  return (zone || MOOD_ZONES[MOOD_ZONES.length - 1]).label;
}

function buildMoodGaugeSVG(pctUp, width, height) {
  width = width || 220;
  height = height || 128;
  const cx = width / 2, cy = height - 16;
  const r = Math.min(width / 2 - 16, cy - 14);
  const bandW = 15;
  const arcs = MOOD_ZONES.map(z => {
    const [x1, y1] = moodPoint(cx, cy, r, z.from);
    const [x2, y2] = moodPoint(cx, cy, r, z.to);
    return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="${z.color}" stroke-width="${bandW}" opacity="0.85"/>`;
  }).join('');
  const needleLen = r - bandW / 2 - 6;
  const [nx, ny] = moodPoint(cx, cy, needleLen, pctUp);
  return `<svg viewBox="0 0 ${width} ${height}">
    ${arcs}
    <line x1="${cx}" y1="${cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="var(--text)" stroke-width="3" stroke-linecap="round"/>
    <circle cx="${cx}" cy="${cy}" r="5" fill="var(--text)"/>
  </svg>`;
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

// Reemplaza un <select> nativo por un dropdown propio: la lista abierta de
// un select nativo no se puede restylar de forma confiable entre
// navegadores (queda "de fabrica" aunque el select cerrado si se pueda).
// El select original queda oculto pero sigue siendo la fuente de verdad
// (.value, evento 'change'), asi el resto del codigo no cambia.
function enhanceSelect(selectEl) {
  if (!selectEl || selectEl.dataset.enhanced) return;
  selectEl.dataset.enhanced = '1';

  const wrap = document.createElement('div');
  wrap.className = 'cs-wrap';
  selectEl.parentNode.insertBefore(wrap, selectEl);
  selectEl.classList.add('cs-native');
  wrap.appendChild(selectEl);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'cs-btn';
  btn.innerHTML = '<span class="cs-btn-label"></span><span class="cs-caret">▾</span>';
  wrap.appendChild(btn);

  const menu = document.createElement('div');
  menu.className = 'cs-menu';
  wrap.appendChild(menu);

  const label = btn.querySelector('.cs-btn-label');

  function renderMenu() {
    menu.innerHTML = [...selectEl.options].map(o =>
      `<div class="cs-item${o.value === selectEl.value ? ' active' : ''}" data-value="${o.value.replace(/"/g, '&quot;')}">${o.textContent}</div>`
    ).join('');
  }
  function syncLabel() {
    const opt = selectEl.options[selectEl.selectedIndex];
    label.textContent = opt ? opt.textContent : '';
  }

  renderMenu();
  syncLabel();
  selectEl._csSync = () => { renderMenu(); syncLabel(); };

  btn.addEventListener('click', e => {
    e.stopPropagation();
    const wasOpen = wrap.classList.contains('open');
    document.querySelectorAll('.cs-wrap.open').forEach(w => w.classList.remove('open'));
    if (!wasOpen) {
      renderMenu();
      const rect = btn.getBoundingClientRect();
      menu.style.top = (rect.bottom + 6) + 'px';
      menu.style.left = rect.left + 'px';
      menu.style.minWidth = rect.width + 'px';
      wrap.classList.add('open');
    }
  });

  menu.addEventListener('click', e => {
    const item = e.target.closest('.cs-item');
    if (!item) return;
    selectEl.value = item.dataset.value;
    selectEl.dispatchEvent(new Event('change', { bubbles: true }));
    syncLabel();
    wrap.classList.remove('open');
  });
}

function enhanceAllSelects(root) {
  (root || document).querySelectorAll('select').forEach(enhanceSelect);
}

document.addEventListener('click', () => {
  document.querySelectorAll('.cs-wrap.open').forEach(w => w.classList.remove('open'));
});

function buildSparklineSVG(values, width, height) {
  width = width || 70;
  height = height || 24;
  if (!values || values.length < 2) return '';
  const min = Math.min(...values), max = Math.max(...values);
  const range = (max - min) || 1;
  const stepX = width / (values.length - 1);
  const coords = values.map((v, i) => [i * stepX, height - ((v - min) / range) * height]);
  const path = coords.map((c, i) => (i === 0 ? 'M' : 'L') + c[0].toFixed(1) + ' ' + c[1].toFixed(1)).join(' ');
  const up = values[values.length - 1] >= values[0];
  const color = up ? 'var(--up)' : 'var(--down)';
  return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><path d="${path}" fill="none" stroke="${color}" stroke-width="1.5"/></svg>`;
}

function tvSymbol(ticker, tipo) {
  if (tipo === 'cripto') return 'BINANCE:' + ticker + 'USDT';
  if (tipo === 'global') return ticker;
  return 'BCBA:' + ticker;
}

function tvUrl(ticker, tipo) {
  if (tipo === 'cripto') return 'https://www.tradingview.com/symbols/' + ticker + 'USDT/';
  if (tipo === 'global') return 'https://www.tradingview.com/symbols/' + ticker + '/';
  return 'https://www.tradingview.com/symbols/BCBA-' + ticker + '/';
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

// financialmodelingprep.com sirve logos por ticker de forma gratuita y sin
// key, pero solo cubre simbolos que cotizan en EEUU — para acciones
// argentinas que NO tienen ADR (o cotizan bajo otro simbolo en EEUU) no hay
// logo disponible y el <img> simplemente no se muestra (onerror).
const TICKER_LOGO_OVERRIDE = {
  YPFD: 'YPF', PAMP: 'PAM', TGSU2: 'TGS', TXAR: 'TX', CRES: 'CRESY',
  IRSA: 'IRS', TECO2: 'TEO'
};

function tickerLogoUrl(ticker, tipo) {
  if (tipo === 'cripto') return null;
  const symbol = TICKER_LOGO_OVERRIDE[ticker] || ticker;
  return `https://financialmodelingprep.com/image-stock/${symbol}.png`;
}

function tvLink(ticker, tipo) {
  const logoUrl = tickerLogoUrl(ticker, tipo);
  const logo = logoUrl
    ? `<img class="tk-logo" src="${logoUrl}" alt="" onerror="this.style.display='none'">`
    : '';
  return `<a href="${tvUrl(ticker, tipo)}" target="_blank" rel="noopener" class="tk tk-link" data-ticker="${ticker}" data-tipo="${tipo || 'accion'}">${logo}${ticker}</a>`;
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

// Heatmap — universo Argentina: acciones reales del Merval (sin CEDEARs,
// que ya cubre el heatmap Global). Precio/variación % en vivo via data912;
// sector y market cap (miles de millones de USD, aproximado) cargados a
// mano porque el feed no los trae — solo definen el TAMAÑO relativo de
// cada caja, no un dato financiero exacto.
const ARG_HEATMAP_LIST = [
  ['GGAL', 'Bancos y Financiero', 8], ['BMA', 'Bancos y Financiero', 4],
  ['SUPV', 'Bancos y Financiero', 1.2], ['BBAR', 'Bancos y Financiero', 2.5],
  ['VALO', 'Bancos y Financiero', 0.4], ['BYMA', 'Bancos y Financiero', 0.5],
  ['YPFD', 'Energía y Utilities', 9], ['PAMP', 'Energía y Utilities', 5],
  ['TGSU2', 'Energía y Utilities', 1.5], ['TGNO4', 'Energía y Utilities', 1],
  ['CEPU', 'Energía y Utilities', 1.2], ['EDN', 'Energía y Utilities', 0.8],
  ['TRAN', 'Energía y Utilities', 0.5], ['CGPA2', 'Energía y Utilities', 0.3],
  ['TXAR', 'Materiales e Industria', 1], ['ALUA', 'Materiales e Industria', 1.3],
  ['LOMA', 'Materiales e Industria', 1.5], ['FERR', 'Materiales e Industria', 0.4],
  ['AGRO', 'Materiales e Industria', 0.3],
  ['IRSA', 'Real Estate', 1.2], ['IRCP', 'Real Estate', 0.5], ['CRES', 'Real Estate', 0.7],
  ['MOLI', 'Consumo', 0.4], ['MIRG', 'Consumo', 0.6], ['LEDE', 'Consumo', 0.3],
  ['TECO2', 'Telecom y Medios', 1], ['CVH', 'Telecom y Medios', 0.3],
  ['COME', 'Holdings', 0.3], ['BOLT', 'Holdings', 0.15], ['RIGO', 'Holdings', 0.3]
];

async function getArHeatmapData() {
  const stocks = await fetchFeed('arg_stocks');
  const priceMap = new Map(stocks.map(r => [r.symbol, r]));
  return ARG_HEATMAP_LIST
    .map(([symbol, sector, marketCap]) => {
      const row = priceMap.get(symbol);
      if (!row) return null;
      return { symbol, sector, marketCap, price: row.c, pct_change: row.pct_change, tipo: 'accion' };
    })
    .filter(Boolean);
}

async function getGlobalHeatmapData() {
  const res = await fetch('/.netlify/functions/heatmap-global', { cache: 'no-store' });
  if (!res.ok) throw new Error('heatmap global failed: ' + res.status);
  const rows = await res.json();
  return rows.map(r => ({ ...r, tipo: 'global' }));
}

const CRYPTO_CATEGORY = {
  BTC: 'Mayores', ETH: 'Mayores',
  BNB: 'Layer 1', SOL: 'Layer 1', ADA: 'Layer 1', DOT: 'Layer 1',
  AVAX: 'Layer 1', ATOM: 'Layer 1', TRX: 'Layer 1', ETC: 'Layer 1',
  XRP: 'Pagos', LTC: 'Pagos', BCH: 'Pagos', XLM: 'Pagos',
  LINK: 'DeFi y Oráculos',
  DOGE: 'Meme', SHIB: 'Meme',
  MATIC: 'Escalado',
  USDT: 'Stablecoins', USDC: 'Stablecoins'
};

async function getCryptoHeatmapData() {
  const map = await getCryptoMap();
  return [...map.values()]
    .filter(c => c.marketCap > 0)
    .map(c => ({
      symbol: c.symbol,
      sector: CRYPTO_CATEGORY[c.symbol] || 'Otras',
      marketCap: c.marketCap,
      price: c.usd,
      pct_change: c.pct_change,
      tipo: 'cripto'
    }));
}

// Layout "squarified treemap" (Bruls, Huizing, van Wijk): acomoda `items`
// (necesitan .value > 0) dentro del rectangulo x,y,w,h intentando que cada
// caja quede lo mas cuadrada posible, en vez de tiras finitas. Devuelve los
// mismos items con .x/.y/.w/.h asignados.
function squarify(items, x, y, w, h) {
  const nodes = items.filter(i => i.value > 0).sort((a, b) => b.value - a.value);
  const total = nodes.reduce((s, n) => s + n.value, 0) || 1;
  const scale = (w * h) / total;
  nodes.forEach(n => { n._area = n.value * scale; });

  function worst(row, sideLen) {
    if (!row.length) return Infinity;
    const sum = row.reduce((s, n) => s + n._area, 0);
    const max = Math.max(...row.map(n => n._area));
    const min = Math.min(...row.map(n => n._area));
    const s2 = sideLen * sideLen;
    return Math.max((s2 * max) / (sum * sum), (sum * sum) / (s2 * min));
  }

  function layoutRow(row, rect) {
    const sum = row.reduce((s, n) => s + n._area, 0);
    const vertical = rect.w >= rect.h;
    const sideLen = vertical ? rect.h : rect.w;
    const thickness = sideLen > 0 ? sum / sideLen : 0;
    let offset = 0;
    row.forEach(n => {
      const len = thickness > 0 ? n._area / thickness : 0;
      if (vertical) { n.x = rect.x; n.y = rect.y + offset; n.w = thickness; n.h = len; }
      else { n.x = rect.x + offset; n.y = rect.y; n.w = len; n.h = thickness; }
      offset += len;
    });
    return vertical
      ? { x: rect.x + thickness, y: rect.y, w: Math.max(0, rect.w - thickness), h: rect.h }
      : { x: rect.x, y: rect.y + thickness, w: rect.w, h: Math.max(0, rect.h - thickness) };
  }

  let rect = { x, y, w, h };
  const remaining = nodes.slice();
  let row = [];
  while (remaining.length) {
    const sideLen = Math.min(rect.w, rect.h);
    const trial = [...row, remaining[0]];
    if (worst(row, sideLen) >= worst(trial, sideLen)) {
      row.push(remaining.shift());
    } else {
      rect = layoutRow(row, rect);
      row = [];
    }
  }
  if (row.length) layoutRow(row, rect);
  return nodes;
}

// Treemap de dos niveles: primero acomoda los sectores (peso = suma de sus
// items) en todo el lienzo, y adentro de cada caja de sector vuelve a
// aplicar squarify con sus items individuales, debajo de un header con el
// nombre del sector.
function heatColor(pct, scale) {
  scale = scale || 4;
  if (pct == null || isNaN(pct)) return 'rgba(139,152,169,0.25)';
  const clamped = Math.max(-scale, Math.min(scale, pct));
  const t = Math.abs(clamped) / scale;
  const alpha = 0.28 + t * 0.55;
  return clamped >= 0 ? `rgba(34,197,94,${alpha})` : `rgba(244,81,95,${alpha})`;
}

function renderTiles(items, offsetY, colorScale) {
  return items.map(it => {
    const tvTipo = it.tipo || 'accion';
    const showText = it.w > 40 && it.h > 26;
    return `
      <a class="hm-tile tk-link" data-ticker="${it.symbol}" data-tipo="${tvTipo}"
         href="${tvUrl(it.symbol, tvTipo)}" target="_blank" rel="noopener"
         style="left:${it.x}px;top:${it.y + offsetY}px;width:${it.w}px;height:${it.h}px;background:${heatColor(it.pct_change, colorScale)};">
        ${showText ? `<span class="hm-tk">${it.symbol}</span><span class="hm-pct">${fmtPct(it.pct_change)}</span>` : ''}
      </a>`;
  }).join('');
}

function buildTreemapHTML(sectorGroups, width, height, colorScale) {
  const HEADER_H = 24;
  const sectorNodes = sectorGroups.map(g => ({
    ...g, value: g.items.reduce((s, i) => s + i.marketCap, 0)
  }));
  squarify(sectorNodes, 0, 0, width, height);

  return sectorNodes.map(sector => {
    const innerH = Math.max(0, sector.h - HEADER_H);
    const items = sector.items.map(i => ({ ...i, value: i.marketCap }));
    squarify(items, 0, 0, sector.w, innerH);
    return `
      <div class="hm-sector" style="left:${sector.x}px;top:${sector.y}px;width:${sector.w}px;height:${sector.h}px;">
        <div class="hm-sector-head" style="width:${sector.w}px;">${sector.label}</div>
        ${renderTiles(items, HEADER_H, colorScale)}
      </div>`;
  }).join('');
}

// Sin agrupar por categoria/sector: todos los items en un unico treemap.
function buildFlatTreemapHTML(items, width, height, colorScale) {
  const nodes = items.map(i => ({ ...i, value: i.marketCap }));
  squarify(nodes, 0, 0, width, height);
  return renderTiles(nodes, 0, colorScale);
}

// Registro de la ultima llamada por chartId, para poder re-dibujar en
// resize con el ancho real del contenedor (ver historyResizeRedraw abajo).
const historyRenderRegistry = {};
let historyResizeInitialized = false;

function renderHistory(chartId, rangeId, points, pctId) {
  historyRenderRegistry[chartId] = { rangeId, points, pctId };
  if (!historyResizeInitialized) {
    historyResizeInitialized = true;
    let t = null;
    window.addEventListener('resize', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        Object.entries(historyRenderRegistry).forEach(([id, args]) => {
          if (document.getElementById(id)) renderHistory(id, args.rangeId, args.points, args.pctId);
        });
      }, 200);
    });
  }

  const chartEl = document.getElementById(chartId);
  const rangeEl = document.getElementById(rangeId);
  const pctEl = pctId ? document.getElementById(pctId) : null;
  if (points.length < 2) {
    chartEl.innerHTML = '<div class="empty-note">Todavía no hay suficiente historial para graficar la evolución — se guarda una foto por día, volvé en un par de días.</div>';
    if (rangeEl) rangeEl.textContent = '';
    if (pctEl) pctEl.textContent = '—';
    return;
  }
  const width = chartEl.clientWidth || 600;
  const height = Math.round(Math.min(140, Math.max(110, width * 0.24)));
  chartEl.innerHTML = buildLineChartSVG(points, width, height);
  attachChartHover(chartId, points, width, height);
  if (rangeEl) {
    const first = new Date(points[0].date + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
    const last = new Date(points[points.length - 1].date + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
    rangeEl.textContent = `${first} — ${last}`;
  }
  if (pctEl) {
    const periodPct = ((points[points.length - 1].value - points[0].value) / points[0].value) * 100;
    pctEl.textContent = fmtPct(periodPct);
    pctEl.className = 'history-pct-val ' + pctClass(periodPct);
  }
}

// Modal centrado genérico y reusable (el detalle de un día del calendario
// de earnings, la explicación de una variable macro, etc.) — se centra en
// pantalla en vez de anclarse a un elemento, asi se comporta igual en
// mobile y desktop sin necesitar layouts distintos por breakpoint.
let modalInitialized = false;
function initModal() {
  if (modalInitialized) return;
  modalInitialized = true;
  const backdrop = document.createElement('div');
  backdrop.id = 'sharedModalBackdrop';
  backdrop.className = 'modal-backdrop';
  const box = document.createElement('div');
  box.id = 'sharedModalBox';
  box.className = 'modal-box';
  document.body.appendChild(backdrop);
  document.body.appendChild(box);
  backdrop.addEventListener('click', closeModal);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
}

function openModal(html) {
  initModal();
  document.getElementById('sharedModalBox').innerHTML = html;
  document.getElementById('sharedModalBackdrop').classList.add('open');
  document.getElementById('sharedModalBox').classList.add('open');
}

function closeModal() {
  const backdrop = document.getElementById('sharedModalBackdrop');
  const box = document.getElementById('sharedModalBox');
  if (backdrop) backdrop.classList.remove('open');
  if (box) box.classList.remove('open');
}
