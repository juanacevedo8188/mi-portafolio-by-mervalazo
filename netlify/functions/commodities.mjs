// Yahoo Finance no permite pedirse directo desde el navegador (no manda
// Access-Control-Allow-Origin), asi que esta funcion la llama del lado del
// servidor y le devuelve al sitio un JSON limpio, sin CORS de por medio.

const SYMBOLS = [
  { ticker: 'CL=F', key: 'WTI', name: 'Oil WTI', grupo: 'Energía' },
  { ticker: 'BZ=F', key: 'BRENT', name: 'Brent', grupo: 'Energía' },
  { ticker: 'RB=F', key: 'GASOLINE', name: 'Gasolina', grupo: 'Energía' },
  { ticker: 'GC=F', key: 'GOLD', name: 'Oro', grupo: 'Metales' },
  { ticker: 'SI=F', key: 'SILVER', name: 'Plata', grupo: 'Metales' },
  { ticker: 'HG=F', key: 'COPPER', name: 'Cobre', grupo: 'Metales' },
  { ticker: 'ZS=F', key: 'SOY', name: 'Soja', grupo: 'Agro' },
  { ticker: 'ZW=F', key: 'WHEAT', name: 'Trigo', grupo: 'Agro' },
  { ticker: 'ZC=F', key: 'CORN', name: 'Maíz', grupo: 'Agro' }
];

async function fetchOne(entry) {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(entry.ticker)}?interval=1d&range=1mo`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (!res.ok) throw new Error('yahoo ' + res.status);
    const data = await res.json();
    const result = data.chart.result[0];
    const meta = result.meta;
    const closes = (result.indicators.quote[0].close || []).filter(v => v != null);
    const price = meta.regularMarketPrice;
    // meta.chartPreviousClose queda relativo al INICIO del rango pedido (acá 1
    // mes), no al dia anterior real -- por eso el cierre previo se calcula a
    // mano con el anteultimo valor de la serie diaria, que si es de ayer.
    const prevClose = closes.length >= 2 ? closes[closes.length - 2] : null;
    return {
      key: entry.key,
      name: entry.name,
      grupo: entry.grupo,
      price,
      pct_change: prevClose ? ((price - prevClose) / prevClose) * 100 : null,
      unidad: meta.currency,
      sparkline: closes.slice(-20)
    };
  } catch (err) {
    return { key: entry.key, name: entry.name, grupo: entry.grupo, error: true };
  }
}

export default async () => {
  const data = await Promise.all(SYMBOLS.map(fetchOne));
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=45'
    }
  });
};
