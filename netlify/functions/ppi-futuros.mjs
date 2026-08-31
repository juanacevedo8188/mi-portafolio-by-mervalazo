// Futuros de dolar via Portfolio Personal Inversiones (PPI) — a
// diferencia de la cuenta gratuita de ROFEX Remarket (que tiene huecos en
// algunos meses y cero volumen real, por ser un entorno de testing), la
// pagina publica de PPI trae los 12 meses completos con volumen real. Es
// una app Next.js que server-renderiza los datos en un bloque
// __NEXT_DATA__ dentro del HTML — no hay API JSON documentada, asi que
// esta funcion pide la pagina completa y parsea ese bloque.

const SOURCE_URL = 'https://www.portfoliopersonal.com/Cotizaciones/Futuros';

export default async (req) => {
  try {
    const res = await fetch(SOURCE_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    if (!res.ok) throw new Error('PPI futuros failed: ' + res.status);
    const html = await res.text();

    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!match) throw new Error('no se encontro __NEXT_DATA__ en la pagina de PPI');
    const data = JSON.parse(match[1]);
    const instruments = data?.props?.pageProps?.instruments || [];

    // Solo los contratos "outright" de un mes (DLR/MESAA) — se descartan
    // los spreads entre dos meses (DLR/AGO26/SEP26) y las variantes mini
    // ("M") o de subasta ("A"), que son otro producto.
    const byTicker = {};
    instruments
      .filter(i => /^DLR\/[A-Z]{3}[0-9]{2}$/.test(i.ticker))
      .forEach(i => {
        byTicker[i.ticker] = {
          price: i.lastPrice ?? i.previousClosing ?? null,
          varPct: i.variation ?? null,
          bid: i.pricePurchase || null,
          offer: i.priceSale || null,
          volumen: i.volumen || null,
          previousClosing: i.previousClosing ?? null,
          expirationDate: i.expirationDate ? i.expirationDate.slice(0, 10) : null
        };
      });

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
