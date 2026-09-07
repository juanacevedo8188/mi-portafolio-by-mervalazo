const NAV_GROUPS = [
  {
    key: 'mercado',
    label: 'Mercado',
    items: [
      { key: 'dashboard', label: 'Dashboard', href: 'index.html' },
      { key: 'heatmap', label: 'Heatmap', href: 'heatmap.html' },
      { key: 'rentafija', label: 'Renta Fija', href: 'renta-fija.html' },
      { key: 'futuros', label: 'Futuros de Dólar', href: 'futuros.html' },
      { key: 'commodities', label: 'Commodities', href: 'commodities.html' },
      { key: 'tecnico', label: 'Análisis Técnico', href: 'analisis-tecnico.html' },
      { key: 'earnings', label: 'Calendario de Earnings', href: 'earnings.html' }
    ]
  },
  { key: 'cartera', label: 'Cartera Mervalazo', href: 'cartera.html' },
  {
    key: 'herramientas',
    label: 'Herramientas',
    items: [
      { key: 'macro', label: 'Macroeconomía', href: 'macroeconomia.html' },
      { key: 'inflacion', label: 'Calculadora de Inflación', href: 'inflacion.html' },
      { key: 'opciones', label: 'Calculadora de Opciones', href: 'opciones.html' },
      { key: 'capm', label: 'Calculadora CAPM', href: 'capm.html' },
      { key: 'markowitz', label: 'Frontera Eficiente', href: 'markowitz.html' },
      { key: 'vtd', label: 'Calculadora Financiera', href: 'calculadora-financiera.html' }
    ]
  },
  { key: 'portafolio', label: 'Mi Portafolio', href: 'mi-portafolio.html' },
  { key: 'alertas', label: 'Alertas', href: 'alertas.html' },
  { key: 'buscar', label: 'Buscar', href: 'buscar.html' }
];

// Grupos abiertos en el drawer de mobile. Se inicializa (una sola vez por
// pagina, no en cada render) con el grupo de la pagina activa ya abierto,
// para que el usuario vea de entrada donde esta parado -- pero a partir
// de ahi es el usuario quien manda: si lo cierra a mano, toggleDrawerGroup()
// no lo vuelve a forzar abierto en el proximo render.
let drawerOpenGroups = new Set();
let drawerActiveKey = null;

function renderNavTabs(active) {
  const el = document.getElementById('navTabs');
  if (el) {
    const renderLink = item => {
      const isActive = item.key === active;
      const attrs = item.external ? ' target="_blank" rel="noopener"' : '';
      return `<a href="${item.href}"${attrs} class="nav-tab${isActive ? ' active' : ''}">${item.label}</a>`;
    };

    el.innerHTML = NAV_GROUPS.map(entry => {
      if (!entry.items) return renderLink(entry);
      const activeItem = entry.items.find(i => i.key === active);
      return `<div class="nav-dropdown">
        <button class="nav-tab nav-dropdown-btn${activeItem ? ' active' : ''}" onclick="toggleNavDropdown(event)">
          ${activeItem ? activeItem.label : entry.label}<span class="nav-caret">▾</span>
        </button>
        <div class="nav-dropdown-menu">
          ${entry.items.map(i => `<a href="${i.href}" class="nav-dropdown-item${i.key === active ? ' active' : ''}">${i.label}</a>`).join('')}
        </div>
      </div>`;
    }).join('');
  }

  // Solo re-inicializa que grupo arranca abierto cuando active realmente
  // cambia (primera carga de esta pagina) -- si ya estabamos en esta
  // misma pagina y esto se llama de nuevo, no le pisa la eleccion manual
  // del usuario.
  if (drawerActiveKey !== active) {
    drawerOpenGroups = new Set();
    const activeGroup = NAV_GROUPS.find(g => g.items && g.items.some(i => i.key === active));
    if (activeGroup) drawerOpenGroups.add(activeGroup.key);
  }
  drawerActiveKey = active;

  ensureDrawer();
  const drawerItems = document.getElementById('drawerItems');
  if (drawerItems) drawerItems.innerHTML = buildDrawerItemsHtml(active);
}

