import { api, formatPrice } from './api.js';
import { productCard, skeletonCards, stateHtml, bindCardGrid, esc, icon, EMPTY_TEXT, ERROR_TEXT } from './ui.js';

const LIMIT = 12;
const grid = document.querySelector('[data-grid]');
const countEl = document.querySelector('[data-count]');
const countInline = document.querySelector('[data-count-inline]');
const form = document.querySelector('[data-filters-form]');
const sortEl = document.querySelector('[data-sort]');
const pager = document.querySelector('[data-pagination]');
const activeEl = document.querySelector('[data-active-filters]');
const filtersPanel = document.getElementById('filters');
const backdrop = document.querySelector('[data-filters-backdrop]');
const titleEl = document.querySelector('[data-shop-title]');

const store = new Map();
let meta = { brands: [], categories: [], sizes: [] };
let controller;

// L'état des filtres vit dans l'URL : liens partageables, bouton retour fonctionnel.
const KEYS = ['q', 'brand', 'category', 'minPrice', 'maxPrice', 'size', 'promo', 'inStock', 'sort', 'page'];
const readState = () => {
  const p = new URLSearchParams(location.search);
  return Object.fromEntries(KEYS.filter((k) => p.get(k)).map((k) => [k, p.get(k)]));
};
function writeState(state, push = true) {
  const p = new URLSearchParams();
  KEYS.forEach((k) => state[k] && p.set(k, state[k]));
  const url = `${location.pathname}${p.toString() ? `?${p}` : ''}`;
  history[push ? 'pushState' : 'replaceState'](null, '', url);
}

function stateFromForm() {
  const fd = new FormData(form);
  const list = (name) => fd.getAll(name).join(',');
  const s = {
    q: fd.get('q')?.trim(),
    brand: list('brand'),
    category: list('category'),
    minPrice: fd.get('minPrice'),
    maxPrice: fd.get('maxPrice'),
    size: form.querySelector('[data-size-btn][aria-pressed="true"]')?.dataset.size || '',
    promo: fd.get('promo') ? '1' : '',
    inStock: fd.get('inStock') ? '1' : '',
    sort: sortEl.value !== 'newest' ? sortEl.value : '',
  };
  return Object.fromEntries(Object.entries(s).filter(([, v]) => v));
}

function fillForm(state) {
  form.q.value = state.q || '';
  form.minPrice.value = state.minPrice || '';
  form.maxPrice.value = state.maxPrice || '';
  form.promo.checked = Boolean(state.promo);
  form.inStock.checked = Boolean(state.inStock);
  const brands = (state.brand || '').toLowerCase().split(',');
  form.querySelectorAll('[name="brand"]').forEach((c) => { c.checked = brands.includes(c.value.toLowerCase()); });
  const cats = (state.category || '').split(',');
  form.querySelectorAll('[name="category"]').forEach((c) => { c.checked = cats.includes(c.value); });
  form.querySelectorAll('[data-size-btn]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.size === state.size)));
  sortEl.value = state.sort || 'newest';
}

function renderFilterOptions() {
  form.querySelector('[data-filter-brands]').innerHTML = meta.brands
    .map((b) => `<label class="check"><input type="checkbox" name="brand" value="${esc(b)}"><span>${esc(b)}</span></label>`)
    .join('');
  form.querySelector('[data-filter-categories]').innerHTML = meta.categories
    .map((c) => `<label class="check"><input type="checkbox" name="category" value="${c.key}"><span>${esc(c.label)}</span><span>${c.count}</span></label>`)
    .join('');
  form.querySelector('[data-filter-sizes]').innerHTML = meta.sizes
    .map((s) => `<button type="button" class="size-chip" data-size-btn data-size="${s}" aria-pressed="false">${s}</button>`)
    .join('');
  if (meta.price?.max) form.maxPrice.placeholder = String(meta.price.max);
}

function renderActive(state) {
  const chips = [];
  const label = {
    q: (v) => `« ${v} »`,
    promo: () => 'En promotion',
    inStock: () => 'En stock',
    size: (v) => `Pointure ${v}`,
    minPrice: (v) => `Min ${formatPrice(Number(v))}`,
    maxPrice: (v) => `Max ${formatPrice(Number(v))}`,
  };
  for (const [k, v] of Object.entries(state)) {
    if (k === 'brand' || k === 'category') {
      v.split(',').forEach((item) => {
        const text = k === 'category' ? meta.categories.find((c) => c.key === item)?.label || item : item;
        chips.push(`<button class="chip" type="button" data-remove="${k}" data-value="${esc(item)}">${esc(text)} ${icon('close')}</button>`);
      });
    } else if (label[k]) {
      chips.push(`<button class="chip" type="button" data-remove="${k}">${esc(label[k](v))} ${icon('close')}</button>`);
    }
  }
  if (chips.length > 1) chips.push('<button class="chip chip--clear" type="button" data-remove="all">Tout effacer</button>');
  activeEl.innerHTML = chips.join('');
  activeEl.hidden = !chips.length;
}

function renderPager(page, pages) {
  if (pages <= 1) { pager.innerHTML = ''; return; }
  const btn = (p, text = p, attrs = '') => `<button type="button" data-page="${p}" ${p === page ? 'aria-current="page"' : ''} ${attrs}>${text}</button>`;
  const out = [btn(page - 1, icon('left'), `aria-label="Page précédente" ${page === 1 ? 'disabled' : ''}`)];
  for (let p = 1; p <= pages; p += 1) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) out.push(btn(p));
    else if (Math.abs(p - page) === 2) out.push('<span aria-hidden="true" style="align-self:center">…</span>');
  }
  out.push(btn(page + 1, icon('right'), `aria-label="Page suivante" ${page === pages ? 'disabled' : ''}`));
  pager.innerHTML = out.join('');
}

