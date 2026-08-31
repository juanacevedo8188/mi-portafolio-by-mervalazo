// Precios en vivo (acciones/CEDEARs + cripto + letras) para las funciones
// serverless (.mjs) que necesitan valuar holdings del lado del servidor.
// Es la contraparte de getPriceMap()/getCryptoMap()/getLetraPriceMap() en
// market.js (uso del navegador) — se duplica en vez de importarse porque
// una funcion serverless no puede cargar ese script pensado para browser.

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

export async function getUsdArsRate() {
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
    if (entry) map.set(entry.symbol, { c: coin.current_price * usdArsRate, usd: coin.current_price, pct_change: coin.price_change_percentage_24h });
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
    if (q && q.c) map.set(l.ticker, { c: q.c, pct_change: q.pct_change });
  });
  return map;
}

// Mapa symbol/ticker -> {c, pct_change, usd?} combinando acciones,
// CEDEARs, cripto (en ARS via MEP) y letras vigentes. cryptoMap/letraMap
// se resuelven con Promise.allSettled: si CoinGecko o argentinadatos
// fallan, el resto de la valuacion sigue andando igual (esas posiciones
// simplemente no matchean y quedan sin precio en vez de tirar abajo todo
// el calculo).
export async function getFullPriceMap() {
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
  return priceMap;
}
