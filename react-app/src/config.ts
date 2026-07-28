const rawApiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';

/** Backend origin without trailing slash, e.g. https://fabai-api.onrender.com */
export const API_BASE = rawApiUrl.replace(/\/$/, '');

export function apiPath(path: string): string {
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}
