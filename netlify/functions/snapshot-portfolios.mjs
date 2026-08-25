import PORTFOLIO from '../../portfolio.js';

const SUPABASE_URL = 'https://rdpwpcgaarbnpotxcvzz.supabase.co';

function computeTotals(holdings, priceMap) {
  return holdings.reduce((acc, h) => {
    const q = priceMap.get(h.ticker);
    const price = q ? q.c : (h.precio_compra ?? h.precioCompra);
    const compra = h.precio_compra ?? h.precioCompra;
    acc.value += price * h.cantidad;
    acc.cost += compra * h.cantidad;
    return acc;
  }, { value: 0, cost: 0 });
}

export default async () => {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return new Response('Falta la variable de entorno SUPABASE_SERVICE_ROLE_KEY en Netlify', { status: 500 });
  }

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates'
  };

  const today = new Date().toISOString().slice(0, 10);

  const [stocks, cedears] = await Promise.all([
    fetch('https://data912.com/live/arg_stocks').then(r => r.json()),
    fetch('https://data912.com/live/arg_cedears').then(r => r.json())
  ]);
  const priceMap = new Map();
  [...stocks, ...cedears].forEach(row => priceMap.set(row.symbol, row));

  const communityTotals = computeTotals(PORTFOLIO.holdings, priceMap);
  await fetch(`${SUPABASE_URL}/rest/v1/community_snapshots?on_conflict=snapshot_date`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      snapshot_date: today,
      total_value: communityTotals.value,
      total_cost: communityTotals.cost
    })
  });

  const holdingsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/holdings?select=user_id,ticker,cantidad,precio_compra`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  );
  const allHoldings = await holdingsRes.json();

  const byUser = new Map();
  (Array.isArray(allHoldings) ? allHoldings : []).forEach(h => {
    if (!byUser.has(h.user_id)) byUser.set(h.user_id, []);
    byUser.get(h.user_id).push(h);
  });

  const userSnapshots = [...byUser.entries()].map(([user_id, holdings]) => {
    const totals = computeTotals(holdings, priceMap);
    return { user_id, snapshot_date: today, total_value: totals.value, total_cost: totals.cost };
  });

  if (userSnapshots.length) {
    await fetch(`${SUPABASE_URL}/rest/v1/portfolio_snapshots?on_conflict=user_id,snapshot_date`, {
      method: 'POST',
      headers,
      body: JSON.stringify(userSnapshots)
    });
  }

  return new Response(JSON.stringify({
    ok: true,
    date: today,
    community: communityTotals,
    users: userSnapshots.length
  }), { headers: { 'Content-Type': 'application/json' } });
};

export const config = { schedule: '0 21 * * 1-5' };
