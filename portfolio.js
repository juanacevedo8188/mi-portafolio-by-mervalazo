// Cartera de Mervalazo — editá este archivo para actualizar las posiciones.
// ticker: símbolo exacto como aparece en ByMA (ej: GGAL, YPFD, AAPL para CEDEAR).
// tipo: "accion" o "cedear" (solo para mostrar el tag en la tabla).
// cantidad: nominales en cartera.
// precioCompra: precio promedio de compra en pesos.
window.PORTFOLIO = {
  nombre: "Cartera Mervalazo",
  actualizado: "2026-08-25",
  holdings: [
    { ticker: "GGAL", tipo: "accion", cantidad: 100, precioCompra: 6200 },
    { ticker: "YPFD", tipo: "accion", cantidad: 40, precioCompra: 32000 },
    { ticker: "PAMP", tipo: "accion", cantidad: 150, precioCompra: 3100 },
    { ticker: "BMA", tipo: "accion", cantidad: 60, precioCompra: 7200 },
    { ticker: "AAPL", tipo: "cedear", cantidad: 8, precioCompra: 22000 },
    { ticker: "MSFT", tipo: "cedear", cantidad: 5, precioCompra: 45000 },
    { ticker: "KO", tipo: "cedear", cantidad: 20, precioCompra: 8500 }
  ]
};
