// Recalcula un score tecnico de 0-100 (propio, no replica ningun servicio
// de terceros) para un universo curado de tickers liquidos, y lo guarda en
// Supabase para que analisis-tecnico.html lo lea sin golpear Yahoo Finance
// ni recalcular nada en vivo.
//
// El score se arma en 5 categorias, cada una con su propia formula:
//
//  - Tendencia (0-20): 4 condiciones estilo "Trend Template" de Minervini
//    (precio > SMA50 > EMA200, EMA200 en alza, cerca del maximo de 52
//    semanas), 5pts cada una.
//  - Fuerza RS (0-25): percentil del retorno de 6 meses del ticker DENTRO
//    de este mismo universo (no contra todo el mercado de EEUU) -- estilo
//    RS Rating de IBD pero con nuestra propia base de comparacion.
//  - Contraccion (0-35): rango diario promedio (high-low/close) de las
//    ultimas 10 ruedas comparado contra el de las ultimas 50 -- cuanto mas
//    se "achica" la volatilidad reciente, mas puntos (volatility
//    contraction pattern).
//  - Setup (0-20): que tan cerca esta el precio del maximo de las ultimas
//    20 ruedas -- la lectura de "armando una base para romper".
//  - Penalizaciones (negativo): -1 por cada "distribution day" (baja de
//    >0.2% con volumen mayor al dia anterior) en las ultimas 20 ruedas,
//    tope -8, mas -3 si hubo una caida de un dia >7% en las ultimas 10.
//
// Universo acotado a ~170 nombres (no los 200+ de Buscar): calcular esto
// en vivo para todo ese universo en cada carga de pagina seria pesado y
// lento -- por eso se precalcula 1 vez por dia y se guarda.

const SUPABASE_URL = 'https://rdpwpcgaarbnpotxcvzz.supabase.co';

