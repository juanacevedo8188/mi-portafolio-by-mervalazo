const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', href: 'index.html' },
  { key: 'cartera', label: 'Cartera Mervalazo', href: 'cartera.html' },
  { key: 'rentafija', label: 'Renta Fija', href: 'renta-fija.html' },
  { key: 'portafolio', label: 'Mi Portafolio', href: 'mi-portafolio.html' },
  { key: 'buscar', label: 'Buscar', href: 'buscar.html' },
  { key: 'aprender', label: 'Aprender', href: 'https://mervalazo.netlify.app', external: true }
];

function renderNavTabs(active) {
  const el = document.getElementById('navTabs');
  if (!el) return;
  el.innerHTML = NAV_ITEMS.map(item => {
    const isActive = item.key === active;
    const attrs = item.external ? ' target="_blank" rel="noopener"' : '';
    return `<a href="${item.href}"${attrs} class="nav-tab${isActive ? ' active' : ''}">${item.label}</a>`;
  }).join('');
}
