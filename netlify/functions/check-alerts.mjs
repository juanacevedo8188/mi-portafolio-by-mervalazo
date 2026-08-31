// Evalua las alertas activas de todos los usuarios y marca "disparada" la
// que corresponda. Corre sola cada 15 minutos en horario de mercado (ver
// config.schedule al final) via Netlify Scheduled Functions, y usa la
// service-role key (bypassea RLS) igual que snapshot-portfolios.mjs — no
// hay sesion de usuario en un cron, asi que no puede usar el cliente
// supabase-js con la anon key.
//
// Una alerta se dispara una sola vez: se evalua "activa -> disparada" y
// no se vuelve a tocar, para no generar el mismo aviso en cada corrida
// mientras el precio se queda del lado que lo disparo (ver schema_v10.sql).

const SUPABASE_URL = 'https://rdpwpcgaarbnpotxcvzz.supabase.co';
const SITE_URL = 'https://mi-portafolio-by-mervalazo.netlify.app';

async function getPriceMap() {
  const [stocks, cedears] = await Promise.all([
    fetch('https://data912.com/live/arg_stocks').then(r => r.json()),
    fetch('https://data912.com/live/arg_cedears').then(r => r.json())
  ]);
  const map = new Map();
  [...stocks, ...cedears].forEach(row => map.set(row.symbol, row.c));
  return map;
}

async function getFuturoVencimientos() {
  const res = await fetch(`${SITE_URL}/.netlify/functions/ppi-futuros`);
  if (!res.ok) return new Map();
  const data = await res.json();
  const map = new Map();
  Object.entries(data).forEach(([ticker, q]) => {
    if (q.expirationDate) map.set(ticker, q.expirationDate);
  });
  return map;
}

async function getLetraVencimientos() {
  const res = await fetch('https://api.argentinadatos.com/v1/finanzas/letras', { cache: 'no-store' });
  if (!res.ok) return new Map();
  const letras = await res.json();
  const map = new Map();
  letras.forEach(l => { if (l.fechaVencimiento) map.set(l.ticker, l.fechaVencimiento); });
  return map;
}

function diasRestantes(fechaISO) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const vencimiento = new Date(fechaISO + 'T00:00:00Z');
  return Math.round((vencimiento - today) / 86400000);
}

function evaluate(alert, priceMap, futuroMap, letraMap) {
  if (alert.categoria === 'precio') {
    const price = priceMap.get(alert.ticker);
    if (price == null) return false;
    return alert.direccion === 'sube_a' ? price >= alert.precio_objetivo : price <= alert.precio_objetivo;
  }
  // vencimiento
  const fecha = alert.instrumento_tipo === 'futuro_dolar' ? futuroMap.get(alert.ticker) : letraMap.get(alert.ticker);
  if (!fecha) return false;
  return diasRestantes(fecha) <= alert.dias_anticipacion;
}

export default async () => {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return new Response('Falta la variable de entorno SUPABASE_SERVICE_ROLE_KEY en Netlify', { status: 500 });
  }
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json'
  };

  const alertsRes = await fetch(`${SUPABASE_URL}/rest/v1/alerts?estado=eq.activa&select=*`, { headers });
  const alerts = await alertsRes.json();
  if (!Array.isArray(alerts) || !alerts.length) {
    return new Response(JSON.stringify({ ok: true, evaluated: 0, triggered: 0 }), { headers: { 'Content-Type': 'application/json' } });
  }

  const [priceMap, futuroMap, letraMap] = await Promise.all([
    getPriceMap(),
    getFuturoVencimientos(),
    getLetraVencimientos()
  ]);

  const triggeredIds = alerts.filter(a => evaluate(a, priceMap, futuroMap, letraMap)).map(a => a.id);

  if (triggeredIds.length) {
    await fetch(`${SUPABASE_URL}/rest/v1/alerts?id=in.(${triggeredIds.join(',')})`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ estado: 'disparada', triggered_at: new Date().toISOString() })
    });
  }

  return new Response(JSON.stringify({
    ok: true,
    evaluated: alerts.length,
    triggered: triggeredIds.length
  }), { headers: { 'Content-Type': 'application/json' } });
};

export const config = { schedule: '*/15 12-22 * * 1-5' };
