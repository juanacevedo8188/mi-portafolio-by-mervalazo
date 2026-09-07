// Recalcula un score fundamental de 0-100 (propio, no replica ningun
// servicio de terceros) para el mismo universo curado que usa
// compute-indicators.mjs (ver _universe.mjs), y lo guarda en Supabase para
// que analisis-fundamental.html lo lea sin golpear Yahoo Finance ni
// recalcular nada en vivo.
//
// Fuente: Yahoo Finance quoteSummary (modulos defaultKeyStatistics,
// financialData, summaryDetail) -- a diferencia del endpoint de velas
// (v8/finance/chart, el que ya usa compute-indicators.mjs) este SI exige
// un "crumb" (token anti-bot atado a una cookie de sesion). Se consigue
// pidiendolo una sola vez por corrida (no por ticker) contra
// query2.finance.yahoo.com/v1/test/getcrumb con la cookie de fc.yahoo.com,
// y se reusa para los ~300 tickers. No es una API oficial (no tiene SLA):
// si Yahoo cambia este mecanismo y deja de andar, esta funcion empieza a
// fallar sola (la corrida no escribe nada silenciosamente mal, ver mas
// abajo) -- eso no afecta a compute-indicators.mjs, que no depende de esto.
//
// El score se arma en 4 categorias, con el mismo criterio "generoso" que
// ya funciono para el score tecnico (percentil dentro del universo,
// saturando antes de llegar al 100 -- no hace falta ser el mejor del
// universo para puntuar bien, ver pctToPoints):
//
//  - Valuacion (0-30): percentil INVERTIDO (mas barato = mejor puntaje)
//    de P/E trailing (0-15) y Price/Book (0-15).
//  - Calidad (0-25): percentil de ROE (0-15) y margen neto (0-10).
//  - Crecimiento (0-25): percentil de crecimiento de ingresos (0-13) y
//    de ganancias (0-12), interanual.
//  - Salud financiera (0-20): percentil INVERTIDO de deuda/patrimonio
//    (0-12) mas un bonus por current ratio sano, >=1.5 es el maximo,
//    <1 no suma nada (0-8).
//
// El precio objetivo de analistas (targetMeanPrice) y la recomendacion de
// consenso se guardan aparte, solo informativos -- no entran al score
// porque es la opinion de terceros, no un calculo propio.
//
// ETFs (sector 'ETF' en el universo) se excluyen: quoteSummary no trae
// estos campos para un fondo (son metricas de una empresa operativa), asi
// que entrarian todos con datos faltantes.

import { TICKERS } from './_universe.mjs';

const SUPABASE_URL = 'https://rdpwpcgaarbnpotxcvzz.supabase.co';
const UA = 'Mozilla/5.0';

async function getCrumb() {
  const jar = [];
  const setCookies = res => {
    const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);
    raw.forEach(c => jar.push(c.split(';')[0]));
  };
  const r1 = await fetch('https://fc.yahoo.com', { headers: { 'User-Agent': UA }, redirect: 'manual' });
  setCookies(r1);
  const cookieHeader = jar.join('; ');
  const r2 = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
    headers: { 'User-Agent': UA, Cookie: cookieHeader }
  });
  if (!r2.ok) throw new Error('no se pudo obtener el crumb de Yahoo: ' + r2.status);
  const crumb = await r2.text();
  if (!crumb || crumb.includes('<html')) throw new Error('crumb invalido');
  return { crumb, cookieHeader };
}

