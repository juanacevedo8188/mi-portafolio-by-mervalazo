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
