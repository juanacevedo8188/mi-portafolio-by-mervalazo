// Cartera de Mervalazo — editá este archivo para actualizar las posiciones.
// ticker: símbolo exacto como aparece en ByMA (ej: GGAL, YPFD, VIST para CEDEAR).
// tipo: "accion" o "cedear" (solo para mostrar el tag en la tabla).
// sector: usado para agrupar la tabla y el gráfico de composición.
// cantidad: nominales en cartera.
// precioCompra: precio promedio de compra en pesos.
window.PORTFOLIO = {
  nombre: "Cartera Mervalazo",
  actualizado: "2026-08-25",
  holdings: [
    { ticker: "YPFD", tipo: "accion", sector: "Energía y O&G", cantidad: 75, precioCompra: 8071 },
    { ticker: "VIST", tipo: "cedear", sector: "Energía y O&G", cantidad: 20, precioCompra: 35241 },
    { ticker: "PAMP", tipo: "accion", sector: "Energía y O&G", cantidad: 50, precioCompra: 5070 },
    { ticker: "TGSU2", tipo: "accion", sector: "Infraestructura y Utilities", cantidad: 10, precioCompra: 8972 },
    { ticker: "CEPU", tipo: "accion", sector: "Infraestructura y Utilities", cantidad: 20, precioCompra: 2070 },
    { ticker: "ALUA", tipo: "accion", sector: "Materiales", cantidad: 30, precioCompra: 872 },
    { ticker: "TXAR", tipo: "accion", sector: "Materiales", cantidad: 50, precioCompra: 687 },
    { ticker: "GGAL", tipo: "accion", sector: "Bancos y Financiero", cantidad: 20, precioCompra: 6584 }
  ]
};
