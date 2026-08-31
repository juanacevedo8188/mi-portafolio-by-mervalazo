// Caucion bursatil en pesos (1 a 7 dias) via las paginas de perfil de
// rava.com — a diferencia de los futuros CAUC de ROFEX (que no tienen
// volumen real en la cuenta gratuita de Remarket), esta es la caucion
// real que se opera en BYMA, con volumen real y cierres diarios
// historicos. Las paginas de rava.com vienen server-renderizadas (no
// hace falta JS/WebSocket), pero no mandan CORS, asi que el navegador no
// puede pedirlas directo — esta funcion las trae del lado del servidor y
// devuelve solo los datos, parseados del HTML con regex (no hay una API
// JSON publica documentada para esto).

const TENORS = ['1D', '2D', '3D', '4D', '7D'];

function toNum(str) {
  if (str == null) return null;
  const s = str.trim();
  if (!s || s === '-') return null;
  const n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
}

function parseCaucionHtml(html) {
  const priceMatch = html.match(/<div class="p2-price">([^<]*)<\/div>/);
  const varMatch = html.match(/<div class="p2-var[^"]*">[\s\S]*?<span>([^<]*)<\/span>/);
  const statValue = label => {
    const m = html.match(new RegExp(`<dt>${label}<\\/dt><dd>([^<]*)<\\/dd>`));
    return m ? toNum(m[1]) : null;
  };

  // La tabla de "Cotizaciones historicas" es la primera <table> que
  // aparece despues de ese titulo — se recorta el HTML ahi para no
  // engancharse con otra tabla si la pagina tuviera mas de una.
  let history = [];
  const histIdx = html.indexOf('Cotizaciones hist');
  if (histIdx !== -1) {
    const tableStart = html.indexOf('<tbody>', histIdx);
    const tableEnd = html.indexOf('</tbody>', tableStart);
    if (tableStart !== -1 && tableEnd !== -1) {
      const body = html.slice(tableStart, tableEnd);
      const rowRe = /<tr>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>\s*<\/tr>/g;
      let m;
      while ((m = rowRe.exec(body))) {
        history.push({
          fecha: m[1].trim(),
          apertura: toNum(m[2]),
          maximo: toNum(m[3]),
          minimo: toNum(m[4]),
          cierre: toNum(m[5]),
          volumen: toNum(m[6])
        });
      }
    }
  }

  return {
    price: priceMatch ? toNum(priceMatch[1]) : null,
    varPct: varMatch ? toNum(varMatch[1].replace('%', '')) : null,
    anterior: statValue('Anterior'),
    apertura: statValue('Apertura'),
    maximo: statValue('Máximo'),
    minimo: statValue('Mínimo'),
    history
  };
}

async function fetchTenor(tenor) {
  const res = await fetch(`https://www.rava.com/perfil/CAUCION%20${tenor}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  if (!res.ok) return null;
  const html = await res.text();
  return parseCaucionHtml(html);
}

export default async (req) => {
  try {
    const results = await Promise.all(TENORS.map(async t => [t, await fetchTenor(t)]));
    const byTenor = {};
    results.forEach(([t, d]) => { if (d) byTenor[t] = d; });
    return new Response(JSON.stringify(byTenor), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=120' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err.message || err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
