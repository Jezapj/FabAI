/**
 * API base URL for fetch/img src.
 * Production (Render): same-origin /api/* → static site rewrites to fabai-api.
 * Dev: localhost backend or VITE_API_URL from react-app/.env
 *
 * Long ML requests (classify) use API_DIRECT to bypass the static-site proxy
 * timeout that often returns 502 while PyTorch loads.
 */
export const API_BASE = import.meta.env.PROD
  ? ''
  : (import.meta.env.VITE_API_URL?.trim()?.replace(/\/$/, '') || 'http://localhost:5000');

export const API_DIRECT = (
  import.meta.env.VITE_API_DIRECT_URL?.trim() ||
  (import.meta.env.DEV ? API_BASE : '')
).replace(/\/$/, '');

export function apiPath(path: string, opts?: { direct?: boolean }): string {
  const base = opts?.direct && API_DIRECT ? API_DIRECT : API_BASE;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
