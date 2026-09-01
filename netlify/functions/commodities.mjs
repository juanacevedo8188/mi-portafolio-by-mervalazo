// Yahoo Finance no permite pedirse directo desde el navegador (no manda
// Access-Control-Allow-Origin), asi que esta funcion la llama del lado del
// servidor y le devuelve al sitio un JSON limpio, sin CORS de por medio.
//
// Pide 2 años de historial (no solo el ultimo mes) para poder calcular
// variacion semanal/mensual/YTD/interanual ademas de la diaria — todas
// buscando el cierre mas cercano a N dias calendario atras, no un indice
// fijo de posiciones (la cantidad de ruedas por semana/mes varia).

const SYMBOLS = [
  { ticker: 'CL=F', key: 'WTI', name: 'Oil WTI', grupo: 'Energía' },
  { ticker: 'BZ=F', key: 'BRENT', name: 'Brent', grupo: 'Energía' },
  { ticker: 'NG=F', key: 'NATGAS', name: 'Gas Natural', grupo: 'Energía' },
  { ticker: 'RB=F', key: 'GASOLINE', name: 'Gasolina', grupo: 'Energía' },
  { ticker: 'HO=F', key: 'HEATOIL', name: 'Heating Oil', grupo: 'Energía' },
  { ticker: 'GC=F', key: 'GOLD', name: 'Oro', grupo: 'Metales' },
  { ticker: 'SI=F', key: 'SILVER', name: 'Plata', grupo: 'Metales' },
  { ticker: 'HG=F', key: 'COPPER', name: 'Cobre', grupo: 'Metales' },
  { ticker: 'PL=F', key: 'PLATINUM', name: 'Platino', grupo: 'Metales' },
  { ticker: 'PA=F', key: 'PALLADIUM', name: 'Paladio', grupo: 'Metales' },
  { ticker: 'ZS=F', key: 'SOY', name: 'Soja', grupo: 'Agro' },
  { ticker: 'ZW=F', key: 'WHEAT', name: 'Trigo', grupo: 'Agro' },
  { ticker: 'ZC=F', key: 'CORN', name: 'Maíz', grupo: 'Agro' },
  { ticker: 'KC=F', key: 'COFFEE', name: 'Café', grupo: 'Agro' },
  { ticker: 'SB=F', key: 'SUGAR', name: 'Azúcar', grupo: 'Agro' },
  { ticker: 'CC=F', key: 'COCOA', name: 'Cacao', grupo: 'Agro' },
  { ticker: 'CT=F', key: 'COTTON', name: 'Algodón', grupo: 'Agro' }
];

// Ultimo indice cuyo timestamp es <= targetSec (asume timestamps ascendente).
// Si ninguno lo es, devuelve el primero disponible (mejor estimacion posible
// con el historial que hay, en vez de no mostrar nada).
function closestIndexBefore(timestamps, targetSec) {
  let idx = 0;
  for (let i = 0; i < timestamps.length; i++) {
    if (timestamps[i] <= targetSec) idx = i;
    else break;
  }
  return idx;
}

function pctChange(from, to) {
  return from ? ((to - from) / from) * 100 : null;
}

async function fetchOne(entry) {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(entry.ticker)}?interval=1d&range=2y`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (!res.ok) throw new Error('yahoo ' + res.status);
    const data = await res.json();
    const result = data.chart.result[0];
    const meta = result.meta;
    const rawCloses = result.indicators.quote[0].close || [];
    const rawTimestamps = result.timestamp || [];
    // Se filtran juntos (no closes.filter(...) solo) para que timestamps[i]
    // siga correspondiendo a closes[i] despues de sacar los huecos.
    const timestamps = [], closes = [];
    rawCloses.forEach((c, i) => {
      if (c != null) { closes.push(c); timestamps.push(rawTimestamps[i]); }
    });
    if (!closes.length) throw new Error('sin datos');

    const price = meta.regularMarketPrice;
    const nowSec = Math.floor(Date.now() / 1000);
    const jan1Sec = Date.UTC(new Date().getUTCFullYear(), 0, 1) / 1000;

    // meta.chartPreviousClose queda relativo al INICIO del rango pedido, no
    // al dia anterior real -- por eso el cierre previo se calcula a mano con
    // el anteultimo valor de la serie diaria, que si es de ayer.
    const prevClose = closes.length >= 2 ? closes[closes.length - 2] : null;
    const weekBase = closes[closestIndexBefore(timestamps, nowSec - 7 * 86400)];
    const monthBase = closes[closestIndexBefore(timestamps, nowSec - 30 * 86400)];
    const ytdBase = closes[closestIndexBefore(timestamps, jan1Sec)];
    const yoyBase = closes[closestIndexBefore(timestamps, nowSec - 365 * 86400)];

    return {
      key: entry.key,
      name: entry.name,
      grupo: entry.grupo,
      price,
      pct_change: pctChange(prevClose, price),
      weekPct: pctChange(weekBase, price),
      monthPct: pctChange(monthBase, price),
      ytdPct: pctChange(ytdBase, price),
      yoyPct: pctChange(yoyBase, price),
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
