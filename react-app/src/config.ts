/**
 * API base URL for fetch/img src.
 * - Local dev: VITE_API_URL or http://localhost:5000
 * - Railway / production: set VITE_API_URL to your API public URL at build time
 */
const envUrl = import.meta.env.VITE_API_URL?.trim()?.replace(/\/$/, '');

export const API_BASE = import.meta.env.PROD
  ? (envUrl || '')
  : (envUrl || 'http://localhost:5000');

export function apiPath(path: string): string {
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}
