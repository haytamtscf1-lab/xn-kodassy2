import { api, formatPrice, getConfig } from './api.js';
import { cart } from './cart.js';
import {
  esc, icon, imgSrc, priceHtml, badgesHtml, stockInfo, productCard, skeletonCards, stateHtml,
  bindCardGrid, starsHtml, addToCart, setLoading,
} from './ui.js';

const info = document.querySelector('[data-info]');
const mainEl = document.querySelector('[data-gallery-main]');
const thumbsEl = document.querySelector('[data-gallery-thumbs]');
const sticky = document.querySelector('[data-sticky-buy]');

let product;
let selectedSize = null;
let current = 0;

// Données injectées par le serveur (SEO + affichage immédiat), sinon appel API.
async function loadProduct() {
  const embedded = document.getElementById('product-data');
  if (embedded?.textContent.trim().startsWith('{')) return JSON.parse(embedded.textContent);
  const slug = decodeURIComponent(location.pathname.split('/').pop());
  return api(`/products/${encodeURIComponent(slug)}`);
}

function renderGallery() {
  const imgs = product.images.length ? product.images : [null];
  mainEl.innerHTML = `${badgesHtml(product)}
    <img src="${imgSrc(imgs[current])}" alt="${esc(product.name)} — vue ${current + 1}" width="1000" height="1000" fetchpriority="high">
    ${imgs.length > 1 ? `<button class="gallery__nav gallery__nav--prev" type="button" data-step="-1" aria-label="Image précédente">${icon('left')}</button>
    <button class="gallery__nav gallery__nav--next" type="button" data-step="1" aria-label="Image suivante">${icon('right')}</button>` : ''}`;
  thumbsEl.innerHTML = imgs.length > 1
    ? imgs.map((src, i) => `<button type="button" role="listitem" data-index="${i}" aria-label="Voir l'image ${i + 1}" aria-current="${i === current}"><img src="${imgSrc(src)}" alt="" loading="lazy" width="84" height="84"></button>`).join('')
    : '';
}

function show(i) {
  const n = product.images.length || 1;
  current = (i + n) % n;
  mainEl.classList.remove('is-zoomed');
  renderGallery();
}

mainEl.addEventListener('click', (e) => {
  const step = e.target.closest('[data-step]');
  if (step) return show(current + Number(step.dataset.step));
  if (matchMedia('(hover: hover)').matches) {
    mainEl.classList.toggle('is-zoomed');
    const img = mainEl.querySelector('img');
    const r = mainEl.getBoundingClientRect();
    img.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
  }
});
mainEl.addEventListener('mousemove', (e) => {
  if (!mainEl.classList.contains('is-zoomed')) return;
  const r = mainEl.getBoundingClientRect();
  mainEl.querySelector('img').style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
});
thumbsEl.addEventListener('click', (e) => {
  const b = e.target.closest('[data-index]');
  if (b) show(Number(b.dataset.index));
});
// balayage tactile
let touchX = null;
mainEl.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
mainEl.addEventListener('touchend', (e) => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  if (Math.abs(dx) > 40) show(current + (dx < 0 ? 1 : -1));
  touchX = null;
});

