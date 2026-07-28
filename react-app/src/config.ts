const envUrl = import.meta.env.VITE_API_URL?.trim();

/**
 * API origin without trailing slash.
 * - Local dev: http://localhost:5000 (or VITE_API_URL from .env)
 * - Production on Render: empty string → same-origin /api/* (rewritten to fabai-api in render.yaml)
 */
export const API_BASE = envUrl
  ? envUrl.replace(/\/$/, '')
  : import.meta.env.PROD
    ? ''
    : 'http://localhost:5000';

export function apiPath(path: string): string {
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}
