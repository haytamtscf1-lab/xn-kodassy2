// Client HTTP minimal pour l'API XN-KODASSY.
export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function api(path, { method = 'GET', body, signal } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      signal,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError('Connexion impossible. Vérifiez votre réseau.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'Une erreur est survenue.', res.status, data.details);
  return data;
}

let configPromise;
export const getConfig = () => (configPromise ??= api('/config'));

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
export const formatPrice = (n) => `${nf.format(n).replace(/ | /g, ' ')} DH`;
