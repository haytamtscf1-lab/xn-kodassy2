// Panier persistant (localStorage). Les prix stockés servent uniquement à l'affichage instantané :
// le serveur recalcule tout (/api/cart/validate et /api/orders).
const KEY = 'xnk_cart_v1';
const MAX_QTY = 10;

function read() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(data) ? data.filter((i) => i && i.productId && i.size && i.quantity > 0) : [];
  } catch {
    return [];
  }
}

function write(items) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* stockage indisponible (navigation privée) : le panier vit le temps de la page */
  }
  memory = items;
  window.dispatchEvent(new CustomEvent('cart:change', { detail: { items } }));
}

let memory = read();

export const cart = {
  items: () => memory.map((i) => ({ ...i })),
  count: () => memory.reduce((n, i) => n + i.quantity, 0),

  add(product, size, quantity = 1) {
    const items = read();
    const found = items.find((i) => i.productId === product.id && i.size === size);
    if (found) found.quantity = Math.min(MAX_QTY, found.quantity + quantity);
    else {
      items.push({
        productId: product.id,
        slug: product.slug,
        name: product.name,
        brand: product.brand,
        image: product.images?.[0] || null,
        price: product.price,
        size,
        quantity: Math.min(MAX_QTY, quantity),
      });
    }
    write(items);
  },

  setQuantity(productId, size, quantity) {
    const items = read();
    const it = items.find((i) => i.productId === productId && i.size === size);
    if (!it) return;
    it.quantity = Math.max(1, Math.min(MAX_QTY, quantity));
    write(items);
  },

  changeSize(productId, oldSize, newSize) {
    const items = read();
    const it = items.find((i) => i.productId === productId && i.size === oldSize);
    if (!it || oldSize === newSize) return;
    const target = items.find((i) => i.productId === productId && i.size === newSize);
    if (target) {
      target.quantity = Math.min(MAX_QTY, target.quantity + it.quantity);
      items.splice(items.indexOf(it), 1);
    } else it.size = newSize;
    write(items);
  },

  remove(productId, size) {
    write(read().filter((i) => !(i.productId === productId && i.size === size)));
  },

  // Met à jour les infos d'affichage avec les données renvoyées par le serveur.
  sync(lines) {
    const items = read();
    for (const l of lines) {
      const it = items.find((i) => i.productId === l.productId && i.size === l.size);
      if (it) Object.assign(it, { price: l.price, name: l.name, image: l.image, slug: l.slug, brand: l.brand });
    }
    write(items);
  },

  clear: () => write([]),
  payload: () => memory.map(({ productId, size, quantity }) => ({ productId, size, quantity })),
  MAX_QTY,
};

// Synchronise les onglets ouverts.
window.addEventListener('storage', (e) => {
  if (e.key === KEY) {
    memory = read();
    window.dispatchEvent(new CustomEvent('cart:change', { detail: { items: memory } }));
  }
});
