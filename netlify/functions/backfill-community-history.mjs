// Backfill puntual (no programada, se invoca a mano una sola vez) para
// completar community_snapshots con los días previos a que el cron diario
// (snapshot-portfolios.mjs) empezara a correr. Reconstruye el valor de la
// cartera en cada fecha aplicando las TENENCIAS ACTUALES sobre precios
// históricos reales — es una aproximación: si la composición cambió antes
// de estas fechas, no lo refleja.
import PORTFOLIO from '../../portfolio.js';

const DATES = ['2026-08-21', '2026-08-24', '2026-08-25', '2026-08-26'];

async function fetchHistory(ticker) {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}.BA?interval=1d&range=5d`,
    { headers: { 'User-Agent': 'Mozilla/5.0' } }
  );
  if (!res.ok) return new Map();
  const data = await res.json();
  const result = data.chart.result && data.chart.result[0];
  if (!result) return new Map();
  const closes = result.indicators.quote[0].close;
  const map = new Map();
  result.timestamp.forEach((ts, i) => {
    if (closes[i] == null) return;
    const date = new Date(ts * 1000).toISOString().slice(0, 10);
    map.set(date, closes[i]);
  });
  return map;
}

// VIST.BA tiene muy poca historia en Yahoo (solo el precio de hoy). Como
// anclas usamos el precio de compra promedio (≈ viernes 21/08) y el precio
// real de hoy, interpolando linealmente los días intermedios.
function interpolate(dates, startVal, endVal) {
  const map = new Map();
  dates.forEach((d, i) => {
    const t = dates.length > 1 ? i / (dates.length - 1) : 0;
    map.set(d, startVal + (endVal - startVal) * t);
  });
  return map;
}

export default async () => {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return new Response('Falta la variable de entorno SUPABASE_SERVICE_ROLE_KEY en Netlify', { status: 500 });
  }
  const SUPABASE_URL = 'https://rdpwpcgaarbnpotxcvzz.supabase.co';

  const priceMaps = new Map();
  for (const h of PORTFOLIO.holdings) {
    if (h.ticker === 'VIST') continue;
    priceMaps.set(h.ticker, await fetchHistory(h.ticker));
  }

  const vist = PORTFOLIO.holdings.find(h => h.ticker === 'VIST');
  if (vist) {
    const vistToday = await fetchHistory('VIST');
    const todayClose = vistToday.get(DATES[DATES.length - 1]) ?? vist.precioCompra;
    priceMaps.set('VIST', interpolate(DATES, vist.precioCompra, todayClose));
  }

  const totalCost = PORTFOLIO.holdings.reduce((s, h) => s + h.precioCompra * h.cantidad, 0);

  const rows = DATES.map(date => {
    const totalValue = PORTFOLIO.holdings.reduce((s, h) => {
      const map = priceMaps.get(h.ticker);
      const price = (map && map.get(date)) ?? h.precioCompra;
      return s + price * h.cantidad;
    }, 0);
    return { snapshot_date: date, total_value: totalValue, total_cost: totalCost };
  });

  const res = await fetch(`${SUPABASE_URL}/rest/v1/community_snapshots?on_conflict=snapshot_date`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates'
    },
    body: JSON.stringify(rows)
  });

  return new Response(JSON.stringify({ ok: res.ok, status: res.status, rows }), {
    headers: { 'Content-Type': 'application/json' }
  });
};