async function fetchOne([ticker, sector], crumb, cookieHeader) {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=defaultKeyStatistics,financialData,summaryDetail&crumb=${encodeURIComponent(crumb)}`,
      { headers: { 'User-Agent': UA, Cookie: cookieHeader } }
    );
    if (!res.ok) throw new Error('yahoo ' + res.status);
    const data = await res.json();
    const result = data.quoteSummary?.result?.[0];
    if (!result) throw new Error('sin datos');
    const dks = result.defaultKeyStatistics || {};
    const fd = result.financialData || {};
    const sd = result.summaryDetail || {};
    const raw = f => (f && typeof f.raw === 'number' ? f.raw : null);

    const peTrailing = raw(sd.trailingPE);
    const priceToBook = raw(dks.priceToBook);
    const roe = raw(fd.returnOnEquity);
    const profitMargin = raw(fd.profitMargins);
    const revenueGrowth = raw(fd.revenueGrowth);
    const earningsGrowth = raw(fd.earningsGrowth);
    const debtToEquity = raw(fd.debtToEquity);
    const currentRatio = raw(fd.currentRatio);

    // Sin ninguno de los campos de valuacion/calidad no hay nada que
    // puntuar (tipico de un ETF que se coló, o un ticker sin cobertura).
    if (peTrailing == null && priceToBook == null && roe == null) throw new Error('sin fundamentals utiles');

    return {
      ticker,
      sector,
      precio: raw(fd.currentPrice),
      pe_trailing: peTrailing,
      pe_forward: raw(sd.forwardPE),
      price_to_book: priceToBook,
      price_to_sales: raw(sd.priceToSalesTrailing12Months),
      peg_ratio: raw(dks.pegRatio),
      dividend_yield: raw(sd.dividendYield),
      roe,
      roa: raw(fd.returnOnAssets),
      profit_margin: profitMargin,
      operating_margin: raw(fd.operatingMargins),
      revenue_growth: revenueGrowth,
      earnings_growth: earningsGrowth,
      debt_to_equity: debtToEquity,
      current_ratio: currentRatio,
      market_cap: raw(sd.marketCap),
      beta: raw(sd.beta),
      target_mean_price: raw(fd.targetMeanPrice),
      recommendation_key: fd.recommendationKey || null,
      number_of_analysts: raw(fd.numberOfAnalystOpinions)
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
  try {
    return await run(serviceKey);
  } catch (err) {
    // TEMPORAL: cualquier excepcion no atrapada mas abajo tambien queda
    // registrada aca, para no quedarse sin pista de diagnostico.
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/fundamental_indicators?on_conflict=ticker`, {
        method: 'POST',
        headers: {
          apikey: serviceKey, Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates'
        },
        body: JSON.stringify([{ ticker: '_DEBUG_', sector: 'debug', recommendation_key: ('uncaught: ' + (err && err.stack || err)).slice(0, 490), updated_at: new Date().toISOString() }])
      });
    } catch (e) { /* nada mas para hacer */ }
    return new Response('Error no atrapado: ' + (err && err.message || err), { status: 500 });
  }
};