function renderInfo(config) {
  const st = stockInfo(product);
  const promo = product.discount > 0;
  const free = config.freeShippingThreshold;
  info.innerHTML = `
    <div style="display:grid;gap:10px">
      <a class="pdp__brand" href="/boutique?brand=${encodeURIComponent(product.brand)}">${esc(product.brand)}</a>
      <h1 class="pdp__title">${esc(product.name)}</h1>
      <div class="pdp__ref"><span>Réf. ${esc(product.reference)}</span><span>${esc(product.categoryLabel)}</span><span data-avg></span></div>
    </div>
    <div style="display:grid;gap:8px">
      ${priceHtml(product)}
      ${promo ? `<div><span class="save-tag">-${product.discount}% · Vous économisez ${formatPrice(product.oldPrice - product.price)}</span></div>` : ''}
      <span class="stock ${st.cls}" data-stock-label>${st.label}</span>
    </div>
    <div class="pdp__block">
      <div class="pdp__block-head"><h2 id="size-label">Pointure (EU)</h2><span data-size-stock>${product.inStock ? 'Choisissez votre pointure' : ''}</span></div>
      <div class="size-grid" role="group" aria-labelledby="size-label">
        ${product.sizes.map((s) => `<button type="button" class="size-chip" data-size="${s.size}" aria-pressed="false" ${s.stock > 0 ? '' : 'disabled'} aria-label="Pointure ${s.size}${s.stock > 0 ? '' : ', épuisée'}">${s.size}</button>`).join('')}
      </div>
      <p class="size-error" data-size-error role="alert" hidden>Choisissez une pointure pour continuer.</p>
    </div>
    <div class="pdp__block">
      <div class="buy-row">
        <div class="qty" aria-label="Quantité">
          <button type="button" data-qty="-1" aria-label="Diminuer la quantité">−</button>
          <input type="number" value="1" min="1" max="10" inputmode="numeric" aria-label="Quantité" data-qty-input>
          <button type="button" data-qty="1" aria-label="Augmenter la quantité">+</button>
        </div>
        <button class="btn btn--lg btn--dark" type="button" data-add ${product.inStock ? '' : 'disabled'}>${icon('cart')} Ajouter au panier</button>
        <button class="btn btn--lg buy-now" type="button" data-buy ${product.inStock ? '' : 'disabled'}>Acheter maintenant</button>
      </div>
    </div>
    <ul class="info-list">
      <li>${icon('truck')}<span><b>Livraison à domicile 24–72 h</b>${config.shippingFee} DH · offerte dès ${formatPrice(free)}</span></li>
      <li>${icon('cash')}<span><b>Paiement à la livraison</b>Vous payez en espèces à la réception.</span></li>
      <li>${icon('return')}<span><b>Échange ou retour sous 7 jours</b>Chaussures non portées sur terrain, en boîte d'origine.</span></li>
    </ul>
    <div class="accordion">
      <details open><summary>Description</summary><div class="content"><p style="margin:0">${esc(product.description) || 'Description à venir.'}</p></div></details>
      ${product.features.length ? `<details><summary>Caractéristiques</summary><div class="content"><ul>${product.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></div></details>` : ''}
      <details><summary>Guide des pointures</summary><div class="content"><p style="margin:0">Nos pointures sont en taille européenne (EU). Les crampons se portent près du pied : si vous êtes entre deux tailles, prenez la plus grande. Besoin d'aide ? Écrivez-nous sur <a href="https://wa.me/212611319537" target="_blank" rel="noopener">WhatsApp au 06 11 31 95 37</a>.</p></div></details>
      <details><summary>Livraison et retours</summary><div class="content"><p style="margin:0">Commande confirmée par téléphone puis expédiée sous 24 h. Échange de pointure gratuit sous 7 jours. Voir nos <a href="/conditions-generales">conditions générales</a>.</p></div></details>
    </div>`;

  sticky.innerHTML = `${priceHtml(product)}<button class="btn" type="button" data-sticky-add ${product.inStock ? '' : 'disabled'}>${product.inStock ? 'Ajouter au panier' : 'Épuisé'}</button>`;
}

function selectSize(size) {
  selectedSize = size;
  info.querySelectorAll('.size-grid .size-chip').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.size) === size)));
  info.querySelector('[data-size-error]').hidden = true;
  const entry = product.sizes.find((s) => s.size === size);
  const qtyInput = info.querySelector('[data-qty-input]');
  const max = Math.min(cart.MAX_QTY, entry.stock);
  qtyInput.max = String(max);
  if (Number(qtyInput.value) > max) qtyInput.value = String(max);
  info.querySelector('[data-size-stock]').textContent = entry.stock <= 5 ? `Plus que ${entry.stock} paire${entry.stock > 1 ? 's' : ''} en ${size}` : `Pointure ${size} disponible`;
}

function requireSize() {
  if (selectedSize) return true;
  const err = info.querySelector('[data-size-error]');
  err.hidden = false;
  info.querySelector('.size-grid').scrollIntoView({ behavior: 'smooth', block: 'center' });
  return false;
}

function quantity() {
  const input = info.querySelector('[data-qty-input]');
  const v = Math.max(1, Math.min(Number(input.max) || 10, Math.floor(Number(input.value) || 1)));
  input.value = String(v);
  return v;
}

info.addEventListener('click', (e) => {
  const sizeBtn = e.target.closest('.size-grid .size-chip');
  if (sizeBtn) return selectSize(Number(sizeBtn.dataset.size));
  const q = e.target.closest('[data-qty]');
  if (q) {
    const input = info.querySelector('[data-qty-input]');
    input.value = String(Number(input.value) + Number(q.dataset.qty));
    return quantity();
  }
  if (e.target.closest('[data-add]') && requireSize()) addToCart(product, selectedSize, quantity());
  if (e.target.closest('[data-buy]') && requireSize()) {
    cart.add(product, selectedSize, quantity());
    location.href = '/commande';
  }
});
info.addEventListener('change', (e) => e.target.matches('[data-qty-input]') && quantity());
sticky.addEventListener('click', (e) => {
  if (!e.target.closest('[data-sticky-add]')) return;
  if (requireSize()) addToCart(product, selectedSize, quantity());
});

