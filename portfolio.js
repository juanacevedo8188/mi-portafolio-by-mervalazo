// Cartera de Mervalazo — editá este archivo para actualizar las posiciones.
// ticker: símbolo exacto como aparece en ByMA (ej: GGAL, YPFD, VIST para CEDEAR).
// tipo: "accion" o "cedear" (solo para mostrar el tag en la tabla).
// sector: usado para agrupar la tabla y el gráfico de composición.
// cantidad: nominales en cartera.
// precioCompra: precio promedio de compra en pesos.
const PORTFOLIO = {
  nombre: "Cartera Mervalazo",
  actualizado: "2026-08-25",
  holdings: [
    { ticker: "YPFD", tipo: "accion", sector: "Energía y O&G", cantidad: 75, precioCompra: 8071 },
    { ticker: "VIST", tipo: "cedear", sector: "Energía y O&G", cantidad: 20, precioCompra: 35241 },
    { ticker: "PAMP", tipo: "accion", sector: "Energía y O&G", cantidad: 50, precioCompra: 5070 },
    { ticker: "TGSU2", tipo: "accion", sector: "Infraestructura y Utilities", cantidad: 35, precioCompra: 8972 },
    { ticker: "CEPU", tipo: "accion", sector: "Infraestructura y Utilities", cantidad: 40, precioCompra: 2070 },
    { ticker: "ALUA", tipo: "accion", sector: "Materiales", cantidad: 40, precioCompra: 872 },
    { ticker: "TXAR", tipo: "accion", sector: "Materiales", cantidad: 50, precioCompra: 687 },
    { ticker: "GGAL", tipo: "accion", sector: "Bancos y Financiero", cantidad: 50, precioCompra: 6584 }
  ]
};

// Se usa como <script> en el navegador y como require() en la función
// de Netlify que guarda el historial diario — por eso expone ambas formas.
if (typeof window !== 'undefined') window.PORTFOLIO = PORTFOLIO;
if (typeof module !== 'undefined') module.exports = PORTFOLIO;
