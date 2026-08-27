const NAV_GROUPS = [
  {
    key: 'mercado',
    label: 'Mercado',
    items: [
      { key: 'dashboard', label: 'Dashboard', href: 'index.html' },
      { key: 'heatmap', label: 'Heatmap', href: 'heatmap.html' },
      { key: 'rentafija', label: 'Renta Fija', href: 'renta-fija.html' },
      { key: 'commodities', label: 'Commodities', href: 'commodities.html' },
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
      { key: 'opciones', label: 'Calculadora de Opciones', href: 'opciones.html' }
    ]
  },
  { key: 'portafolio', label: 'Mi Portafolio', href: 'mi-portafolio.html' },
  { key: 'buscar', label: 'Buscar', href: 'buscar.html' },
  { key: 'aprender', label: 'Aprender', href: 'https://mervalazo.netlify.app', external: true }
];

function renderNavTabs(active) {
  const el = document.getElementById('navTabs');
  if (!el) return;

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
