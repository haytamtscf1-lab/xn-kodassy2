import { formatPrice } from './api.js';
import { esc, icon, imgSrc } from './ui.js';

const root = document.querySelector('[data-confirm]');
let order = null;
try { order = JSON.parse(sessionStorage.getItem('xnk_last_order') || 'null'); } catch { /* ignore */ }
const n = new URLSearchParams(location.search).get('n');

if (order && String(order.orderNumber) === n) {
  root.innerHTML = `
    <div class="confirm__icon">${icon('check', 'icon')}</div>
    <div style="display:grid;gap:10px">
      <span class="eyebrow">Commande enregistrée</span>
      <h1>Merci ${esc(order.customer.name.split(' ')[0])} !</h1>
      <p class="confirm__number">Commande n° ${order.orderNumber}</p>
      <p style="margin:0">Votre commande a bien été reçue. Un récapitulatif vous attend ci-dessous.</p>
    </div>
    <div class="summary">
      <ul class="summary-items">
        ${order.products.map((p) => `<li><img src="${imgSrc(p.image)}" alt="" width="60" height="60"><div><b>${esc(p.name)}</b><span class="muted">Pointure ${p.size} · Qté ${p.quantity}</span></div><strong>${formatPrice(p.price * p.quantity)}</strong></li>`).join('')}
      </ul>
      <dl>
        <div><dt>Sous-total</dt><dd>${formatPrice(order.subtotal)}</dd></div>
        <div><dt>Livraison</dt><dd>${order.shipping === 0 ? 'Offerte' : formatPrice(order.shipping)}</dd></div>
        <div class="total"><dt>À payer à la livraison</dt><dd>${formatPrice(order.total)}</dd></div>
      </dl>
      <p class="muted" style="margin:0;font-size:14px">Livraison à : ${esc(order.customer.city)} · Téléphone : ${esc(order.customer.phone)}</p>
    </div>
    <div style="display:grid;gap:14px">
      <h2 style="font-size:26px;font-style:italic">La suite</h2>
      <ol class="steps">
        <li><span>Un conseiller vous appelle au <b>${esc(order.customer.phone)}</b> pour confirmer la commande.</span></li>
        <li><span>Votre colis est préparé et expédié sous 24 h.</span></li>
        <li><span>Vous êtes livré en 24 à 72 h et vous payez <b>${formatPrice(order.total)}</b> en espèces au livreur.</span></li>
      </ol>
    </div>
    <div style="display:flex;gap:12px;flex-wrap:wrap"><a class="btn btn--lg" href="/boutique">Continuer mes achats</a><a class="btn btn--lg btn--ghost" href="https://wa.me/212611319537?text=${encodeURIComponent(`Bonjour, au sujet de ma commande n° ${order.orderNumber}`)}" target="_blank" rel="noopener">Nous écrire sur WhatsApp</a></div>`;
} else {
  root.innerHTML = `
    <div class="confirm__icon">${icon('check', 'icon')}</div>
    <h1>Merci pour votre commande${n ? ` n° ${esc(n)}` : ''} !</h1>
    <p>Votre commande est enregistrée. Un conseiller va vous appeler pour la confirmer avant l'expédition.</p>
    <a class="btn btn--lg" href="/boutique" style="justify-self:start">Continuer mes achats</a>`;
}
