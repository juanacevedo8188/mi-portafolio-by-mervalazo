// Recalcula un score tecnico de 0-100 (propio, no replica ningun servicio
// de terceros) para un universo curado de tickers liquidos, y lo guarda en
// Supabase para que analisis-tecnico.html lo lea sin golpear Yahoo Finance
// ni recalcular nada en vivo.
//
// El score se arma en 5 categorias, cada una con su propia formula. La
// primera version de esto (commit anterior) era demasiado estricta --
// pedia que TODA una ventana reciente estuviera tranquila para puntuar
// Contraccion, y Fuerza RS era un ranking puro donde solo el #1 del
// universo se llevaba el maximo -- asi que en la practica casi nada
// llegaba a un score alto. Esta version es mas generosa a proposito:
//
//  - Tendencia (0-20): no son condiciones binarias sueltas, es la
//    distancia del precio a SMA50 y a EMA200 normalizada por ATR14 (0-8
//    pts cada una, saturando alrededor de +2 ATR de distancia) mas 4pts
//    si la EMA200 viene en alza.
//  - Fuerza RS (0-25): el MAYOR entre el nivel (percentil del retorno de
//    6 meses dentro de este universo) y la aceleracion (percentil del
//    retorno del ultimo mes) -- ambos mapeados de forma generosa, no
//    hace falta ser el #1 del universo para puntuar bien -- mas 5pts si
//    el precio esta sobre su SMA50. Si el ticker se desplomo en la
//    ultima semana (percentil de retorno a 5 ruedas <15), se ignora la
//    via de aceleracion mensual (para no premiar un rebote falso).
//  - Contraccion (0-35): la MEJOR ventana de 7 ruedas dentro de las
//    ultimas 20 (no toda la ventana entera) comparada contra el rango
//    promedio de referencia de 50 ruedas (0-20 pts) mas un bonus por RSI
//    en zona sana 40-70 (0-15 pts; si viene sobrecomprado sin confirmar
//    con 2 velas verdes seguidas, no suma).
//  - Setup (0-20): que tan cerca esta el precio del maximo de las ultimas
//    20 ruedas -- la lectura de "armando una base para romper".
//  - Penalizaciones (negativo): -1 por cada "distribution day" (baja de
//    >0.2% con volumen mayor al dia anterior) en las ultimas 20 ruedas,
//    tope -8, mas -3 si hubo una caida de un dia >7% en las ultimas 10.
//
// Ademas del score, se guarda el Estadio (1-4, posicion+pendiente vs
// EMA200), el retorno de 6 meses crudo y el volumen relativo -- para la
// ficha de detalle de cada ticker en el frontend.
//
// Universo acotado a ~300 nombres: calcular esto en vivo para todo el
// mercado en cada carga de pagina seria pesado y lento -- por eso se
// precalcula 1 vez por dia y se guarda.

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
  ['ANET', 'Tecnología'], ['FTNT', 'Tecnología'], ['CDNS', 'Tecnología'], ['SNPS', 'Tecnología'],
  ['KLAC', 'Tecnología'], ['ON', 'Tecnología'], ['MPWR', 'Tecnología'], ['GRMN', 'Tecnología'],
  ['OKTA', 'Tecnología'], ['ZS', 'Tecnología'], ['DOCU', 'Tecnología'], ['TWLO', 'Tecnología'],
  ['RBLX', 'Tecnología'], ['U', 'Tecnología'], ['HOOD', 'Tecnología'], ['WDC', 'Tecnología'],
  ['STX', 'Tecnología'], ['NTAP', 'Tecnología'], ['KEYS', 'Tecnología'],
  // Consumo Cíclico
  ['YUM', 'Consumo Cíclico'], ['DPZ', 'Consumo Cíclico'], ['DRI', 'Consumo Cíclico'],
  ['WYNN', 'Consumo Cíclico'], ['MGM', 'Consumo Cíclico'], ['LVS', 'Consumo Cíclico'], ['HOG', 'Consumo Cíclico'],
  ['EXPE', 'Consumo Cíclico'], ['ORLY', 'Consumo Cíclico'], ['AZO', 'Consumo Cíclico'],
  ['BBY', 'Consumo Cíclico'], ['GAP', 'Consumo Cíclico'], ['RL', 'Consumo Cíclico'],
  ['DECK', 'Consumo Cíclico'], ['POOL', 'Consumo Cíclico'],
  // Consumo Defensivo
  ['CLX', 'Consumo Defensivo'], ['CHD', 'Consumo Defensivo'], ['HSY', 'Consumo Defensivo'],
  ['SJM', 'Consumo Defensivo'], ['CAG', 'Consumo Defensivo'],
  ['HRL', 'Consumo Defensivo'], ['TAP', 'Consumo Defensivo'], ['EL', 'Consumo Defensivo'],
  ['KR', 'Consumo Defensivo'],
  // Financiero
  ['TFC', 'Financiero'], ['RF', 'Financiero'], ['HBAN', 'Financiero'], ['KEY', 'Financiero'],
  ['FITB', 'Financiero'], ['ZION', 'Financiero'], ['CFG', 'Financiero'], ['ALL', 'Financiero'],
  ['TRV', 'Financiero'], ['HIG', 'Financiero'], ['AFL', 'Financiero'], ['PRU', 'Financiero'],
  ['SYF', 'Financiero'],
  // Salud
  ['HCA', 'Salud'], ['CNC', 'Salud'], ['MOH', 'Salud'], ['IQV', 'Salud'], ['A', 'Salud'],
  ['EW', 'Salud'], ['ALGN', 'Salud'], ['IDXX', 'Salud'], ['RMD', 'Salud'], ['DXCM', 'Salud'],
  ['PODD', 'Salud'], ['MRNA', 'Salud'],
  // Industrial
  ['NOC', 'Industrial'], ['GD', 'Industrial'], ['TXT', 'Industrial'], ['PCAR', 'Industrial'],
  ['CMI', 'Industrial'], ['PH', 'Industrial'], ['ROK', 'Industrial'], ['DOV', 'Industrial'],
  ['XYL', 'Industrial'], ['AME', 'Industrial'],
  // Energía
  ['DVN', 'Energía'], ['FANG', 'Energía'], ['APA', 'Energía'], ['BKR', 'Energía'],
  ['HAL', 'Energía'], ['TRGP', 'Energía'], ['OKE', 'Energía'],
  // Materiales
  ['DOW', 'Materiales'], ['DD', 'Materiales'], ['PPG', 'Materiales'], ['VMC', 'Materiales'],
  ['MLM', 'Materiales'], ['ALB', 'Materiales'], ['CE', 'Materiales'], ['IFF', 'Materiales'],
  // Utilities
  ['PEG', 'Utilities'], ['ED', 'Utilities'], ['XEL', 'Utilities'], ['WEC', 'Utilities'],
  ['ES', 'Utilities'], ['ETR', 'Utilities'], ['FE', 'Utilities'], ['AEE', 'Utilities'],
  // Comunicación
  ['LYV', 'Comunicación'], ['OMC', 'Comunicación'], ['FOXA', 'Comunicación'],
  ['NWSA', 'Comunicación'], ['MTCH', 'Comunicación'], ['PINS', 'Comunicación'],
  // ETFs (indices y sectoriales -- tambien tienen CEDEAR y se siguen mucho)
  ['SPY', 'ETF'], ['QQQ', 'ETF'], ['DIA', 'ETF'], ['IWM', 'ETF'], ['EEM', 'ETF'], ['EFA', 'ETF'],
  ['XLK', 'ETF'], ['XLF', 'ETF'], ['XLE', 'ETF'], ['XLV', 'ETF'], ['XLI', 'ETF'], ['XLY', 'ETF'],
  ['XLP', 'ETF'], ['XLU', 'ETF'], ['XLB', 'ETF'], ['XLC', 'ETF'], ['GLD', 'ETF'], ['SLV', 'ETF'],
  ['TLT', 'ETF'], ['HYG', 'ETF'], ['LQD', 'ETF'], ['SMH', 'ETF'], ['XBI', 'ETF'], ['KRE', 'ETF'],
  ['ARKK', 'ETF'],
  // Argentina (ADRs, subyacente de los CEDEARs mas seguidos localmente)
  ['GGAL', 'Argentina'], ['BMA', 'Argentina'], ['SUPV', 'Argentina'], ['YPF', 'Argentina'],
  ['PAM', 'Argentina'], ['TGS', 'Argentina'], ['EDN', 'Argentina'], ['CRESY', 'Argentina'],
  ['IRS', 'Argentina'], ['LOMA', 'Argentina'], ['TX', 'Argentina'], ['VIST', 'Argentina'],
  ['MELI', 'Argentina'], ['GLOB', 'Argentina'], ['BBAR', 'Argentina']
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

