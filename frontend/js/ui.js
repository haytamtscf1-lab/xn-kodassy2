import { formatPrice } from './api.js';
import { cart } from './cart.js';

export const FALLBACK_IMG = '/images/placeholder.svg';

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const icon = (name, cls = 'icon') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

export const imgSrc = (url) => (url ? esc(url) : FALLBACK_IMG);

// Image de secours globale : toute image cassée est remplacée par le visuel par défaut.
document.addEventListener(
  'error',
  (e) => {
    const el = e.target;
    if (el.tagName === 'IMG' && !el.dataset.fallback) {
      el.dataset.fallback = '1';
      el.src = FALLBACK_IMG;
    }
  },
  true
);

export function stockInfo(p) {
  if (!p.inStock) return { cls: 'stock--out', label: 'Rupture de stock' };
  if (p.stock <= 5) return { cls: 'stock--low', label: `Plus que ${p.stock} en stock` };
  return { cls: 'stock--in', label: 'Disponible' };
}

export function priceHtml(p) {
  const promo = p.oldPrice && p.oldPrice > p.price;
  return `<div class="price${promo ? ' price--promo' : ''}">
    <span class="price__now">${formatPrice(p.price)}</span>
    ${promo ? `<s class="price__old"><span class="sr-only">Ancien prix : </span>${formatPrice(p.oldPrice)}</s>` : ''}
  </div>`;
}

export function badgesHtml(p) {
  const out = [];
  if (p.discount > 0) out.push(`<span class="badge badge--promo"><span>-${p.discount}%</span></span>`);
  if (p.isNew) out.push('<span class="badge badge--new"><span>Nouveau</span></span>');
  if (!p.inStock) out.push('<span class="badge badge--out"><span>Rupture</span></span>');
  return out.length ? `<div class="badges">${out.join('')}</div>` : '';
}

function sizesSummary(p) {
  const avail = p.sizes.filter((s) => s.stock > 0).map((s) => s.size);
  if (!avail.length) return 'Aucune pointure disponible';
  const range = avail.length > 1 ? `${avail[0]} à ${avail[avail.length - 1]}` : `${avail[0]}`;
  return `Pointures : ${range} <span class="muted">(${avail.length} dispo.)</span>`;
}

export function productCard(p, { eager = false } = {}) {
  const url = `/produit/${encodeURIComponent(p.slug)}`;
  const st = stockInfo(p);
  const img2 = p.images[1];
  return `<article class="card fade-in" data-product-id="${esc(p.id)}">
    <a class="card__media${img2 ? ' has-alt' : ''}" href="${url}" tabindex="-1" aria-hidden="true">
      ${badgesHtml(p)}
      ${img2 ? `<img class="alt" src="${imgSrc(img2)}" alt="" loading="lazy" decoding="async" width="600" height="600">` : ''}
      <img src="${imgSrc(p.images[0])}" alt="${esc(p.name)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async" width="600" height="600">
    </a>
    <div class="card__body">
      <div class="card__meta"><span>${esc(p.brand)}</span><span>${esc(p.categoryLabel)}</span></div>
      <h3 class="card__title"><a href="${url}">${esc(p.name)}</a></h3>
      <div class="card__sizes">${sizesSummary(p)}</div>
      ${priceHtml(p)}
      <span class="stock ${st.cls}">${st.label}</span>
      <div class="card__actions">
        <a class="btn btn--ghost btn--sm" href="${url}">Voir le produit</a>
        <button class="btn btn--sm" type="button" data-quick-add ${p.inStock ? '' : 'disabled'}>${p.inStock ? 'Ajouter au panier' : 'Épuisé'}</button>
      </div>
    </div>
    <div class="quick-size" role="dialog" aria-label="Choisir la pointure — ${esc(p.name)}">
      <div class="quick-size__head">Choisir la pointure <button type="button" data-quick-close aria-label="Fermer">${icon('close')}</button></div>
      <div class="quick-size__grid">
        ${p.sizes.map((s) => `<button type="button" class="size-chip" data-size="${s.size}" ${s.stock > 0 ? '' : 'disabled'} aria-label="Pointure ${s.size}${s.stock > 0 ? '' : ', épuisée'}">${s.size}</button>`).join('')}
      </div>
    </div>
  </article>`;
}

