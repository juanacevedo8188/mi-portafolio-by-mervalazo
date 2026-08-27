// Deshace el backfill de portfolio_snapshots: borra los días
// reconstruidos artificialmente (backfill-personal-history.mjs). Para
// carteras personales no tiene sentido "inventar" historial previo a que
// el usuario haya cargado sus tenencias — la Evolución tiene que arrancar
// desde el primer día real que el cron diario la registre.
// Invocación puntual, se borra después de usarse.

const DATES = ['2026-08-21', '2026-08-24', '2026-08-25', '2026-08-26'];
const SUPABASE_URL = 'https://rdpwpcgaarbnpotxcvzz.supabase.co';

export default async () => {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return new Response('Falta la variable de entorno SUPABASE_SERVICE_ROLE_KEY en Netlify', { status: 500 });
  }
  const dateFilter = DATES.map(d => `"${d}"`).join(',');
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/portfolio_snapshots?snapshot_date=in.(${dateFilter})`,
    {
      method: 'DELETE',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: 'return=representation'
      }
    }
  );
  const deleted = await res.json().catch(() => null);
  return new Response(JSON.stringify({ ok: res.ok, status: res.status, deletedCount: Array.isArray(deleted) ? deleted.length : null }), {
    headers: { 'Content-Type': 'application/json' }
  });
};