// En mobile la barra de arriba (con scroll horizontal) se reemplaza por
// un botón hamburguesa + panel lateral, para no "inundar" la parte de
// arriba de la pantalla — en desktop sigue igual, con CSS decidiendo cuál
// de los dos se ve segun el ancho (ver .hamburger-btn/.nav-tabs en
// styles.css).
//
// Los grupos con sub-items (Mercado, Herramientas) son acordeón: por
// defecto colapsados, salvo el que contiene la pagina activa (asi el
// usuario ve de entrada donde esta parado) -- antes se mostraban todos
// los sub-items de todos los grupos siempre desplegados, lo que hacia el
// menu larguisimo en mobile.
function buildDrawerItemsHtml(active) {
  return NAV_GROUPS.map(entry => {
    if (!entry.items) {
      const isActive = entry.key === active;
      const attrs = entry.external ? ' target="_blank" rel="noopener"' : '';
      return `<a href="${entry.href}"${attrs} class="drawer-item${isActive ? ' active' : ''}">${entry.label}</a>`;
    }
    const hasActive = entry.items.some(i => i.key === active);
    const isOpen = drawerOpenGroups.has(entry.key);
    const items = entry.items.map(i =>
      `<a href="${i.href}" class="drawer-item drawer-subitem${i.key === active ? ' active' : ''}">${i.label}</a>`
    ).join('');
    return `<button type="button" class="drawer-group-toggle${isOpen ? ' open' : ''}${hasActive ? ' has-active' : ''}" onclick="toggleDrawerGroup('${entry.key}')">
      <span>${entry.label}</span><span class="drawer-group-caret">▾</span>
    </button>
    <div class="drawer-group-items" style="display:${isOpen ? 'flex' : 'none'};">${items}</div>`;
  }).join('');
}

function toggleDrawerGroup(key) {
  if (drawerOpenGroups.has(key)) drawerOpenGroups.delete(key); else drawerOpenGroups.add(key);
  const drawerItems = document.getElementById('drawerItems');
  if (drawerItems) drawerItems.innerHTML = buildDrawerItemsHtml(drawerActiveKey);
}

function ensureDrawer() {
  if (document.getElementById('navDrawer')) return;

  const headerInner = document.querySelector('.header-inner');
  if (headerInner) {
    const btn = document.createElement('button');
    btn.className = 'hamburger-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Abrir menú');
    btn.onclick = toggleDrawer;
    btn.innerHTML = '<span></span><span></span><span></span>';
    headerInner.insertBefore(btn, headerInner.firstChild);
  }

  const backdrop = document.createElement('div');
  backdrop.id = 'drawerBackdrop';
  backdrop.className = 'drawer-backdrop';
  backdrop.onclick = closeDrawer;
  document.body.appendChild(backdrop);

  const drawer = document.createElement('nav');
  drawer.id = 'navDrawer';
  drawer.className = 'drawer';
  drawer.innerHTML = `
    <div class="drawer-head">
      <span class="drawer-title">Mervalazo</span>
      <button class="drawer-close" type="button" onclick="closeDrawer()" aria-label="Cerrar menú">✕</button>
    </div>
    <div class="drawer-items" id="drawerItems"></div>
  `;
  document.body.appendChild(drawer);
}

function toggleDrawer() {
  const drawer = document.getElementById('navDrawer');
  if (drawer.classList.contains('open')) closeDrawer(); else openDrawer();
}
function openDrawer() {
  document.getElementById('navDrawer').classList.add('open');
  document.getElementById('drawerBackdrop').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeDrawer() {
  document.getElementById('navDrawer').classList.remove('open');
  document.getElementById('drawerBackdrop').classList.remove('open');
  document.body.style.overflow = '';
}

function toggleNavDropdown(e) {
  e.stopPropagation();
  const wrap = e.currentTarget.closest('.nav-dropdown');
  const wasOpen = wrap.classList.contains('open');
  document.querySelectorAll('.nav-dropdown.open').forEach(w => w.classList.remove('open'));
  if (!wasOpen) {
    // position:fixed calculado a mano: la barra de tabs tiene overflow-x:auto,
    // que en la mayoria de los navegadores tambien recorta el eje Y — con
    // absolute el menu quedaria cortado.
    const rect = e.currentTarget.getBoundingClientRect();
    const menu = wrap.querySelector('.nav-dropdown-menu');
    menu.style.top = (rect.bottom + 8) + 'px';
    menu.style.left = rect.left + 'px';
    wrap.classList.add('open');
  }
}

document.addEventListener('click', () => {
  document.querySelectorAll('.nav-dropdown.open').forEach(w => w.classList.remove('open'));
});
