# Mervalazo — Cartera

Página estática que muestra la cartera modelo de la comunidad Mervalazo, con precios y variaciones en vivo de acciones y CEDEARs argentinos (feed público de [data912.com](https://data912.com)).

## Actualizar la cartera

Editá `portfolio.js`. Cada posición es:

```js
{ ticker: "GGAL", tipo: "accion", cantidad: 100, precioCompra: 6200 }
```

- `ticker`: símbolo exacto como cotiza en ByMA (ver [data912.com/live/arg_stocks](https://data912.com/live/arg_stocks) o `arg_cedears`).
- `tipo`: `"accion"` o `"cedear"` (solo cambia la etiqueta en la tabla).
- `cantidad`: nominales en cartera.
- `precioCompra`: precio promedio de compra en pesos.

Los precios actuales, variación diaria y variación total se calculan solos al cargar la página — no hace falta tocar nada más.

## Probar en local

```bash
python -m http.server 8080
```

y abrir `http://localhost:8080`.

## Deploy a Netlify

1. Subí esta carpeta a un repo de GitHub (o arrastrala directo a [app.netlify.com/drop](https://app.netlify.com/drop)).
2. En Netlify: "Add new site" → conectá el repo. No hace falta build command ni carpeta de salida especial (es un sitio estático, `index.html` en la raíz).
3. Cada vez que edites `portfolio.js` y hagas push, Netlify redeploya solo.
