// Backfill puntual (no programada) de portfolio_snapshots — el historial
// personal de cada usuario. Mismo motivo y mismo método que
// backfill-community-history.mjs: el cron diario nunca había corrido por
// falta de SUPABASE_SERVICE_ROLE_KEY, así que reconstruye los últimos días
// aplicando las tenencias actuales de cada usuario sobre precios históricos
// reales de Yahoo Finance (BCBA, sufijo .BA).
//
// Limitación conocida: las posiciones en cripto no tienen un equivalente
// ".BA" con historial diario gratis, así que para esos días quedan
// valuadas al precio de compra (sin variación) — igual que ya hace el cron
// diario existente para cripto, no es peor de lo que había.

const DATES = ['2026-08-21', '2026-08-24', '2026-08-25', '2026-08-26'];
const SUPABASE_URL = 'https://rdpwpcgaarbnpotxcvzz.supabase.co';

async function fetchHistory(ticker) {
  try {
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
  } catch {
    return new Map();
  }
}

export default async () => {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return new Response('Falta la variable de entorno SUPABASE_SERVICE_ROLE_KEY en Netlify', { status: 500 });
  }
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

  const holdingsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/holdings?select=user_id,ticker,tipo,cantidad,precio_compra`,
    { headers }
  );
  const allHoldings = await holdingsRes.json();
  if (!Array.isArray(allHoldings) || !allHoldings.length) {
    return new Response(JSON.stringify({ ok: true, users: 0, note: 'sin tenencias personales cargadas' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const tickersToFetch = [...new Set(
    allHoldings.filter(h => h.tipo === 'accion' || h.tipo === 'cedear').map(h => h.ticker)
  )];
  const priceMaps = new Map();
  for (const t of tickersToFetch) priceMaps.set(t, await fetchHistory(t));

  const byUser = new Map();
  allHoldings.forEach(h => {
    if (!byUser.has(h.user_id)) byUser.set(h.user_id, []);
    byUser.get(h.user_id).push(h);
  });

  const rows = [];
  byUser.forEach((holdings, user_id) => {
    const totalCost = holdings.reduce((s, h) => s + h.precio_compra * h.cantidad, 0);
    DATES.forEach(date => {
      const totalValue = holdings.reduce((s, h) => {
        const map = priceMaps.get(h.ticker);
        const price = (map && map.get(date)) ?? h.precio_compra;
        return s + price * h.cantidad;
      }, 0);
      rows.push({ user_id, snapshot_date: date, total_value: totalValue, total_cost: totalCost });
    });
  });

  const res = await fetch(`${SUPABASE_URL}/rest/v1/portfolio_snapshots?on_conflict=user_id,snapshot_date`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify(rows)
  });

  return new Response(JSON.stringify({ ok: res.ok, status: res.status, users: byUser.size, rowsWritten: rows.length }), {
    headers: { 'Content-Type': 'application/json' }
  });
};