async function run(serviceKey) {

  // TEMPORAL: escribe un marcador de diagnostico en la misma tabla (fuera
  // del anon key no hay forma de leer los logs de esta funcion desde
  // afuera de Netlify) -- sacar apenas se confirme que la funcion anda.
  async function debugLog(msg) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/fundamental_indicators?on_conflict=ticker`, {
        method: 'POST',
        headers: {
          apikey: serviceKey, Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates'
        },
        body: JSON.stringify([{ ticker: '_DEBUG_', sector: 'debug', recommendation_key: msg.slice(0, 490), updated_at: new Date().toISOString() }])
      });
    } catch (e) { /* si ni esto anda, no hay mucho mas para hacer */ }
  }

  let crumb, cookieHeader;
  try {
    ({ crumb, cookieHeader } = await getCrumb());
  } catch (err) {
    await debugLog('crumb failed: ' + err.message);
    return new Response('No se pudo autenticar contra Yahoo Finance (crumb): ' + err.message, { status: 502 });
  }

  const universe = TICKERS.filter(([, sector]) => sector !== 'ETF');
  const rows = (await Promise.all(universe.map(t => fetchOne(t, crumb, cookieHeader)))).filter(Boolean);

  if (!rows.length) {
    await debugLog('0 rows after fetch, universe size ' + universe.length + ', crumb was: ' + crumb.slice(0, 20));
    return new Response('Yahoo no devolvio datos utiles para ningun ticker -- no se escribio nada.', { status: 502 });
  }
  await debugLog('OK so far, got ' + rows.length + ' rows, about to score+write');

  // Percentil de cada ticker dentro de este universo para un campo dado.
  // invert=true cuando "menos es mejor" (P/E, P/B, deuda/patrimonio) --
  // se puntua el percentil de (1/valor) en vez del valor crudo, asi un
  // valor negativo o cero (empresa con perdidas, sin deuda) no rompe el
  // orden como pasaria restando de un maximo fijo.
  function percentileMap(field, invert) {
    const withVal = rows.filter(r => r[field] != null && (!invert || r[field] > 0));
    const sorted = [...withVal].sort((a, b) => invert ? (b[field] - a[field]) : (a[field] - b[field]));
    const map = new Map();
    sorted.forEach((r, i) => {
      map.set(r, sorted.length > 1 ? (i / (sorted.length - 1)) * 100 : 50);
    });
    return map;
  }
  // Mismo criterio "generoso" que compute-indicators.mjs: percentil ~70
  // ya alcanza el maximo, no hace falta ser el mejor del universo.
  function pctToPoints(pct, max) {
    if (pct == null) return Math.round(max * 0.4);
    return Math.round(Math.max(0, Math.min(1, pct / 70)) * max);
  }

  const peMap = percentileMap('pe_trailing', true);
  const pbMap = percentileMap('price_to_book', true);
  const roeMap = percentileMap('roe', false);
  const marginMap = percentileMap('profit_margin', false);
  const revGrowthMap = percentileMap('revenue_growth', false);
  const earnGrowthMap = percentileMap('earnings_growth', false);
  const deMap = percentileMap('debt_to_equity', true);

  rows.forEach(r => {
    const valuacion = pctToPoints(peMap.get(r), 15) + pctToPoints(pbMap.get(r), 15);
    const calidad = pctToPoints(roeMap.get(r), 15) + pctToPoints(marginMap.get(r), 10);
    const crecimiento = pctToPoints(revGrowthMap.get(r), 13) + pctToPoints(earnGrowthMap.get(r), 12);
    const deudaPts = pctToPoints(deMap.get(r), 12);
    const liquidezPts = r.current_ratio == null ? Math.round(8 * 0.4) : Math.round(Math.max(0, Math.min(1, r.current_ratio / 1.5)) * 8);
    const salud = deudaPts + liquidezPts;

    r.valuacion = Math.round(valuacion);
    r.calidad = Math.round(calidad);
    r.crecimiento = Math.round(crecimiento);
    r.salud_financiera = Math.round(salud);
    r.score = Math.round(Math.max(0, Math.min(100, valuacion + calidad + crecimiento + salud)));
    r.updated_at = new Date().toISOString();
  });

  const res = await fetch(`${SUPABASE_URL}/rest/v1/fundamental_indicators?on_conflict=ticker`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates'
    },
    body: JSON.stringify(rows)
  });
  if (!res.ok) {
    const bodyText = await res.text();
    await debugLog('write failed: ' + res.status + ' ' + bodyText);
    return new Response('Fallo el guardado en Supabase: ' + res.status + ' ' + bodyText, { status: 502 });
  }
  await debugLog('SUCCESS: wrote ' + rows.length + ' rows at ' + new Date().toISOString());

  return new Response(JSON.stringify({ ok: true, count: rows.length, total: universe.length }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// TEMPORAL para la primera verificacion en vivo -- cambiar de vuelta a
// '0 10 * * 1-5' (una vez por dia, 7 ART) apenas se confirme que escribe
// bien en Supabase.
export const config = { schedule: '*/10 * * * *' };