// Barre d'achat collante sur mobile quand le bouton principal sort de l'écran
function watchSticky() {
  const target = info.querySelector('[data-add]');
  if (!target || !('IntersectionObserver' in window)) return;
  new IntersectionObserver(([en]) => {
    const visible = !en.isIntersecting && en.boundingClientRect.top < 0;
    sticky.classList.toggle('is-visible', visible);
    sticky.setAttribute('aria-hidden', String(!visible));
  }).observe(target);
}

async function loadSimilar() {
  const grid = document.querySelector('[data-similar]');
  grid.innerHTML = skeletonCards(4);
  const store = new Map();
  bindCardGrid(grid, (id) => store.get(id));
  try {
    let { items } = await api(`/products?category=${product.category}&exclude=${product.id}&sort=popular&limit=4`);
    if (items.length < 4) {
      const more = await api(`/products?brand=${encodeURIComponent(product.brand)}&exclude=${product.id}&sort=popular&limit=8`);
      items = [...items, ...more.items.filter((p) => !items.some((x) => x.id === p.id))].slice(0, 4);
    }
    items.forEach((p) => store.set(p.id, p));
    if (!items.length) grid.closest('section').hidden = true;
    else grid.innerHTML = items.map((p) => productCard(p)).join('');
  } catch {
    grid.closest('section').hidden = true;
  }
}

async function loadReviews() {
  const grid = document.querySelector('[data-reviews]');
  try {
    const { items, average, count } = await api(`/reviews?product=${product.id}&limit=6`);
    grid.innerHTML = items.length
      ? items.map((r) => `<blockquote class="review" style="margin:0">${starsHtml(r.rating)}<p>« ${esc(r.comment)} »</p><footer><span><b>${esc(r.name)}</b>${r.city ? ` · ${esc(r.city)}` : ''}</span><span>${new Date(r.createdAt).toLocaleDateString('fr-MA')}</span></footer></blockquote>`).join('')
      : '<p class="muted" style="margin:0">Aucun avis pour le moment. Soyez le premier à donner le vôtre.</p>';
    if (average) {
      const sum = document.querySelector('[data-rating-summary]');
      sum.innerHTML = `<strong>${average.toFixed(1).replace('.', ',')}</strong><div>${starsHtml(average)}<div class="muted" style="font-size:14px">${count} avis</div></div>`;
      sum.hidden = false;
      const avg = info.querySelector('[data-avg]');
      if (avg) avg.innerHTML = `${starsHtml(average)} ${count} avis`;
    }
  } catch {
    grid.innerHTML = '<p class="muted">Les avis sont momentanément indisponibles.</p>';
  }
}

document.querySelector('[data-review-form]').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const msg = form.querySelector('.form-msg');
  const btn = form.querySelector('button[type="submit"]');
  msg.className = 'form-msg';
  setLoading(btn, true);
  try {
    const fd = new FormData(form);
    const res = await api('/reviews', {
      method: 'POST',
      body: { product: product.id, name: fd.get('name'), city: fd.get('city'), rating: Number(fd.get('rating')), comment: fd.get('comment'), website: fd.get('website') },
    });
    msg.textContent = res.message;
    msg.classList.add('ok');
    msg.style.color = 'var(--success)';
    form.reset();
  } catch (err) {
    msg.textContent = err.message;
    msg.style.color = 'var(--red)';
  } finally {
    setLoading(btn, false);
  }
});

(async () => {
  try {
    const [p, config] = await Promise.all([loadProduct(), getConfig()]);
    product = p;
    document.querySelector('[data-crumbs]').insertAdjacentHTML('beforeend', `<li><a href="/boutique?brand=${encodeURIComponent(p.brand)}">${esc(p.brand)}</a></li><li aria-current="page">${esc(p.name)}</li>`);
    renderGallery();
    renderInfo(config);
    const firstAvailable = product.sizes.filter((s) => s.stock > 0);
    if (firstAvailable.length === 1) selectSize(firstAvailable[0].size);
    watchSticky();
    loadSimilar();
    loadReviews();
  } catch {
    info.innerHTML = stateHtml('error', 'Impossible de charger ce produit.', 'Veuillez réessayer.', '<a class="btn btn--dark btn--sm" href="/boutique">Retour à la boutique</a>');
  }
})();
