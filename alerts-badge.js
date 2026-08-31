// Campanita de alertas disparadas, para el header de las paginas que ya
// tienen login (mi-portafolio, opciones, markowitz, buscar, alertas).
// Se llama despues de poblar #headerRight con el mail+logout del usuario
// (showApp/updateAuthUI de cada pagina) — si no hay alertas disparadas no
// agrega nada, para no ensuciar el header de quien no usa la funcion.
async function renderAlertsBadge(sb) {
  const slot = document.getElementById('headerRight');
  if (!slot) return;
  document.getElementById('alertsBell')?.remove();

  const { data, error } = await sb.from('alerts').select('id').eq('estado', 'disparada');
  if (error || !data || !data.length) return;

  const bell = document.createElement('a');
  bell.id = 'alertsBell';
  bell.href = 'alertas.html';
  bell.className = 'alerts-bell';
  bell.title = data.length + ' alerta' + (data.length === 1 ? '' : 's') + ' disparada' + (data.length === 1 ? '' : 's');
  bell.innerHTML = '🔔<span class="alerts-badge-count">' + data.length + '</span>';
  slot.prepend(bell);
}