// La ventana de `windowLen` ruedas MAS comprimida dentro de las ultimas
// `lookback` -- a diferencia de avgDailyRangePct (que promedia un tramo
// fijo entero), esto encuentra el mejor tramo de acumulacion reciente,
// aunque el resto de esas ruedas haya sido mas movido. Es lo que hace que
// Contraccion no exija que TODA la ultima semana y media este quieta.
function bestWindowRangePct(closes, highs, lows, windowLen, lookback) {
  const n = closes.length;
  if (n < lookback) return null;
  let best = Infinity;
  for (let start = n - lookback; start <= n - windowLen; start++) {
    let sum = 0;
    for (let i = start; i < start + windowLen; i++) sum += (highs[i] - lows[i]) / closes[i];
    const avg = (sum / windowLen) * 100;
    if (avg < best) best = avg;
  }
  return best === Infinity ? null : best;
}

// ATR de Wilder (14 ruedas por defecto): promedio del "true range" (el
// mayor entre el rango del dia, la distancia al cierre previo hacia
// arriba y hacia abajo) -- se usa para normalizar Tendencia por
// volatilidad propia de cada activo, en vez de un % fijo que le pega
// distinto a una acción tranquila que a una volátil.
function atr(closes, highs, lows, period) {
  const n = closes.length;
  if (n < period + 1) return null;
  const trs = [];
  for (let i = 1; i < n; i++) {
    trs.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    ));
  }
  return sma(trs, period);
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

