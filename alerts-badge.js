// Campanita de alertas disparadas, para el header de las paginas que ya
// tienen login (mi-portafolio, buscar, alertas). Se llama despues de
// poblar #headerRight con el mail+logout del usuario (showApp/
// onAuthStateChange de cada pagina) — si no hay alertas disparadas no
// agrega nada, para no ensuciar el header de quien no usa la funcion.
//
// Es el unico lugar de la UI que hoy junta "notificaciones" — pensado
// para poder sumar mas tipos a futuro sin cambiar el header de cada
// pagina, solo lo que esta funcion agrega a la consulta.
//
// renderAlertsBadge se puede terminar llamando mas de una vez casi
// seguido en la misma carga de pagina (por ejemplo showApp() se dispara
// tanto desde sb.auth.getSession() como desde el primer evento de
// sb.auth.onAuthStateChange) — sin este control, dos llamadas en vuelo
// al mismo tiempo se pisaban: cada una se fijaba si la campanita ya
// existia ANTES de que la otra llegara a insertar la suya, y las dos
// terminaban insertando una copia. El numero de secuencia hace que solo
// el resultado de la llamada mas reciente pueda tocar el DOM.
let alertsBadgeSeq = 0;

async function renderAlertsBadge(sb) {
  const seq = ++alertsBadgeSeq;
  const slot = document.getElementById('headerRight');
  if (!slot) return;

  const { data, error } = await sb.from('alerts').select('id').eq('estado', 'disparada');
  if (seq !== alertsBadgeSeq) return; // una llamada mas nueva ya esta en curso — esta quedo vieja

  document.getElementById('alertsBell')?.remove();
  if (error || !data || !data.length) return;

  const bell = document.createElement('a');
  bell.id = 'alertsBell';
  bell.href = 'alertas.html';
  bell.className = 'alerts-bell';
  bell.title = data.length + ' alerta' + (data.length === 1 ? '' : 's') + ' disparada' + (data.length === 1 ? '' : 's');
  bell.innerHTML = '🔔<span class="alerts-badge-count">' + data.length + '</span>';
  slot.prepend(bell);
}
