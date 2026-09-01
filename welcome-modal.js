// Mini guía que aparece una sola vez, la primera vez que alguien se
// loguea (Google o mail/contraseña) — se guarda en profiles.has_seen_welcome
// para que no vuelva a aparecer ni siquiera si entra desde otro
// dispositivo. Usa el modal genérico ya compartido (openModal/closeModal
// en market.js), así que solo hace falta este archivo + llamar
// checkWelcomeModal(sb, session) después de mostrar la app.

async function checkWelcomeModal(sb, session) {
  const { data, error } = await sb.from('profiles').select('id,has_seen_welcome').eq('id', session.user.id).maybeSingle();
  if (error) { console.error(error); return; }

  let profile = data;
  if (!profile) {
    const { data: created, error: insertErr } = await sb.from('profiles').insert({ id: session.user.id }).select('id,has_seen_welcome').single();
    if (insertErr) { console.error(insertErr); return; }
    profile = created;
  }
  if (profile.has_seen_welcome) return;

  openModal(`
    <button class="modal-close" onclick="dismissWelcomeModal()">✕</button>
    <div class="modal-title" style="text-transform:none;">¡Bienvenido a Mervalazo!</div>
    <p class="welcome-intro">Una recorrida rápida por dónde encontrar cada cosa:</p>
    <div class="welcome-list">
      <div class="welcome-item"><b>Dashboard</b><span>Dólar, riesgo país y lo más movido del mercado, todo en vivo.</span></div>
      <div class="welcome-item"><b>Renta Fija</b><span>Letras, bonos, caución y carry trade, con tasas y curvas actualizadas.</span></div>
      <div class="welcome-item"><b>Futuros de Dólar</b><span>Los 12 contratos vigentes con su tasa implícita.</span></div>
      <div class="welcome-item"><b>Mi Portafolio</b><span>Cargá tus posiciones y seguí su evolución — podés compartirlo por link si querés.</span></div>
      <div class="welcome-item"><b>Alertas</b><span>Avisos de precio o de vencimiento, con campanita en el header.</span></div>
      <div class="welcome-item"><b>Buscar</b><span>Cualquier acción, CEDEAR o cripto, con lista de seguimiento.</span></div>
    </div>
    <button class="btn-primary" onclick="dismissWelcomeModal()">Entendido, empezar</button>
  `);
  window.__welcomeUserId = session.user.id;
}

async function dismissWelcomeModal() {
  closeModal();
  if (window.__welcomeUserId) {
    await sb.from('profiles').update({ has_seen_welcome: true }).eq('id', window.__welcomeUserId);
  }
}