// "Distribution day" (termino de IBD/Minervini): baja de mas de 0.5% con
// volumen al menos 10% mayor al dia anterior -- señal de que
// institucionales estan vendiendo, no solo ruido minorista. (El umbral
// original, -0.2% y "cualquier volumen mayor", calificaba como
// "distribucion" casi cualquier dia rojo comun -- estadisticamente ~1 de
// cada 4 ruedas, penalizando a todo el universo por igual sin distinguir
// nada real.)
function countDistributionDays(closes, volumes, lookback) {
  const n = closes.length;
  if (n < lookback + 1) return 0;
  let count = 0;
  for (let i = n - lookback; i < n; i++) {
    const chg = (closes[i] - closes[i - 1]) / closes[i - 1];
    if (chg <= -0.005 && volumes[i] > volumes[i - 1] * 1.1) count++;
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

// Distancia (en ATRs) de un precio a una media, mapeada 0-1: a -1.5 ATR o
// mas abajo, 0; a `satAtr` ATR o mas arriba, el maximo -- una accion
// tranquila y una volatil que esten "igual de arriba" en terminos
// propios puntuan parecido, en vez de que el % fijo castigue mas a la
// volatil. El piso en -1.5 (no -1) es a proposito: un pullback chico y
// sano hacia la SMA50 dentro de una tendencia de fondo intacta no
// deberia hundir el puntaje a cero.
function atrDistFrac(price, level, atr14, satAtr) {
  if (level == null || !atr14) return 0;
  const distAtr = (price - level) / atr14;
  return Math.max(0, Math.min(1, (distAtr + 1.5) / (satAtr + 1.5)));
}

// EMA200 (tendencia de fondo) pesa mas que SMA50 (corto plazo) -- un
// activo puede estar descansando cerca de su SMA50 despues de una suba
// fuerte sin que eso invalide una tendencia de largo plazo sólida.
function computeTendencia({ price, sma50, ema200, trendRising, atr14 }) {
  let pts = 0;
  pts += atrDistFrac(price, sma50, atr14, 2) * 6;
  pts += atrDistFrac(price, ema200, atr14, 3) * 10;
  if (trendRising) pts += 4;
  return Math.round(pts);
}

function computeContraccion(closes, highs, lows, rsi14) {
  const bestRecent = bestWindowRangePct(closes, highs, lows, 7, 20);
  const longRange = avgDailyRangePct(closes, highs, lows, 50);
  let volPts = 0;
  if (bestRecent != null && longRange) {
    volPts = Math.max(0, Math.min(1, 1 - bestRecent / longRange)) * 20;
  }
  let rsiPts = 0;
  if (rsi14 != null) {
    if (rsi14 >= 40 && rsi14 <= 70) {
      rsiPts = 15;
    } else if (rsi14 > 70) {
      const n = closes.length;
      const twoGreen = n >= 3 && closes[n - 1] > closes[n - 2] && closes[n - 2] > closes[n - 3];
      rsiPts = twoGreen ? 8 : 0;
    } else {
      rsiPts = Math.max(0, rsi14 / 40) * 8;
    }
  }
  return Math.round(volPts + rsiPts);
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

// Estadio (1-4), segun posicion del precio respecto a la EMA200 y si esa
// media viene subiendo o bajando -- 2 es la lectura mas favorable (encima
// de la media y esa media en alza), 4 la menos favorable.
function computeEstadio(price, ema200, trendRising) {
  if (ema200 == null) return null;
  const above = price > ema200;
  if (above && trendRising) return 2;
  if (above && !trendRising) return 3;
  if (!above && trendRising) return 1;
  return 4;
}

// Trae 1 año de historial diario de un ticker cualquiera -- version minima
// reutilizada tanto por fetchOne() (universo curado) como por el Regimen
// de Mercado (SPY/QQQ/VIX no son parte del universo, no llevan sector).
async function fetchHistory(ticker) {
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
  return { meta, closes, volumes, highs, lows };
}

// Score de tendencia de un indice (SPY/QQQ), 0-50: mismo criterio ATR que
// Tendencia pero escalado -- posicion vs SMA50 (20pts) y EMA200 (25pts)
// normalizada por volatilidad propia, mas pendiente de la EMA200 (5pts).
function computeIndexTrendScore(price, sma50, ema200, trendRising, atr14) {
  let pts = 0;
  pts += atrDistFrac(price, sma50, atr14, 2) * 20;
  pts += atrDistFrac(price, ema200, atr14, 3) * 25;
  if (trendRising) pts += 5;
  return Math.round(pts);
}

// VIX en zona sana (13-20) puntua maximo -- ni complacencia extrema (VIX
// muy bajo, el mercado no le tiene miedo a nada) ni panico (VIX muy alto)
// son lecturas comodas para operar. No cae a cero en panico extremo a
// proposito: un miedo muy alto en medio de un mercado que viene fuerte
// suele ser mas oportunidad que peligro, no una señal binaria de "salite".
function computeVixScore(vix) {
  if (vix == null) return 10;
  if (vix >= 13 && vix <= 20) return 20;
  if (vix < 13) return Math.round(Math.max(0, 20 - (13 - vix) * 1.5));
  return Math.round(Math.max(5, 20 - (vix - 20) * 0.8));
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
    const atr14 = atr(closes, highs, lows, 14);
    const rsi14 = rsi(closes, 14);
    const hi20 = Math.max(...closes.slice(-20));
    const distDays = countDistributionDays(closes, volumes, 20);
    const bigDrop = hadBigDrop(closes, 10, -0.07);
    const sixMoIdx = Math.max(0, closes.length - 127);
    const sixMoReturn = closes[sixMoIdx] ? ((price - closes[sixMoIdx]) / closes[sixMoIdx]) * 100 : null;
    const oneMoIdx = Math.max(0, closes.length - 22);
    const oneMoReturn = closes[oneMoIdx] ? ((price - closes[oneMoIdx]) / closes[oneMoIdx]) * 100 : null;
    const fiveDIdx = Math.max(0, closes.length - 6);
    const fiveDReturn = closes[fiveDIdx] ? ((price - closes[fiveDIdx]) / closes[fiveDIdx]) * 100 : null;
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
      tendencia: computeTendencia({ price, sma50, ema200, trendRising, atr14 }),
      contraccion: computeContraccion(closes, highs, lows, rsi14),
      setup: computeSetup(price, hi20),
      penalizaciones: computePenalizaciones(distDays, bigDrop),
      estadio: computeEstadio(price, ema200, trendRising),
      retorno_6m: sixMoReturn,
      vol_ratio: volRatio,
      sparkline: closes.slice(-20),
      // Campos internos, solo para el ranking de Fuerza RS entre todo el
      // universo -- se borran antes de guardar (ver export default).
      sixMoReturn, oneMoReturn, fiveDReturn
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

  const [rows, regimeInputs] = await Promise.all([
    Promise.all(TICKERS.map(fetchOne)).then(r => r.filter(Boolean)),
    Promise.allSettled([fetchHistory('SPY'), fetchHistory('QQQ'), fetchHistory('^VIX')])
  ]);

  // Fuerza RS necesita el percentil de cada ticker DENTRO de este mismo
  // universo, asi que hace falta que todos ya esten calculados antes de
  // poder rankear. percentileMap() arma un Map(row -> percentil 0-100)
  // para un campo dado, dejando afuera del ranking a los que no tengan
  // ese dato (universo nuevo, historial corto, etc).
  function percentileMap(field) {
    const withVal = rows.filter(r => r[field] != null).sort((a, b) => a[field] - b[field]);
    const map = new Map();
    withVal.forEach((r, i) => {
      map.set(r, withVal.length > 1 ? (i / (withVal.length - 1)) * 100 : 50);
    });
    return map;
  }
  // Percentil -> puntos, generoso a proposito: no hace falta ser el mejor
  // del universo (percentil 100) para llegar al maximo, con estar bien
  // por encima de la mediana (percentil ~70) ya alcanza.
  function pctToPoints(pct, max) {
    if (pct == null) return max * 0.4; // sin dato: neutro-generoso, no castiga
    return Math.round(Math.max(0, Math.min(1, pct / 70)) * max);
  }

  const p6Map = percentileMap('sixMoReturn');
  const p1Map = percentileMap('oneMoReturn');
  const p5Map = percentileMap('fiveDReturn');

  rows.forEach(r => {
    const levelPts = pctToPoints(p6Map.get(r), 20);
    const p5 = p5Map.get(r);
    const crashedThisWeek = p5 != null && p5 < 15;
    const accelPts = crashedThisWeek ? 0 : pctToPoints(p1Map.get(r), 20);
    const smaBonus = r.sma50 != null && r.precio > r.sma50 ? 5 : 0;
    r.fuerza_rs = Math.min(25, Math.max(levelPts, accelPts) + smaBonus);

    r.score = Math.round(Math.max(0, Math.min(100,
      r.tendencia + r.fuerza_rs + r.contraccion + r.setup + r.penalizaciones
    )));
    delete r.sixMoReturn;
    delete r.oneMoReturn;
    delete r.fiveDReturn;
    r.updated_at = new Date().toISOString();
  });

  const writes = [];

  if (rows.length) {
    writes.push(fetch(`${SUPABASE_URL}/rest/v1/technical_indicators?on_conflict=ticker`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify(rows)
    }));
  }

  // Regimen de Mercado: score aparte 0-100 que resume el estado general
  // del mercado (no de un ticker puntual) -- Indices (SPY/QQQ, 0-50) +
  // Amplitud (% del universo en Estadio 2, 0-30) + Sentimiento (VIX,
  // 0-20). Si SPY/QQQ/VIX fallan la ejecucion (Yahoo caido, etc.) se
  // omite en vez de escribir un regimen a medias con huecos silenciosos.
  const [spyRes, qqqRes, vixRes] = regimeInputs;
  if (spyRes.status === 'fulfilled' && qqqRes.status === 'fulfilled') {
    function indexTrend(hist) {
      const { meta, closes, highs, lows } = hist;
      const price = meta.regularMarketPrice;
      const prevClose = closes.length >= 2 ? closes[closes.length - 2] : null;
      const pctChange = prevClose ? ((price - prevClose) / prevClose) * 100 : null;
      const sma50 = sma(closes, 50);
      const ema200 = ema(closes, 200);
      const ema200Prev = closes.length > 220 ? ema(closes.slice(0, -20), 200) : null;
      const trendRising = ema200 != null && ema200Prev != null && ema200 > ema200Prev;
      const atr14 = atr(closes, highs, lows, 14);
      return { price, pctChange, score: computeIndexTrendScore(price, sma50, ema200, trendRising, atr14) };
    }
    const spy = indexTrend(spyRes.value);
    const qqq = indexTrend(qqqRes.value);
    const indicesScore = Math.round((spy.score + qqq.score) / 2);

    const bullish = rows.filter(r => r.estadio === 2).length;
    const pctBullish = rows.length ? (bullish / rows.length) * 100 : 0;
    const amplitudScore = Math.round(Math.min(1, pctBullish / 100) * 30);

    const vix = vixRes.status === 'fulfilled' ? vixRes.value.meta.regularMarketPrice : null;
    const sentimientoScore = computeVixScore(vix);

    const regimeScore = Math.max(0, Math.min(100, indicesScore + amplitudScore + sentimientoScore));

    writes.push(fetch(`${SUPABASE_URL}/rest/v1/market_regime?on_conflict=id`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        id: 1,
        score: regimeScore,
        indices_score: indicesScore,
        amplitud_score: amplitudScore,
        sentimiento_score: sentimientoScore,
        spy_price: spy.price,
        spy_pct_change: spy.pctChange,
        qqq_price: qqq.price,
        qqq_pct_change: qqq.pctChange,
        vix,
        pct_bullish: pctBullish,
        updated_at: new Date().toISOString()
      })
    }));
  }

  await Promise.all(writes);

  return new Response(JSON.stringify({ ok: true, count: rows.length, total: TICKERS.length }), {
    headers: { 'Content-Type': 'application/json' }
  });
};

export const config = { schedule: '0 21 * * 1-5' };
