// Futuros de dolar (MATBA ROFEX) via la API oficial de Remarket
// (https://remarkets.primary.ventures/ — entorno gratuito de testing con
// precios reales, la misma API que usan pyRofex/jsRofex). Requiere
// credenciales propias cargadas como variables de entorno en Netlify
// (ROFEX_USER / ROFEX_PASSWORD) — nunca hardcodeadas ni en el repo.
//
// Referencia: https://apihub.primary.com.ar/assets/docs/Primary-API.pdf
//
// (redeploy trigger: variables de entorno ROFEX_USER/ROFEX_PASSWORD ya
// cargadas en Netlify)

const BASE_URL = 'https://api.remarkets.primary.com.ar/';
const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

// Los tickers de futuros de dolar siguen el patron DLR/MESAA (ej. DLR/DIC26)
// — se generan los proximos N meses desde hoy en vez de hardcodear una
// lista que quedaria vieja cuando venzan los contratos actuales.
function nextMonthlyTickers(prefix, count) {
  const now = new Date();
  const tickers = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
    const yy = String(d.getUTCFullYear()).slice(-2);
    tickers.push(`${prefix}/${MESES[d.getUTCMonth()]}${yy}`);
  }
  return tickers;
}

async function getToken() {
  const user = process.env.ROFEX_USER;
  const password = process.env.ROFEX_PASSWORD;
  if (!user || !password) {
    throw new Error('faltan las variables de entorno ROFEX_USER / ROFEX_PASSWORD');
  }
  const res = await fetch(BASE_URL + 'auth/getToken', {
    method: 'POST',
    headers: { 'X-Username': user, 'X-Password': password }
  });
  if (!res.ok) throw new Error('autenticacion fallida: ' + res.status);
  const token = res.headers.get('X-Auth-Token');
  if (!token) throw new Error('la respuesta no trajo X-Auth-Token');
  return token;
}

async function getMarketData(token, symbol) {
  const url = BASE_URL + `rest/marketdata/get?marketId=ROFX&symbol=${encodeURIComponent(symbol)}&entries=BI,OF,LA,CL,SE,OI&depth=1`;
  const res = await fetch(url, { headers: { 'X-Auth-Token': token } });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.status !== 'OK' || !data.marketData) return null;
  const md = data.marketData;
  const pick = entry => (Array.isArray(entry) ? entry[0] : entry) || null;
  const bid = pick(md.BI), offer = pick(md.OF), last = pick(md.LA), close = pick(md.CL), settle = pick(md.SE);
  return {
    bid: bid ? bid.price : null,
    offer: offer ? offer.price : null,
    last: last ? last.price : null,
    close: close ? close.price : null,
    settlement: settle ? settle.price : null,
    openInterest: md.OI ? md.OI.quantity ?? md.OI.price ?? null : null
  };
}

export default async (req) => {
  try {
    const url = new URL(req.url);
    const months = Math.min(parseInt(url.searchParams.get('months'), 10) || 12, 18);
    const tickers = nextMonthlyTickers('DLR', months);

    const token = await getToken();
    const results = await Promise.all(tickers.map(async t => [t, await getMarketData(token, t)]));
    const byTicker = {};
    results.forEach(([t, d]) => { if (d) byTicker[t] = d; });

    return new Response(JSON.stringify(byTicker), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=120' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err.message || err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
