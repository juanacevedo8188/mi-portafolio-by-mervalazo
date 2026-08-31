# Mervalazo

Sitio estático de la comunidad Mervalazo. Páginas:

- `index.html` — **Dashboard**: dólar, top ganadores del mercado, top cripto y top acciones argentinas.
- `cartera.html` — Cartera modelo de la comunidad, con precios y variaciones en vivo de acciones y CEDEARs argentinos ([data912.com](https://data912.com)).
- `mi-portafolio.html` — Cuentas personales: cada usuario carga sus propias posiciones.
- `portafolio-publico.html` — Vista pública de solo lectura de un portafolio personal, para compartir por link (ver "Compartir portafolio" más abajo).
- `buscar.html` — Buscador de cualquier activo (acción, CEDEAR o cripto) con lista de seguimiento.

La navegación entre páginas (`nav.js`) es compartida — se inyecta en cada una llamando a `renderNavTabs('<clave>')`.

## Actualizar la cartera modelo

Editá `portfolio.js`. Cada posición es:

```js
{ ticker: "GGAL", tipo: "accion", cantidad: 100, precioCompra: 6200 }
```

- `ticker`: símbolo exacto como cotiza en ByMA (ver [data912.com/live/arg_stocks](https://data912.com/live/arg_stocks) o `arg_cedears`).
- `tipo`: `"accion"` o `"cedear"` (solo cambia la etiqueta en la tabla).
- `sector`: agrupa la tabla, el donut de composición y las métricas rápidas.
- `cantidad`: nominales en cartera.
- `precioCompra`: precio promedio de compra en pesos.

Los precios actuales, variación diaria y variación total se calculan solos al cargar la página — no hace falta tocar nada más.

## Mi Portafolio (cuentas personales)

Cada miembro se registra con mail y contraseña y carga sus propias posiciones, guardadas en Supabase (tabla `holdings`, con seguridad por usuario). Setup en Supabase:

1. SQL Editor → correr `supabase/schema.sql` y después `supabase/schema_v2.sql`.
2. `supabase-config.js` ya tiene la URL y la anon key del proyecto — no hace falta tocarlo salvo que cambies de proyecto.
3. **Authentication → URL Configuration**: Site URL y Redirect URLs apuntando al dominio de Netlify (con `/mi-portafolio.html`).
4. El plan gratis de Supabase manda mails (confirmación de cuenta, recuperación de contraseña) con un límite muy bajo (2-4/hora), pensado solo para pruebas. Para producción, conectar SMTP propio en **Authentication → SMTP Settings** (por ejemplo [Resend](https://resend.com), gratis hasta 3.000 mails/mes).

## Compartir portafolio

Desde "Mi Portafolio" cada usuario puede hacer público su portafolio con un switch: se genera un link (`portafolio-publico.html?u=<slug>`) que cualquiera puede ver, sin necesidad de cuenta ni login, en modo solo lectura (no puede editar ni ver el mail del dueño).

Por defecto la vista pública **no muestra montos en pesos/dólares** — solo porcentajes (rendimiento, variación diaria, composición por sector, evolución indexada a 100). El dueño puede activar "Mostrar montos" si quiere que se vean los valores reales.

Esto NO se resuelve con políticas de RLS que dejen leer `holdings`/`portfolio_snapshots` públicamente: RLS decide qué *filas* se ven, no qué *columnas*, así que no hay forma de esconder la cantidad/precio de compra condicionalmente según el flag `show_amounts` de cada fila. En cambio, `netlify/functions/public-portfolio.mjs` resuelve todo con la service-role key (sin pasar por RLS) y decide qué campos mandar antes de que el dato salga de Netlify — si `show_amounts` es `false`, la cantidad y los montos ni se incluyen en la respuesta.

Setup en Supabase: correr `supabase/schema_v11.sql` (después de todos los anteriores). Solo crea la tabla `profiles` (`is_public`, `show_amounts`, `public_slug`) — no agrega ninguna política pública sobre `holdings` ni `portfolio_snapshots`.

## Historial y evolución

Una función programada de Netlify (`netlify/functions/snapshot-portfolios.mjs`) guarda una foto diaria del valor de la Cartera Mervalazo y de cada portafolio personal, así se puede graficar la evolución en el tiempo. Setup:

1. En Supabase: **Project Settings → API → service_role key** (secreta, no la compartas ni la subas a git).
2. En Netlify: **Site configuration → Environment variables** → agregá `SUPABASE_SERVICE_ROLE_KEY` con ese valor.
3. Corre sola todos los días de semana a las 18hs (Argentina). Para generar el primer dato ya mismo sin esperar, después de deployar entrá a `https://tu-sitio.netlify.app/.netlify/functions/snapshot-portfolios` una vez.
4. El gráfico de evolución necesita al menos 2 días de historial para mostrar algo — hasta entonces muestra un aviso.

## Probar en local

```bash
python -m http.server 8080
```

y abrir `http://localhost:8080`.

## Deploy a Netlify

1. Subí esta carpeta a un repo de GitHub (o arrastrala directo a [app.netlify.com/drop](https://app.netlify.com/drop)).
2. En Netlify: "Add new site" → conectá el repo. No hace falta build command ni carpeta de salida especial (es un sitio estático, `index.html` en la raíz).
3. Cada vez que edites `portfolio.js` y hagas push, Netlify redeploya solo.
