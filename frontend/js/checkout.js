import { api, formatPrice } from './api.js';
import { cart } from './cart.js';
import { esc, icon, imgSrc, stateHtml, setLoading } from './ui.js';

const root = document.querySelector('[data-checkout-root]');
const form = document.querySelector('[data-checkout-form]');
const summaryEl = document.querySelector('[data-checkout-summary]');
const errorBox = document.querySelector('[data-form-error]');
const submitBtn = document.querySelector('[data-submit]');
const DRAFT_KEY = 'xnk_checkout_draft';
let lastCart;

function renderSummary({ lines, subtotal, shipping, total }) {
  summaryEl.innerHTML = `
    <h2 id="sum-title">Votre commande</h2>
    <ul class="summary-items">
      ${lines.map((l) => `<li><img src="${imgSrc(l.image)}" alt="" width="60" height="60"><div><b>${esc(l.name)}</b><span class="muted">Pointure ${l.size} · Qté ${l.quantity}</span></div><strong>${formatPrice(l.lineTotal)}</strong></li>`).join('')}
    </ul>
    <dl>
      <div><dt>Sous-total</dt><dd>${formatPrice(subtotal)}</dd></div>
      <div><dt>Livraison</dt><dd>${shipping === 0 ? 'Offerte' : formatPrice(shipping)}</dd></div>
      <div class="total"><dt>Total</dt><dd>${formatPrice(total)}</dd></div>
    </dl>
    <p class="pay-note">${icon('cash')} À payer en espèces à la livraison</p>
    <a class="link-arrow" href="/panier">${icon('left')} Modifier le panier</a>`;
  document.querySelector('[data-ship-label]').textContent = shipping === 0 ? 'Offerte' : formatPrice(shipping);
}

async function loadCart() {
  if (!cart.count()) {
    root.innerHTML = stateHtml('empty', 'Votre panier est vide.', 'Ajoutez des chaussures avant de finaliser une commande.', '<a class="btn" href="/boutique">Découvrir les chaussures</a>');
    return;
  }
  try {
    const result = await api('/cart/validate', { method: 'POST', body: { items: cart.payload() } });
    lastCart = result;
    renderSummary(result);
    if (result.issues.length) {
      showError(`${result.issues.map((i) => i.message).join(' ')} Modifiez votre panier pour continuer.`, true);
      submitBtn.disabled = true;
    }
  } catch (err) {
    summaryEl.innerHTML = stateHtml('error', 'Impossible de charger votre panier.', err.message);
    submitBtn.disabled = true;
  }
}

function showError(message, withCartLink = false) {
  errorBox.innerHTML = `${icon('alert')}<div>${esc(message)}${withCartLink ? ' <a href="/panier">Ouvrir le panier</a>' : ''}</div>`;
  errorBox.hidden = false;
  errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function setFieldError(name, message) {
  const input = form.elements[name];
  const p = form.querySelector(`[data-error-for="${name}"]`);
  if (input) input.setAttribute('aria-invalid', message ? 'true' : 'false');
  if (p) {
    p.textContent = message || '';
    if (input && message) { p.id ||= `err-${name}`; input.setAttribute('aria-describedby', p.id); }
  }
}

// Validation côté navigateur : confort uniquement, le serveur revalide tout.
const RULES = {
  name: (v) => (v.trim().length >= 3 ? '' : 'Indiquez votre nom complet.'),
  phone: (v) => (/^(\+212|00212|0)[5-7]\d{8}$/.test(v.replace(/[\s.-]/g, '')) || /^\+?\d{8,15}$/.test(v.replace(/[\s.-]/g, '')) ? '' : 'Numéro invalide (ex. 06 12 34 56 78).'),
  email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : 'Adresse email invalide.'),
  city: (v) => (v.trim().length >= 2 ? '' : 'Indiquez votre ville.'),
  address: (v) => (v.trim().length >= 5 ? '' : 'Indiquez votre adresse complète.'),
};
function validateForm() {
  let firstInvalid = null;
  for (const [name, rule] of Object.entries(RULES)) {
    const msg = rule(form.elements[name].value);
    setFieldError(name, msg);
    if (msg && !firstInvalid) firstInvalid = form.elements[name];
  }
  firstInvalid?.focus();
  return !firstInvalid;
}
form.addEventListener('blur', (e) => {
  const rule = RULES[e.target.name];
  if (rule && e.target.value) setFieldError(e.target.name, rule(e.target.value));
}, true);

// Brouillon du formulaire (évite de tout retaper si le client revient au panier)
try {
  const draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || '{}');
  for (const [k, v] of Object.entries(draft)) if (form.elements[k] && typeof v === 'string') form.elements[k].value = v;
} catch { /* ignore */ }
form.addEventListener('input', () => {
  const fd = Object.fromEntries(['name', 'phone', 'email', 'city', 'address', 'postalCode', 'comment'].map((k) => [k, form.elements[k].value]));
  try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(fd)); } catch { /* ignore */ }
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorBox.hidden = true;
  if (!validateForm()) return;
  setLoading(submitBtn, true);
  const fd = new FormData(form);
  try {
    const order = await api('/orders', {
      method: 'POST',
      body: {
        customer: {
          name: fd.get('name'), phone: fd.get('phone'), email: fd.get('email'), city: fd.get('city'),
          address: fd.get('address'), postalCode: fd.get('postalCode') || '', comment: fd.get('comment') || '',
        },
        items: cart.payload(),
        website: fd.get('website') || undefined,
      },
    });
    try {
      sessionStorage.setItem('xnk_last_order', JSON.stringify(order));
      sessionStorage.removeItem(DRAFT_KEY);
    } catch { /* ignore */ }
    cart.clear();
    location.href = `/commande/confirmation?n=${order.orderNumber}`;
  } catch (err) {
    setLoading(submitBtn, false);
    if (err.details?.length && err.status === 400) {
      err.details.forEach((d) => setFieldError(d.field.replace('customer.', ''), d.message));
      showError(err.message);
    } else if (err.status === 409) {
      showError(err.message, true);
      loadCart();
    } else {
      showError(err.message || 'La commande n’a pas pu être envoyée. Veuillez réessayer.');
    }
  }
});

loadCart();