export function skeletonCards(n = 8) {
  return Array.from({ length: n }, () => `<div class="card skeleton" aria-hidden="true">
      <div class="card__media"></div>
      <div class="card__body"><div class="skel-line w-40"></div><div class="skel-line w-70 h-24"></div><div class="skel-line w-50"></div><div class="skel-line w-40 h-24"></div></div>
    </div>`).join('');
}

export function stateHtml(kind, title, text, action = '') {
  const ic = kind === 'error' ? icon('alert', 'icon') : icon('search', 'icon');
  return `<div class="state state--${kind}" role="${kind === 'error' ? 'alert' : 'status'}">${ic}<h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}${action}</div>`;
}

export const EMPTY_TEXT = 'Aucun produit disponible pour le moment.';
export const ERROR_TEXT = 'Impossible de charger les produits. Veuillez réessayer.';

export function starsHtml(rating) {
  return `<span class="stars" role="img" aria-label="${rating} sur 5">${Array.from({ length: 5 }, (_, i) => `<svg style="opacity:${i < Math.round(rating) ? 1 : 0.22}"><use href="#i-star"/></svg>`).join('')}</span>`;
}

export function toast({ title, text = '', image, link, error = false, timeout = 3800 }) {
  const zone = document.querySelector('[data-toasts]');
  if (!zone) return;
  const el = document.createElement('div');
  el.className = `toast${error ? ' toast--error' : ''}`;
  el.innerHTML = `${image && !error ? `<img src="${imgSrc(image)}" alt="">` : ''}
    <div><b>${esc(title)}</b>${text ? `<p>${esc(text)}</p>` : ''}${link ? `<a href="${esc(link.href)}">${esc(link.label)} →</a>` : ''}</div>`;
  zone.append(el);
  setTimeout(() => {
    el.classList.add('is-leaving');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }, timeout);
}

export function addToCart(product, size, quantity = 1) {
  cart.add(product, size, quantity);
  toast({
    title: 'Ajouté au panier',
    text: `${product.name} · Pointure ${size}${quantity > 1 ? ` · ×${quantity}` : ''}`,
    image: product.images?.[0],
    link: { href: '/panier', label: 'Voir le panier' },
  });
}

// Branche les boutons "Ajouter au panier" d'une grille de cartes.
export function bindCardGrid(container, getProduct) {
  container.addEventListener('click', (e) => {
    const card = e.target.closest('.card[data-product-id]');
    if (!card) return;
    const panel = card.querySelector('.quick-size');
    if (e.target.closest('[data-quick-add]')) {
      e.preventDefault();
      container.querySelectorAll('.quick-size.is-open').forEach((p) => p !== panel && p.classList.remove('is-open'));
      panel.classList.add('is-open');
      panel.querySelector('.size-chip:not(:disabled)')?.focus();
    } else if (e.target.closest('[data-quick-close]')) {
      panel.classList.remove('is-open');
      card.querySelector('[data-quick-add]')?.focus();
    } else if (e.target.closest('.size-chip')) {
      const size = Number(e.target.closest('.size-chip').dataset.size);
      const product = getProduct(card.dataset.productId);
      if (product) addToCart(product, size);
      panel.classList.remove('is-open');
    }
  });
  container.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') container.querySelectorAll('.quick-size.is-open').forEach((p) => p.classList.remove('is-open'));
  });
}

export function setLoading(btn, loading) {
  btn.classList.toggle('is-loading', loading);
  btn.disabled = loading;
}