const TICKERS = [
  // Tecnología
  ['AAPL', 'Tecnología'], ['MSFT', 'Tecnología'], ['NVDA', 'Tecnología'], ['GOOGL', 'Tecnología'],
  ['META', 'Tecnología'], ['AMD', 'Tecnología'], ['AVGO', 'Tecnología'], ['ORCL', 'Tecnología'],
  ['CRM', 'Tecnología'], ['ADBE', 'Tecnología'], ['CSCO', 'Tecnología'], ['QCOM', 'Tecnología'],
  ['INTC', 'Tecnología'], ['TXN', 'Tecnología'], ['MU', 'Tecnología'], ['AMAT', 'Tecnología'],
  ['LRCX', 'Tecnología'], ['PANW', 'Tecnología'], ['NOW', 'Tecnología'], ['INTU', 'Tecnología'],
  ['SNOW', 'Tecnología'], ['CRWD', 'Tecnología'], ['NET', 'Tecnología'], ['SHOP', 'Tecnología'],
  ['PLTR', 'Tecnología'], ['DELL', 'Tecnología'], ['HPQ', 'Tecnología'], ['MRVL', 'Tecnología'],
  ['WDAY', 'Tecnología'], ['ADSK', 'Tecnología'], ['TEAM', 'Tecnología'], ['DDOG', 'Tecnología'],
  ['ZM', 'Tecnología'], ['SPOT', 'Tecnología'], ['XYZ', 'Tecnología'], ['PYPL', 'Tecnología'],
  ['COIN', 'Tecnología'], ['MSTR', 'Tecnología'], ['SMCI', 'Tecnología'], ['ASML', 'Tecnología'],
  ['TSM', 'Tecnología'], ['IBM', 'Tecnología'],
  // Consumo Cíclico
  ['AMZN', 'Consumo Cíclico'], ['TSLA', 'Consumo Cíclico'], ['HD', 'Consumo Cíclico'],
  ['NKE', 'Consumo Cíclico'], ['MCD', 'Consumo Cíclico'], ['SBUX', 'Consumo Cíclico'],
  ['LOW', 'Consumo Cíclico'], ['TGT', 'Consumo Cíclico'], ['BKNG', 'Consumo Cíclico'],
  ['MAR', 'Consumo Cíclico'], ['RCL', 'Consumo Cíclico'], ['CCL', 'Consumo Cíclico'],
  ['GM', 'Consumo Cíclico'], ['F', 'Consumo Cíclico'], ['RIVN', 'Consumo Cíclico'],
  ['LULU', 'Consumo Cíclico'], ['ROST', 'Consumo Cíclico'], ['TJX', 'Consumo Cíclico'],
  ['EBAY', 'Consumo Cíclico'], ['ETSY', 'Consumo Cíclico'], ['DASH', 'Consumo Cíclico'],
  ['CMG', 'Consumo Cíclico'], ['UBER', 'Consumo Cíclico'], ['ABNB', 'Consumo Cíclico'],
  // Comunicación
  ['DIS', 'Comunicación'], ['NFLX', 'Comunicación'], ['CMCSA', 'Comunicación'],
  ['TMUS', 'Comunicación'], ['WBD', 'Comunicación'], ['TTWO', 'Comunicación'],
  // Consumo Defensivo
  ['KO', 'Consumo Defensivo'], ['PEP', 'Consumo Defensivo'], ['WMT', 'Consumo Defensivo'],
  ['PG', 'Consumo Defensivo'], ['COST', 'Consumo Defensivo'], ['CL', 'Consumo Defensivo'],
  ['MDLZ', 'Consumo Defensivo'], ['KHC', 'Consumo Defensivo'], ['GIS', 'Consumo Defensivo'],
  ['KMB', 'Consumo Defensivo'], ['STZ', 'Consumo Defensivo'], ['MNST', 'Consumo Defensivo'],
  // Financiero
  ['JPM', 'Financiero'], ['V', 'Financiero'], ['MA', 'Financiero'], ['BAC', 'Financiero'],
  ['GS', 'Financiero'], ['AXP', 'Financiero'], ['SCHW', 'Financiero'], ['BLK', 'Financiero'],
  ['SPGI', 'Financiero'], ['MS', 'Financiero'], ['C', 'Financiero'], ['USB', 'Financiero'],
  ['PNC', 'Financiero'], ['COF', 'Financiero'], ['AIG', 'Financiero'], ['MET', 'Financiero'],
  ['ICE', 'Financiero'], ['CME', 'Financiero'],
  // Salud
  ['JNJ', 'Salud'], ['UNH', 'Salud'], ['PFE', 'Salud'], ['ABBV', 'Salud'], ['MRK', 'Salud'],
  ['LLY', 'Salud'], ['TMO', 'Salud'], ['ABT', 'Salud'], ['DHR', 'Salud'], ['ISRG', 'Salud'],
  ['GILD', 'Salud'], ['VRTX', 'Salud'], ['REGN', 'Salud'], ['CVS', 'Salud'], ['CI', 'Salud'],
  ['BSX', 'Salud'], ['SYK', 'Salud'], ['MDT', 'Salud'], ['ZTS', 'Salud'], ['BMY', 'Salud'],
  // Industrial
  ['BA', 'Industrial'], ['CAT', 'Industrial'], ['GE', 'Industrial'], ['HON', 'Industrial'],
  ['RTX', 'Industrial'], ['LMT', 'Industrial'], ['UNP', 'Industrial'], ['DE', 'Industrial'],
  ['ETN', 'Industrial'], ['ITW', 'Industrial'], ['MMM', 'Industrial'], ['EMR', 'Industrial'],
  ['CSX', 'Industrial'], ['FDX', 'Industrial'], ['UPS', 'Industrial'], ['WM', 'Industrial'],
  // Energía
  ['XOM', 'Energía'], ['CVX', 'Energía'], ['SLB', 'Energía'], ['EOG', 'Energía'],
  ['COP', 'Energía'], ['PSX', 'Energía'], ['MPC', 'Energía'], ['VLO', 'Energía'],
  ['OXY', 'Energía'], ['WMB', 'Energía'], ['KMI', 'Energía'],
  // Materiales
  ['LIN', 'Materiales'], ['APD', 'Materiales'], ['SHW', 'Materiales'], ['ECL', 'Materiales'],
  ['NEM', 'Materiales'], ['FCX', 'Materiales'],
  // Utilities
  ['NEE', 'Utilities'], ['DUK', 'Utilities'], ['SO', 'Utilities'], ['D', 'Utilities'],
  ['AEP', 'Utilities'], ['EXC', 'Utilities'], ['SRE', 'Utilities'],
  // Argentina (ADRs, subyacente de los CEDEARs mas seguidos localmente)
  ['GGAL', 'Argentina'], ['BMA', 'Argentina'], ['SUPV', 'Argentina'], ['YPF', 'Argentina'],
  ['PAM', 'Argentina'], ['TGS', 'Argentina'], ['EDN', 'Argentina'], ['CRESY', 'Argentina'],
  ['IRS', 'Argentina'], ['LOMA', 'Argentina'], ['TX', 'Argentina'], ['VIST', 'Argentina'],
  ['MELI', 'Argentina'], ['GLOB', 'Argentina']
];

function sma(values, period) {
  if (values.length < period) return null;
  return values.slice(-period).reduce((a, b) => a + b, 0) / period;
}

// EMA sembrada con la SMA de los primeros `period` valores, aplicada hacia
// adelante -- el metodo estandar cuando se tiene la serie completa (no un
// stream en vivo que necesite arrancar en el primer dato disponible).
function ema(values, period) {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  let val = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) val = values[i] * k + val * (1 - k);
  return val;
}

// Rango diario promedio (high-low/close, en %) de las ultimas `period`
// ruedas -- una medida simple de volatilidad reciente.
function avgDailyRangePct(closes, highs, lows, period) {
  const n = closes.length;
  if (n < period) return null;
  let sum = 0;
  for (let i = n - period; i < n; i++) sum += (highs[i] - lows[i]) / closes[i];
  return (sum / period) * 100;
}

