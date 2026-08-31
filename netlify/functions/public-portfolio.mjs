// Datos para la vista publica de un portafolio compartido
// (portafolio-publico.html?u=<slug>).
//
// Por que esto NO se resuelve con sb.from('holdings').select() directo
// desde el navegador (como se hacia antes): la RLS solo puede decidir que
// FILAS son visibles, no que COLUMNAS — no hay forma de que una politica
// diga "esta fila se puede leer, pero solo estas columnas" de forma
// condicional segun el flag show_amounts de cada usuario. Con una politica
// publica sobre holdings/portfolio_snapshots, activar "compartir sin
// montos" en mi-portafolio.html escondia los pesos en la pantalla pero la
// cantidad y el precio de compra exactos seguian viajando enteros por la
// misma API publica (cualquiera con la anon key podia pedirlos igual).
//
// Por eso esta funcion resuelve todo del lado del servidor con la
// service-role key (bypassea RLS) y decide QUE CAMPOS mandar segun
// show_amounts antes de que el dato salga de Netlify — si show_amounts es
// false, la cantidad/precio de compra/valor absoluto ni se incluyen en la
// respuesta, no es solo que la UI los oculte.

import { getFullPriceMap } from '../../market-prices.mjs';

const SUPABASE_URL = 'https://rdpwpcgaarbnpotxcvzz.supabase.co';

async function getOficialRate() {
  const res = await fetch('https://dolarapi.com/v1/dolares/oficial');
  if (!res.ok) return null;
  const data = await res.json();
  return data.venta ?? null;
}

export default async (req) => {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return new Response(JSON.stringify({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY' }), { status: 500 });
  }
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

  const url = new URL(req.url);
  const slug = url.searchParams.get('slug');
  if (!slug) return new Response(JSON.stringify({ error: 'falta slug' }), { status: 400 });

  try {
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?public_slug=eq.${encodeURIComponent(slug)}&is_public=eq.true&select=id,display_name,show_amounts`,
      { headers }
    );
    const profiles = await profileRes.json();
    const profile = Array.isArray(profiles) ? profiles[0] : null;
    if (!profile) return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });

    const [holdingsRes, snapshotsRes, priceMap, oficialVenta] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/holdings?user_id=eq.${profile.id}&select=ticker,tipo,sector,cantidad,precio_compra&order=created_at.asc`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/portfolio_snapshots?user_id=eq.${profile.id}&select=snapshot_date,total_value&order=snapshot_date.asc`, { headers }),
      getFullPriceMap(),
      getOficialRate().catch(() => null)
    ]);
    const rawHoldings = await holdingsRes.json();
    const rawSnapshots = await snapshotsRes.json();
    const showAmounts = !!profile.show_amounts;

    const computed = (Array.isArray(rawHoldings) ? rawHoldings : []).map(h => {
      const q = priceMap.get(h.ticker);
      const isCrypto = h.tipo === 'cripto';
      const priceArs = q ? q.c : null;
      const priceNative = q ? (isCrypto ? q.usd : q.c) : null;
      const dailyPct = q ? q.pct_change ?? null : null;
      const valueArs = priceArs != null ? priceArs * h.cantidad : null;
      const totalPct = priceNative != null && h.precio_compra ? ((priceNative - h.precio_compra) / h.precio_compra) * 100 : null;
      const precioCompraArs = isCrypto ? (oficialVenta ? h.precio_compra * oficialVenta : null) : h.precio_compra;
      const costArs = precioCompraArs != null ? precioCompraArs * h.cantidad : null;
      // Si el ticker no matcheo en el feed de precios (found:false), no hay
      // valor de mercado — se usa el costo como mejor estimacion disponible
      // para que no falten posiciones en los totales/proporciones.
      const weightValueArs = valueArs ?? costArs ?? 0;
      return { ticker: h.ticker, tipo: h.tipo, sector: h.sector, found: !!q, dailyPct, totalPct, valueArs, cantidad: h.cantidad, precioCompraArs, costArs, weightValueArs };
    });

    const totalValueArs = computed.reduce((s, r) => s + r.weightValueArs, 0);

    const holdings = computed.map(r => {
      const base = { ticker: r.ticker, tipo: r.tipo, sector: r.sector, found: r.found, dailyPct: r.dailyPct, totalPct: r.totalPct };
      if (showAmounts) {
        return { ...base, cantidad: r.cantidad, precioCompraArs: r.precioCompraArs, costArs: r.costArs, priceArs: r.valueArs != null && r.cantidad ? r.valueArs / r.cantidad : null, valueArs: r.valueArs };
      }
      return { ...base, weightPct: totalValueArs ? (r.weightValueArs / totalValueArs) * 100 : 0 };
    });

    const snapshotList = Array.isArray(rawSnapshots) ? rawSnapshots : [];
    let snapshots;
    if (showAmounts) {
      snapshots = snapshotList.map(s => ({ date: s.snapshot_date, value: s.total_value }));
    } else {
      const base = snapshotList[0]?.total_value;
      snapshots = snapshotList.map(s => ({ date: s.snapshot_date, value: base ? (s.total_value / base) * 100 : 100 }));
    }

    return new Response(JSON.stringify({
      displayName: profile.display_name || null,
      showAmounts,
      holdings,
      snapshots
    }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=30' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err.message || err) }), { status: 500 });
  }
};
