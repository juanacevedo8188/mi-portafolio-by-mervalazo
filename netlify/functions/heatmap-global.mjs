// Yahoo Finance no permite pedirse directo desde el navegador (no manda
// Access-Control-Allow-Origin), asi que esta funcion la llama del lado del
// servidor y le devuelve al sitio un JSON limpio, sin CORS de por medio.
//
// El market cap NO viene de Yahoo: los endpoints que lo devuelven (v7/quote,
// v10/quoteSummary) exigen un "crumb" autenticado que no se puede pedir sin
// login. Como el market cap acá solo se usa para el TAMAÑO relativo de cada
// caja del treemap (no como dato financiero exacto), se usa un valor
// aproximado (en miles de millones de USD) cargado a mano por ticker.
// Precio y variación % sí son en vivo, vía el endpoint de chart (igual que
// commodities.mjs).

const SECTORS = {
  'Tecnología': [
    ['AAPL', 3400], ['MSFT', 3100], ['NVDA', 3300], ['AVGO', 1400], ['ORCL', 500],
    ['CRM', 250], ['ADBE', 180], ['AMD', 250], ['QCOM', 180], ['TXN', 160],
    ['INTC', 100], ['IBM', 250], ['NOW', 190], ['AMAT', 150], ['MU', 130],
    ['LRCX', 110], ['PANW', 120], ['CSCO', 220]
  ],
  'Financiero': [
    ['BRK-B', 950], ['JPM', 700], ['V', 550], ['MA', 470], ['BAC', 320],
    ['WFC', 230], ['GS', 190], ['MS', 180], ['SPGI', 150], ['AXP', 190],
    ['C', 140], ['SCHW', 140], ['BLK', 150], ['PGR', 140]
  ],
  'Consumo Cíclico': [
    ['AMZN', 2000], ['TSLA', 900], ['HD', 400], ['MCD', 210], ['NKE', 90],
    ['LOW', 140], ['BKNG', 160], ['SBUX', 90], ['TJX', 140], ['ABNB', 80],
    ['GM', 55], ['F', 45]
  ],
  'Salud': [
    ['LLY', 700], ['UNH', 300], ['JNJ', 400], ['ABBV', 330], ['MRK', 250],
    ['TMO', 180], ['ABT', 190], ['DHR', 150], ['PFE', 140], ['AMGN', 150],
    ['ISRG', 180], ['GILD', 120], ['VRTX', 120], ['CVS', 80], ['MDT', 110], ['BMY', 100]
  ],
  'Comunicación': [
    ['GOOGL', 2200], ['META', 1500], ['NFLX', 350], ['DIS', 200], ['CMCSA', 150],
    ['T', 180], ['VZ', 170], ['TMUS', 240], ['WBD', 40]
  ],
  'Industrial': [
    ['GE', 200], ['CAT', 180], ['RTX', 170], ['UNP', 140], ['HON', 140],
    ['BA', 130], ['DE', 110], ['LMT', 110], ['UPS', 90], ['ADP', 110], ['GD', 70], ['EMR', 70]
  ],
  'Energía': [
    ['XOM', 480], ['CVX', 280], ['COP', 130], ['SLB', 60], ['EOG', 70],
    ['WMB', 70], ['PSX', 60], ['OXY', 45]
  ],
  'Consumo Defensivo': [
    ['WMT', 700], ['PG', 380], ['KO', 280], ['PEP', 200], ['COST', 400],
    ['PM', 200], ['MO', 90], ['MDLZ', 90], ['CL', 70], ['TGT', 50]
  ],
  'Materiales': [
    ['LIN', 220], ['SHW', 70], ['ECL', 70], ['FCX', 50], ['NEM', 50], ['APD', 60]
  ],
  'Utilities': [
    ['NEE', 150], ['DUK', 90], ['SO', 100], ['D', 50], ['AEP', 60], ['EXC', 40]
  ]
};

async function fetchOne(ticker, sector, marketCap) {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1mo`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (!res.ok) throw new Error('yahoo ' + res.status);
    const data = await res.json();
    const result = data.chart.result[0];
    const meta = result.meta;
    const closes = (result.indicators.quote[0].close || []).filter(v => v != null);
    const price = meta.regularMarketPrice;
    const prevClose = closes.length >= 2 ? closes[closes.length - 2] : null;
    return {
      symbol: ticker,
      name: meta.shortName || ticker,
      sector,
      marketCap,
      price,
      pct_change: prevClose ? ((price - prevClose) / prevClose) * 100 : null
    };
  } catch (err) {
    return { symbol: ticker, name: ticker, sector, marketCap, error: true };
  }
}

export default async () => {
  const jobs = [];
  Object.entries(SECTORS).forEach(([sector, list]) => {
    list.forEach(([ticker, marketCap]) => jobs.push(fetchOne(ticker, sector, marketCap)));
  });
  const rows = await Promise.all(jobs);
  return new Response(JSON.stringify(rows.filter(r => !r.error)), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60'
    }
  });
};
