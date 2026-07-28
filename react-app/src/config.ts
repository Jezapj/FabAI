/**
 * API base URL for fetch/img src.
 * Production (Render): always same-origin /api/* → static site rewrites to fabai-api.
 * Dev: localhost backend or VITE_API_URL from react-app/.env
 */
export const API_BASE = import.meta.env.PROD
  ? ''
  : (import.meta.env.VITE_API_URL?.trim()?.replace(/\/$/, '') || 'http://localhost:5000');

export function apiPath(path: string): string {
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}
