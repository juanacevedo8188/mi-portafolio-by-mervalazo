import PORTFOLIO from '../../portfolio.js';

const SUPABASE_URL = 'https://rdpwpcgaarbnpotxcvzz.supabase.co';

// Mismas listas/fuentes que getCryptoMap()/getLetraPriceMap() en market.js
// (uso del navegador) — se duplican acá porque esta funcion serverless no
// puede importar ese script de browser. Sin esto, cualquier holding de
// tipo 'cripto' o 'letra' no aparecia en priceMap y caia al fallback de
// abajo (precio_compra, el costo original) en vez del precio de mercado
// del dia — asi la "Evolucion" de esos usuarios quedaba congelada, sin
// reflejar ningun movimiento real dia a dia.
const CRYPTO_LIST = [
  { id: 'bitcoin', symbol: 'BTC' }, { id: 'ethereum', symbol: 'ETH' },
  { id: 'binancecoin', symbol: 'BNB' }, { id: 'ripple', symbol: 'XRP' },
  { id: 'solana', symbol: 'SOL' }, { id: 'cardano', symbol: 'ADA' },
  { id: 'dogecoin', symbol: 'DOGE' }, { id: 'tron', symbol: 'TRX' },
  { id: 'polkadot', symbol: 'DOT' }, { id: 'avalanche-2', symbol: 'AVAX' },
  { id: 'chainlink', symbol: 'LINK' }, { id: 'litecoin', symbol: 'LTC' },
  { id: 'bitcoin-cash', symbol: 'BCH' }, { id: 'cosmos', symbol: 'ATOM' },
  { id: 'ethereum-classic', symbol: 'ETC' }, { id: 'stellar', symbol: 'XLM' },
  { id: 'shiba-inu', symbol: 'SHIB' }, { id: 'matic-network', symbol: 'MATIC' },
  { id: 'tether', symbol: 'USDT' }, { id: 'usd-coin', symbol: 'USDC' }
];

async function getUsdArsRate() {
  const data = await fetch('https://data912.com/live/mep').then(r => r.json());
  const rates = data.map(d => d.close).filter(v => typeof v === 'number' && v > 0);
  if (!rates.length) throw new Error('sin datos de dólar MEP');
  return rates.reduce((s, v) => s + v, 0) / rates.length;
}

async function getCryptoMap() {
  const ids = CRYPTO_LIST.map(c => c.id).join(',');
  const [data, usdArsRate] = await Promise.all([
    fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=' + ids).then(r => r.json()),
    getUsdArsRate()
  ]);
  const map = new Map();
  data.forEach(coin => {
    const entry = CRYPTO_LIST.find(c => c.id === coin.id);
    if (entry) map.set(entry.symbol, { c: coin.current_price * usdArsRate });
  });
  return map;
}

async function getLetraMap() {
  const [letras, notes, bonds] = await Promise.all([
    fetch('https://api.argentinadatos.com/v1/finanzas/letras').then(r => r.json()),
    fetch('https://data912.com/live/arg_notes').then(r => r.json()),
    fetch('https://data912.com/live/arg_bonds').then(r => r.json())
  ]);
  const priceMap = new Map();
  [...notes, ...bonds].forEach(row => priceMap.set(row.symbol, row));
  const map = new Map();
  letras.forEach(l => {
    const q = priceMap.get(l.ticker);
    if (q && q.c) map.set(l.ticker, { c: q.c });
  });
  return map;
}

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

  const [stocks, cedears, cryptoMap, letraMap] = await Promise.all([
    fetch('https://data912.com/live/arg_stocks').then(r => r.json()),
    fetch('https://data912.com/live/arg_cedears').then(r => r.json()),
    getCryptoMap().catch(err => { console.error('cripto', err); return new Map(); }),
    getLetraMap().catch(err => { console.error('letras', err); return new Map(); })
  ]);
  const priceMap = new Map();
  [...stocks, ...cedears].forEach(row => priceMap.set(row.symbol, row));
  cryptoMap.forEach((v, k) => priceMap.set(k, v));
  letraMap.forEach((v, k) => priceMap.set(k, v));

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
