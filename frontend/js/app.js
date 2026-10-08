// Comportements communs à toutes les pages : header, menu mobile, compteur panier, newsletter, animations.
import { api } from './api.js';
import { cart } from './cart.js';
import { setLoading } from './ui.js';

// ---- compteur du panier ----
function renderCount(bump = false) {
  const n = cart.count();
  document.querySelectorAll('[data-cart-count]').forEach((el) => {
    el.textContent = n > 99 ? '99+' : String(n);
    el.hidden = n === 0;
    el.closest('a')?.setAttribute('aria-label', `Panier, ${n} article${n > 1 ? 's' : ''}`);
    if (bump) {
      el.classList.remove('bump');
      void el.offsetWidth;
      el.classList.add('bump');
    }
  });
}
renderCount();
window.addEventListener('cart:change', () => renderCount(true));

// ---- lien actif ----
const params = new URLSearchParams(location.search);
const navKey = location.pathname === '/boutique' && params.get('promo') ? 'promo'
  : location.pathname === '/boutique' && params.get('sort') === 'newest' ? 'newest'
  : location.pathname;
document.querySelectorAll(`[data-nav="${CSS.escape(navKey)}"]`).forEach((a) => a.setAttribute('aria-current', 'page'));
document.querySelectorAll('input[name="q"]').forEach((i) => { if (params.get('q')) i.value = params.get('q'); });

// ---- menu mobile ----
const drawer = document.getElementById('mobile-nav');
const backdrop = document.querySelector('[data-drawer-backdrop]');
const opener = document.querySelector('[data-menu-open]');
function setMenu(open) {
  drawer.classList.toggle('is-open', open);
  backdrop.classList.toggle('is-open', open);
  drawer.setAttribute('aria-hidden', String(!open));
  drawer.inert = !open;
  opener.setAttribute('aria-expanded', String(open));
  document.body.classList.toggle('no-scroll', open);
  if (open) drawer.querySelector('nav a')?.focus();
  else opener.focus({ preventScroll: true });
}
opener?.addEventListener('click', () => setMenu(true));
drawer?.querySelector('[data-menu-close]')?.addEventListener('click', () => setMenu(false));
backdrop?.addEventListener('click', () => {
  if (drawer.classList.contains('is-open')) setMenu(false);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && drawer?.classList.contains('is-open')) setMenu(false);
});

// ---- newsletter ----
document.querySelectorAll('[data-newsletter]').forEach((form) => {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = form.querySelector('.form-msg');
    const btn = form.querySelector('button[type="submit"]');
    msg.className = 'form-msg';
    setLoading(btn, true);
    try {
      const res = await api('/newsletter', { method: 'POST', body: { email: form.email.value } });
      msg.textContent = res.message;
      msg.classList.add('ok');
      form.reset();
    } catch (err) {
      msg.textContent = err.message;
      msg.classList.add('err');
    } finally {
      setLoading(btn, false);
    }
  });
});

// ---- apparition progressive ----
if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.documentElement.classList.add('js-reveal');
  const io = new IntersectionObserver(
    (entries) => entries.forEach((en) => {
      if (en.isIntersecting) {
        en.target.classList.add('is-visible');
        io.unobserve(en.target);
      }
    }),
    { rootMargin: '0px 0px -8% 0px' }
  );
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
}
