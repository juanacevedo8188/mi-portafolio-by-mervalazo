// Proxy server-side a la API interna de bonistas.com para los bonos donde
// todavia no tenemos el cronograma propio verificado (TX28, DICP, PARP,
// CUAP, Boncer cupon cero, TAMAR) — bonistas.com no manda
// Access-Control-Allow-Origin, asi que el navegador no puede pedirselo
// directo; esta funcion lo llama del lado del servidor y devuelve solo
// los campos que usamos.
//
// Es una API interna no documentada de un tercero, no un feed oficial —
// puede cambiar de forma sin aviso. Si un ticker falla, se devuelve null
// para ese ticker en vez de romper el resto.

async function fetchOne(ticker) {
  try {
    const res = await fetch(`https://bonistas.com/api/bond/${encodeURIComponent(ticker)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    if (!res.ok) return [ticker, null];
    const data = await res.json();
    const b = data.bond;
    if (!b) return [ticker, null];
    return [ticker, {
      fairValue: b.fair_value ?? null,
      parity: b.parity != null ? b.parity * 100 : null,
      tir: b.tir != null ? b.tir * 100 : null,
      modifiedDuration: b.modified_duration ?? null,
      lastPrice: b.last_price ?? null
    }];
  } catch {
    return [ticker, null];
  }
}

export default async (req) => {
  const url = new URL(req.url);
  const tickers = (url.searchParams.get('tickers') || '').split(',').map(t => t.trim()).filter(Boolean);
  if (!tickers.length) {
    return new Response(JSON.stringify({ error: 'falta el parametro tickers' }), { status: 400 });
  }
  const results = await Promise.all(tickers.map(fetchOne));
  const byTicker = {};
  results.forEach(([ticker, data]) => { byTicker[ticker] = data; });
  return new Response(JSON.stringify(byTicker), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' }
  });
};
