// La API pública de earnings de Nasdaq no manda Access-Control-Allow-Origin,
// asi que esta funcion la llama del lado del servidor. Es por dia (no por
// rango), asi que se pide un dia a la vez para todo el mes actual en
// paralelo y se arma un solo JSON agrupado por fecha.
// Cobertura: empresas que cotizan en EEUU (por eso sirve sobre todo para
// las que además tienen CEDEAR) — no hay calendario de balances gratuito
// para empresas que solo cotizan en ByMA.

function daysInCurrentMonth() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const dates = [];
  for (let d = 1; d <= lastDay; d++) {
    const date = new Date(Date.UTC(year, month, d));
    const dow = date.getUTCDay();
    if (dow === 0 || dow === 6) continue; // sin sabado/domingo
    dates.push(date.toISOString().slice(0, 10));
  }
  return dates;
}

function parseMarketCap(str) {
  if (!str || str === 'N/A') return 0;
  return parseInt(str.replace(/[$,]/g, ''), 10) || 0;
}

async function fetchDay(date) {
  try {
    const res = await fetch(`https://api.nasdaq.com/api/calendar/earnings?date=${date}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'application/json' }
    });
    if (!res.ok) return [date, []];
    const data = await res.json();
    const rows = (data.data && data.data.rows) || [];
    const top = rows
      .map(r => ({ symbol: r.symbol, name: r.name, marketCap: parseMarketCap(r.marketCap), time: r.time, epsForecast: r.epsForecast }))
      .filter(r => r.symbol && r.marketCap > 0)
      .sort((a, b) => b.marketCap - a.marketCap)
      .slice(0, 8);
    return [date, top];
  } catch {
    return [date, []];
  }
}

export default async () => {
  const dates = daysInCurrentMonth();
  const results = await Promise.all(dates.map(fetchDay));
  const byDate = {};
  results.forEach(([date, rows]) => { if (rows.length) byDate[date] = rows; });
  return new Response(JSON.stringify(byDate), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=1800' }
  });
};
