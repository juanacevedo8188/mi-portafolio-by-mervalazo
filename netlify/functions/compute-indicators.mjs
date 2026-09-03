// Recalcula indicadores técnicos (SMA50, EMA200, RSI14, 52 semanas, volumen
// y un score propio 0-100) para un universo curado de tickers líquidos, y
// los guarda en Supabase (technical_indicators) para que analisis-tecnico.html
// los lea sin tener que golpear Yahoo Finance ni recalcular nada en vivo.
//
// Universo acotado a propósito (no los 200+ de Buscar): calcular esto en
// vivo para todo ese universo sería pesado y lento. Se eligieron los
// nombres de EEUU más líquidos por sector (mismo criterio que
// heatmap-global.mjs) más los ADRs argentinos más seguidos por la
// comunidad — son, en su mayoría, los mismos subyacentes de los CEDEARs
// más operados localmente.

const SUPABASE_URL = 'https://rdpwpcgaarbnpotxcvzz.supabase.co';

const TICKERS = [
  ['AAPL', 'Tecnología'], ['MSFT', 'Tecnología'], ['NVDA', 'Tecnología'], ['GOOGL', 'Tecnología'],
  ['META', 'Tecnología'], ['AMD', 'Tecnología'], ['AVGO', 'Tecnología'], ['ORCL', 'Tecnología'],
  ['CRM', 'Tecnología'], ['ADBE', 'Tecnología'], ['CSCO', 'Tecnología'], ['QCOM', 'Tecnología'],
  ['AMZN', 'Consumo Cíclico'], ['TSLA', 'Consumo Cíclico'], ['HD', 'Consumo Cíclico'],
  ['NKE', 'Consumo Cíclico'], ['MCD', 'Consumo Cíclico'], ['SBUX', 'Consumo Cíclico'],
  ['DIS', 'Comunicación'], ['NFLX', 'Comunicación'],
  ['KO', 'Consumo Defensivo'], ['PEP', 'Consumo Defensivo'], ['WMT', 'Consumo Defensivo'], ['PG', 'Consumo Defensivo'],
  ['JPM', 'Financiero'], ['V', 'Financiero'], ['MA', 'Financiero'], ['BAC', 'Financiero'], ['GS', 'Financiero'],
  ['JNJ', 'Salud'], ['UNH', 'Salud'], ['PFE', 'Salud'], ['ABBV', 'Salud'], ['MRK', 'Salud'],
  ['BA', 'Industrial'], ['CAT', 'Industrial'], ['GE', 'Industrial'],
  ['XOM', 'Energía'], ['CVX', 'Energía'],
  ['GGAL', 'Argentina'], ['BMA', 'Argentina'], ['SUPV', 'Argentina'], ['YPF', 'Argentina'],
  ['PAM', 'Argentina'], ['TGS', 'Argentina'], ['EDN', 'Argentina'], ['CRESY', 'Argentina'],
  ['IRS', 'Argentina'], ['LOMA', 'Argentina'], ['TX', 'Argentina'], ['VIST', 'Argentina']
];

function sma(values, period) {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

// EMA sembrada con la SMA de los primeros `period` valores, aplicada hacia
// adelante -- el metodo estandar cuando se tiene la serie completa (no un
// stream en vivo que necesite arrancar en el primer dato disponible).
function ema(values, period) {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  let val = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) {
    val = values[i] * k + val * (1 - k);
  }
  return val;
}

// RSI de Wilder: promedio simple de ganancias/perdidas en los primeros
// `period` cambios, despues suavizado exponencial (factor 1/period) el
// resto de la serie.
function rsi(values, period) {
  if (values.length < period + 1) return null;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) avgGain += diff; else avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;
  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

// Score propio 0-100 (no es el de ningun servicio de terceros): 40pts de
// tendencia (precio vs. SMA50/EMA200), 30pts de momentum (RSI mapeado
// 30->0, 70->30), 20pts de posicion dentro del rango de 52 semanas, y
// 10pts extra si hay volumen inusual (>1.5x el promedio) acompañando una
// suba -- confirmacion, no solo ruido.
function computeScore({ price, sma50, ema200, rsi14, hi52, lo52, volRatio, pctChange }) {
  let score = 0;
  if (sma50 != null && price > sma50) score += 20;
  if (ema200 != null && price > ema200) score += 20;
  if (rsi14 != null) score += Math.max(0, Math.min(30, ((rsi14 - 30) / 40) * 30));
  if (hi52 != null && lo52 != null && hi52 > lo52) {
    score += Math.max(0, Math.min(1, (price - lo52) / (hi52 - lo52))) * 20;
  }
  if (volRatio != null && volRatio > 1.5 && pctChange > 0) score += 10;
  return Math.round(Math.max(0, Math.min(100, score)));
}

async function fetchOne([ticker, sector]) {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1y`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (!res.ok) throw new Error('yahoo ' + res.status);
    const data = await res.json();
    const result = data.chart.result[0];
    const meta = result.meta;
    const rawCloses = result.indicators.quote[0].close || [];
    const rawVolumes = result.indicators.quote[0].volume || [];
    const closes = [], volumes = [];
    rawCloses.forEach((c, i) => {
      if (c != null) { closes.push(c); volumes.push(rawVolumes[i] || 0); }
    });
    if (closes.length < 60) throw new Error('historial insuficiente');

    const price = meta.regularMarketPrice;
    const prevClose = closes.length >= 2 ? closes[closes.length - 2] : null;
    const pctChange = prevClose ? ((price - prevClose) / prevClose) * 100 : null;
    const sma50 = sma(closes, 50);
    const ema200 = ema(closes, 200);
    const rsi14 = rsi(closes, 14);
    const hi52 = Math.max(...closes);
    const lo52 = Math.min(...closes);
    const avgVol20 = volumes.length > 1 ? sma(volumes.slice(0, -1), Math.min(20, volumes.length - 1)) : null;
    const volRatio = avgVol20 ? volumes[volumes.length - 1] / avgVol20 : null;

    return {
      ticker,
      nombre: meta.shortName || ticker,
      sector,
      precio: price,
      pct_change: pctChange,
      sma50,
      ema200,
      rsi14,
      semana52_max: hi52,
      semana52_min: lo52,
      volumen_ratio: volRatio,
      score: computeScore({ price, sma50, ema200, rsi14, hi52, lo52, volRatio, pctChange }),
      updated_at: new Date().toISOString()
    };
  } catch (err) {
    return null;
  }
}

export default async () => {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return new Response('Falta la variable de entorno SUPABASE_SERVICE_ROLE_KEY en Netlify', { status: 500 });
  }

  const rows = (await Promise.all(TICKERS.map(fetchOne))).filter(Boolean);

  if (rows.length) {
    await fetch(`${SUPABASE_URL}/rest/v1/technical_indicators?on_conflict=ticker`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify(rows)
    });
  }

  return new Response(JSON.stringify({ ok: true, count: rows.length, total: TICKERS.length }), {
    headers: { 'Content-Type': 'application/json' }
  });
};

export const config = { schedule: '0 21 * * 1-5' };
