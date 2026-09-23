// Universo curado de ~300 tickers liquidos, compartido entre
// compute-indicators.mjs (score tecnico) y compute-fundamentals.mjs
// (score fundamental) -- antes vivia duplicado dentro de
// compute-indicators.mjs, se separo aca para que ambas funciones usen
// exactamente la misma lista sin riesgo de que se desincronicen.
export const TICKERS = [
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
