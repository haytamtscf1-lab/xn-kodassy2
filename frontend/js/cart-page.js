import { api, formatPrice, getConfig } from './api.js';
import { cart } from './cart.js';
import { esc, icon, imgSrc, stateHtml } from './ui.js';

const linesEl = document.querySelector('[data-cart-lines]');
const summaryEl = document.querySelector('[data-cart-summary]');
let config;
let busy = false;

function emptyState() {
  summaryEl.hidden = true;
  linesEl.innerHTML = stateHtml('empty', 'Votre panier est vide.', 'Parcourez la boutique et trouvez la paire qui vous fait gagner.', '<a class="btn" href="/boutique">Découvrir les chaussures</a>');
}

function freeShippingHtml(subtotal) {
  const t = config.freeShippingThreshold;
  if (!t) return '';
  const left = Math.max(0, t - subtotal);
  const pct = Math.min(100, (subtotal / t) * 100);
  return `<div class="free-ship"><span>${left > 0 ? `Plus que <b>${formatPrice(left)}</b> pour la livraison gratuite` : '<b>Livraison offerte</b> sur votre commande'}</span><div class="free-ship__bar"><i style="width:${pct}%"></i></div></div>`;
}

function render(result) {
  const { lines, issues, subtotal, shipping, total } = result;
  if (!lines.length && !issues.length) return emptyState();
  const issueFor = (l) => issues.find((i) => i.productId === l.productId && i.size === l.size);
  const gone = issues.filter((i) => i.code === 'unavailable');

  linesEl.innerHTML = `
    ${issues.length ? `<div class="alert alert--warn" role="alert" style="margin-bottom:16px">${icon('alert')}<div>Certains articles ont changé depuis votre visite. Ajustez votre panier avant de commander.</div></div>` : ''}
    <table class="cart-table">
      <caption class="sr-only">Articles du panier</caption>
      <thead><tr><th colspan="2">Produit</th><th>Taille</th><th>Quantité</th><th>Prix</th><th>Total</th><th><span class="sr-only">Retirer</span></th></tr></thead>
      <tbody>
      ${lines.map((l) => {
        const issue = issueFor(l);
        const url = `/produit/${encodeURIComponent(l.slug)}`;
        return `<tr class="cart-row${issue ? ' has-issue' : ''}" data-id="${esc(l.productId)}" data-size="${l.size}">
          <td class="c-img"><a href="${url}" tabindex="-1"><img src="${imgSrc(l.image)}" alt="" loading="lazy" width="112" height="112"></a></td>
          <td class="c-name"><a href="${url}">${esc(l.name)}</a><small>${esc(l.brand)} · Réf. ${esc(l.reference)}</small>${issue ? `<span class="line-issue">${esc(issue.message)}</span>` : ''}</td>
          <td><span class="c-label">Taille</span>
            <label class="sr-only" for="size-${esc(l.productId)}-${l.size}">Pointure</label>
            <select class="select size-select" id="size-${esc(l.productId)}-${l.size}" data-change-size>
              ${l.sizes.map((s) => `<option value="${s.size}" ${s.size === l.size ? 'selected' : ''} ${s.stock > 0 || s.size === l.size ? '' : 'disabled'}>${s.size}</option>`).join('')}
            </select></td>
          <td><span class="c-label">Quantité</span>
            <div class="qty qty--sm">
              <button type="button" data-step="-1" aria-label="Diminuer" ${l.quantity <= 1 ? 'disabled' : ''}>−</button>
              <input type="number" value="${l.quantity}" min="1" max="${Math.min(10, Math.max(1, l.available))}" inputmode="numeric" aria-label="Quantité" data-qty>
              <button type="button" data-step="1" aria-label="Augmenter" ${l.quantity >= Math.min(10, l.available) ? 'disabled' : ''}>+</button>
            </div></td>
          <td><span class="c-label">Prix</span>${formatPrice(l.price)}${l.oldPrice ? ` <s class="muted" style="font-size:13px">${formatPrice(l.oldPrice)}</s>` : ''}</td>
          <td class="c-total"><span class="c-label">Total</span>${formatPrice(l.lineTotal)}</td>
          <td class="c-remove"><button class="remove-btn" type="button" data-remove aria-label="Retirer ${esc(l.name)} pointure ${l.size}">${icon('trash')}</button></td>
        </tr>`;
      }).join('')}
      </tbody>
    </table>
    ${gone.length ? `<p class="line-issue" style="margin-top:12px">${gone.length} article(s) retiré(s) car plus disponible(s).</p>` : ''}
    <a class="link-arrow" href="/boutique" style="margin-top:24px">${icon('left')} Continuer mes achats</a>`;

  summaryEl.hidden = false;
  summaryEl.innerHTML = `
    <h2 id="sum-title">Récapitulatif</h2>
    ${freeShippingHtml(subtotal)}
    <dl>
      <div><dt>Sous-total</dt><dd>${formatPrice(subtotal)}</dd></div>
      <div><dt>Livraison à domicile</dt><dd>${shipping === 0 ? 'Offerte' : formatPrice(shipping)}</dd></div>
      <div class="total"><dt>Total</dt><dd>${formatPrice(total)}</dd></div>
    </dl>
    <a class="btn btn--lg btn--block" href="/commande" ${issues.length ? 'aria-disabled="true" tabindex="-1"' : ''}>Passer la commande</a>
    <p class="pay-note">${icon('cash')} Paiement en espèces à la livraison</p>`;
}

async function refresh() {
  if (!cart.count()) return emptyState();
  busy = true;
  try {
    config ??= await getConfig();
    const result = await api('/cart/validate', { method: 'POST', body: { items: cart.payload() } });
    // Retire les produits supprimés de la boutique
    result.issues.filter((i) => i.code === 'unavailable').forEach((i) => cart.remove(i.productId, i.size));
    cart.sync(result.lines);
    render(result);
  } catch (err) {
    linesEl.innerHTML = stateHtml('error', 'Impossible de charger votre panier.', err.message, '<button class="btn btn--dark btn--sm" type="button" data-retry>Réessayer</button>');
    summaryEl.hidden = true;
  } finally {
    busy = false;
  }
}

linesEl.addEventListener('click', (e) => {
  const row = e.target.closest('.cart-row');
  if (e.target.closest('[data-retry]')) return refresh();
  if (!row || busy) return;
  const { id } = row.dataset;
  const size = Number(row.dataset.size);
  if (e.target.closest('[data-remove]')) {
    row.style.transition = 'opacity .25s';
    row.style.opacity = '0';
    setTimeout(() => { cart.remove(id, size); refresh(); }, 220);
  }
  const step = e.target.closest('[data-step]');
  if (step) {
    const input = row.querySelector('[data-qty]');
    cart.setQuantity(id, size, Math.min(Number(input.max), Number(input.value) + Number(step.dataset.step)));
    refresh();
  }
});
linesEl.addEventListener('change', (e) => {
  const row = e.target.closest('.cart-row');
  if (!row) return;
  const { id } = row.dataset;
  const size = Number(row.dataset.size);
  if (e.target.matches('[data-qty]')) {
    cart.setQuantity(id, size, Math.min(Number(e.target.max), Math.max(1, Math.floor(Number(e.target.value) || 1))));
    refresh();
  }
  if (e.target.matches('[data-change-size]')) {
    cart.changeSize(id, size, Number(e.target.value));
    refresh();
  }
});

refresh();
