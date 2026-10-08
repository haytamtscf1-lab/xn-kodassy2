import { api, formatPrice } from './api.js';
import { productCard, skeletonCards, stateHtml, bindCardGrid, starsHtml, esc, EMPTY_TEXT, ERROR_TEXT } from './ui.js';

const store = new Map(); // id -> produit, pour l'ajout rapide au panier

async function loadSection(el, query, count) {
  el.innerHTML = skeletonCards(count);
  try {
    const { items } = await api(`/products?${query}`);
    items.forEach((p) => store.set(p.id, p));
    el.innerHTML = items.length ? items.map((p) => productCard(p)).join('') : stateHtml('empty', EMPTY_TEXT, '');
    return items;
  } catch {
    el.innerHTML = stateHtml('error', ERROR_TEXT, '', '<button class="btn btn--dark btn--sm" type="button" data-retry>Réessayer</button>');
    el.querySelector('[data-retry]').addEventListener('click', () => loadSection(el, query, count));
    return [];
  }
}

const sections = {
  new: ['sort=newest&limit=4', 4],
  best: ['sort=popular&limit=4', 4],
  promo: ['promo=1&sort=discount&limit=4', 4],
};
document.querySelectorAll('[data-products]').forEach((el) => {
  const [query, count] = sections[el.dataset.products];
  bindCardGrid(el, (id) => store.get(id));
  loadSection(el, query, count).then((items) => {
    if (el.dataset.products === 'promo') {
      const max = Math.max(0, ...items.map((p) => p.discount));
      const target = document.querySelector('[data-max-discount]');
      if (max && target) target.textContent = `-${max}`;
      if (!items.length) el.closest('section').hidden = true;
    }
  });
});

// Diaporama du hero : une chaussure différente toutes les 2 secondes, en boucle.
const SLIDE_MS = 2000;
(async function heroSlideshow() {
  const box = document.getElementById('hero-slides');
  const tag = document.getElementById('hero-tag');
  const dots = document.getElementById('hero-dots');
  let products;
  try {
    // Vedettes d'abord, puis les autres produits en stock
    const [feat, all] = await Promise.all([
      api('/products?featured=1&inStock=1&sort=popular&limit=20'),
      api('/products?inStock=1&sort=popular&limit=40'),
    ]);
    const seen = new Set();
    products = [...feat.items, ...all.items].filter((p) => p.images[0] && !seen.has(p.id) && seen.add(p.id));
  } catch {
    return; // l'image par défaut reste affichée
  }
  if (!products.length) return;

  const loaded = (img) => (img.complete && img.naturalWidth ? Promise.resolve() : new Promise((r) => { img.onload = r; img.onerror = r; }));
  const slides = products.map((p, i) => {
    const img = new Image();
    img.className = 'hero__slide';
    img.alt = p.name;
    img.width = 1200;
    img.height = 900;
    img.decoding = 'async';
    if (i === 0) img.src = p.images[0]; // les suivantes sont chargées juste avant d'être affichées
    return img;
  });
  await loaded(slides[0]);
  box.replaceChildren(...slides);

  let current = -1;
  function setTag(p) {
    tag.classList.add('is-changing');
    setTimeout(() => {
      tag.href = `/produit/${encodeURIComponent(p.slug)}`;
      tag.querySelector('span').textContent = p.name;
      tag.querySelector('b').textContent = formatPrice(p.price);
      tag.hidden = false;
      tag.classList.remove('is-changing');
    }, 150);
  }
  function show(i) {
    current = (i + slides.length) % slides.length;
    const next = slides[(current + 1) % slides.length];
    if (!next.src) next.src = products[(current + 1) % slides.length].images[0]; // préchargement
    if (!slides[current].src) slides[current].src = products[current].images[0];
    slides.forEach((s, k) => s.classList.toggle('is-active', k === current));
    dots.querySelectorAll('button').forEach((b, k) => b.setAttribute('aria-current', String(k === current)));
    setTag(products[current]);
  }

  if (slides.length > 1) {
    dots.innerHTML = products.map((p, i) => `<button type="button" aria-label="${esc(p.name)}" data-i="${i}"></button>`).join('');
    dots.hidden = false;
  }
  show(0);
  if (slides.length < 2) return;

  let timer;
  const start = () => { clearInterval(timer); timer = setInterval(() => show(current + 1), SLIDE_MS); };
  dots.addEventListener('click', (e) => {
    const b = e.target.closest('[data-i]');
    if (b) { show(Number(b.dataset.i)); start(); }
  });
  // Pause quand l'onglet n'est pas visible (économie de batterie), reprise au retour
  document.addEventListener('visibilitychange', () => (document.hidden ? clearInterval(timer) : start()));
  start();
})();

// Catégories + marques + compteur
api('/products/meta')
  .then((meta) => {
    const cats = document.querySelector('[data-categories]');
    const filled = meta.categories.filter((c) => c.count > 0);
    // Une seule catégorie en stock : la section n'apporte rien, on la masque.
    if (filled.length < 2) cats.closest('section').hidden = true;
    cats.innerHTML = filled
      .map((c) => `<a class="cat-card reveal is-visible" href="/boutique?category=${c.key}">
          <b aria-hidden="true">${esc(c.key.toUpperCase())}</b>
          <h3>${esc(c.label)}</h3><span>${c.count} modèle${c.count > 1 ? 's' : ''}</span></a>`)
      .join('');
    const brands = document.querySelector('[data-brands]');
    brands.innerHTML = meta.brands
      .map((b) => `<a class="brand-tile" href="/boutique?brand=${encodeURIComponent(b)}"><strong>${esc(b)}</strong><span>Voir la sélection</span></a>`)
      .join('');
    const total = meta.categories.reduce((s, c) => s + c.count, 0);
    const stat = document.querySelector('[data-stat="products"]');
    if (stat && total) stat.firstChild.textContent = `${total}`;
  })
  .catch(() => {
    document.querySelector('[data-categories]').innerHTML = stateHtml('error', 'Impossible de charger les catégories.', '');
  });

// Avis
api('/reviews?limit=6')
  .then(({ items, average, count }) => {
    const grid = document.querySelector('[data-reviews]');
    if (!items.length) {
      grid.closest('section').hidden = true;
      return;
    }
    grid.innerHTML = items
      .map((r) => `<blockquote class="review fade-in" style="margin:0">
        ${starsHtml(r.rating)}<p>« ${esc(r.comment)} »</p>
        <footer><span><b>${esc(r.name)}</b>${r.city ? ` · ${esc(r.city)}` : ''}</span>
        ${r.product ? `<a href="/produit/${encodeURIComponent(r.product.slug)}">${esc(r.product.name)}</a>` : ''}</footer></blockquote>`)
      .join('');
    const sum = document.querySelector('[data-rating-summary]');
    if (average) {
      sum.innerHTML = `<strong>${average.toFixed(1).replace('.', ',')}</strong><div>${starsHtml(average)}<div class="muted" style="font-size:14px">${count} avis vérifiés</div></div>`;
      sum.hidden = false;
    }
  })
  .catch(() => {
    document.querySelector('[data-reviews]').closest('section').hidden = true;
  });