async function load({ scroll = false } = {}) {
  const state = readState();
  fillForm(state);
  renderActive(state);
  titleEl.textContent = state.promo ? 'Promotions' : state.sort === 'newest' && Object.keys(state).length === 1 ? 'Nouveautés' : 'Boutique';

  controller?.abort();
  controller = new AbortController();
  grid.setAttribute('aria-busy', 'true');
  grid.innerHTML = skeletonCards(8);
  countEl.textContent = 'Chargement…';

  const params = new URLSearchParams({ ...state, limit: String(LIMIT) });
  try {
    const { items, total, page, pages } = await api(`/products?${params}`, { signal: controller.signal });
    items.forEach((p) => store.set(p.id, p));
    const hasFilters = Object.keys(state).some((k) => !['sort', 'page'].includes(k));
    if (items.length) {
      grid.innerHTML = items.map((p, i) => productCard(p, { eager: i < 4 })).join('');
    } else if (state.promo && Object.keys(state).filter((k) => !['sort', 'page'].includes(k)).length === 1) {
      grid.innerHTML = stateHtml('empty', 'Aucune promotion en cours.', 'Revenez bientôt : nos offres sont annoncées dans la newsletter.', '<a class="btn btn--dark btn--sm" href="/boutique">Voir toute la boutique</a>');
    } else if (hasFilters) {
      grid.innerHTML = stateHtml('empty', 'Aucun produit ne correspond à ces filtres.', 'Essayez d’élargir la recherche ou de retirer un filtre.', '<button class="btn btn--dark btn--sm" type="button" data-remove="all">Effacer les filtres</button>');
    } else {
      grid.innerHTML = stateHtml('empty', EMPTY_TEXT, '');
    }
    countEl.innerHTML = `<b>${total}</b> produit${total > 1 ? 's' : ''}`;
    countInline.textContent = `(${total})`;
    renderPager(page, pages);
    if (scroll) document.querySelector('.shop').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    if (err.name === 'AbortError') return;
    grid.innerHTML = stateHtml('error', ERROR_TEXT, '', '<button class="btn btn--dark btn--sm" type="button" data-retry>Réessayer</button>');
    countEl.textContent = '';
    pager.innerHTML = '';
  } finally {
    grid.setAttribute('aria-busy', 'false');
  }
}

function apply(state, opts) {
  writeState(state);
  load(opts);
}

// ---- événements ----
let debounce;
form.addEventListener('input', (e) => {
  clearTimeout(debounce);
  const delay = e.target.type === 'search' || e.target.type === 'number' ? 400 : 0;
  debounce = setTimeout(() => apply(stateFromForm()), delay);
});
form.addEventListener('submit', (e) => e.preventDefault());
form.addEventListener('click', (e) => {
  const b = e.target.closest('[data-size-btn]');
  if (!b) return;
  const on = b.getAttribute('aria-pressed') !== 'true';
  form.querySelectorAll('[data-size-btn]').forEach((x) => x.setAttribute('aria-pressed', 'false'));
  b.setAttribute('aria-pressed', String(on));
  apply(stateFromForm());
});
sortEl.addEventListener('change', () => apply(stateFromForm()));
pager.addEventListener('click', (e) => {
  const b = e.target.closest('[data-page]');
  if (!b || b.disabled) return;
  apply({ ...readState(), page: b.dataset.page === '1' ? '' : b.dataset.page }, { scroll: true });
});
document.addEventListener('click', (e) => {
  const chip = e.target.closest('[data-remove]');
  if (chip) {
    const state = readState();
    const k = chip.dataset.remove;
    if (k === 'all') apply(state.sort ? { sort: state.sort } : {});
    else if (chip.dataset.value) {
      const rest = state[k].split(',').filter((v) => v !== chip.dataset.value).join(',');
      apply({ ...state, [k]: rest, page: '' });
    } else apply({ ...state, [k]: '', page: '' });
  }
  if (e.target.closest('[data-retry]')) load();
});
window.addEventListener('popstate', () => load());
bindCardGrid(grid, (id) => store.get(id));

// tiroir de filtres (mobile)
function setFilters(open) {
  filtersPanel.classList.toggle('is-open', open);
  backdrop.classList.toggle('is-open', open);
  document.body.classList.toggle('no-scroll', open);
}
document.querySelector('[data-filters-open]').addEventListener('click', () => setFilters(true));
document.querySelectorAll('[data-filters-close]').forEach((b) => b.addEventListener('click', () => setFilters(false)));
backdrop.addEventListener('click', () => setFilters(false));
document.querySelector('[data-filters-reset]').addEventListener('click', () => apply({}));
document.addEventListener('keydown', (e) => e.key === 'Escape' && setFilters(false));

// ---- démarrage ----
load(); // produits et options de filtres chargés en parallèle
api('/products/meta')
  .then((m) => {
    meta = m;
    renderFilterOptions();
    fillForm(readState());
    renderActive(readState());
  })
  .catch(() => {});