// "Distribution day" (termino de IBD/Minervini): baja de mas de 0.2% con
// volumen mayor al dia anterior -- señal de que institucionales estan
// vendiendo, no solo ruido minorista.
function countDistributionDays(closes, volumes, lookback) {
  const n = closes.length;
  if (n < lookback + 1) return 0;
  let count = 0;
  for (let i = n - lookback; i < n; i++) {
    const chg = (closes[i] - closes[i - 1]) / closes[i - 1];
    if (chg <= -0.002 && volumes[i] > volumes[i - 1]) count++;
  }
  return count;
}

function hadBigDrop(closes, lookback, threshold) {
  const n = closes.length;
  for (let i = Math.max(1, n - lookback); i < n; i++) {
    if ((closes[i] - closes[i - 1]) / closes[i - 1] <= threshold) return true;
  }
  return false;
}

function computeTendencia({ price, sma50, ema200, trendRising, hi52 }) {
  let pts = 0;
  if (sma50 != null && price > sma50) pts += 5;
  if (sma50 != null && ema200 != null && sma50 > ema200) pts += 5;
  if (trendRising) pts += 5;
  if (hi52 && price >= hi52 * 0.75) pts += 5;
  return pts;
}

function computeContraccion(recentRange, longRange) {
  if (!recentRange || !longRange) return 0;
  return Math.round(Math.max(0, Math.min(1, 1 - recentRange / longRange)) * 35);
}

function computeSetup(price, hi20) {
  if (!hi20) return 0;
  return Math.round(Math.max(0, Math.min(1, price / hi20)) * 20);
}

function computePenalizaciones(distDays, bigDrop) {
  let pen = -Math.min(distDays, 8);
  if (bigDrop) pen -= 3;
  return pen;
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
    const q = result.indicators.quote[0];
    const rawCloses = q.close || [];
    const closes = [], volumes = [], highs = [], lows = [];
    rawCloses.forEach((c, i) => {
      if (c != null) {
        closes.push(c);
        volumes.push(q.volume[i] || 0);
        highs.push(q.high[i] != null ? q.high[i] : c);
        lows.push(q.low[i] != null ? q.low[i] : c);
      }
    });
    if (closes.length < 60) throw new Error('historial insuficiente');

    const price = meta.regularMarketPrice;
    const prevClose = closes.length >= 2 ? closes[closes.length - 2] : null;
    const pctChange = prevClose ? ((price - prevClose) / prevClose) * 100 : null;
    const sma50 = sma(closes, 50);
    const ema200 = ema(closes, 200);
    const ema200Prev = closes.length > 220 ? ema(closes.slice(0, -20), 200) : null;
    const trendRising = ema200 != null && ema200Prev != null && ema200 > ema200Prev;
    const hi52 = Math.max(...closes);
    const hi20 = Math.max(...closes.slice(-20));
    const recentRange = avgDailyRangePct(closes, highs, lows, 10);
    const longRange = avgDailyRangePct(closes, highs, lows, 50);
    const distDays = countDistributionDays(closes, volumes, 20);
    const bigDrop = hadBigDrop(closes, 10, -0.07);
    const sixMoIdx = Math.max(0, closes.length - 127);
    const sixMoReturn = closes[sixMoIdx] ? ((price - closes[sixMoIdx]) / closes[sixMoIdx]) * 100 : null;

    return {
      ticker,
      nombre: meta.shortName || ticker,
      sector,
      precio: price,
      pct_change: pctChange,
      sma50,
      ema200,
      tendencia: computeTendencia({ price, sma50, ema200, trendRising, hi52 }),
      contraccion: computeContraccion(recentRange, longRange),
      setup: computeSetup(price, hi20),
      penalizaciones: computePenalizaciones(distDays, bigDrop),
      sparkline: closes.slice(-20),
      sixMoReturn
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

  // Fuerza RS = percentil del retorno de 6 meses DENTRO de este universo,
  // asi que necesita que todos los tickers ya esten calculados antes de
  // poder rankear a cada uno.
  const withReturn = rows.filter(r => r.sixMoReturn != null).sort((a, b) => a.sixMoReturn - b.sixMoReturn);
  withReturn.forEach((r, i) => {
    const percentile = withReturn.length > 1 ? (i / (withReturn.length - 1)) * 100 : 50;
    r.fuerza_rs = Math.round((percentile / 100) * 25);
  });
  rows.forEach(r => {
    if (r.fuerza_rs == null) r.fuerza_rs = 12; // sin retorno de 6 meses calculable: percentil neutro
    r.score = Math.round(Math.max(0, Math.min(100,
      r.tendencia + r.fuerza_rs + r.contraccion + r.setup + r.penalizaciones
    )));
    delete r.sixMoReturn;
    r.updated_at = new Date().toISOString();
  });

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
