/**
 * API base URL for fetch/img src.
 * Railway: set VITE_API_URL on the *web* service to your API public URL, then redeploy.
 */
const envUrl = import.meta.env.VITE_API_URL?.trim()?.replace(/\/$/, '');

export const API_BASE = import.meta.env.PROD
  ? (envUrl || '')
  : (envUrl || 'http://localhost:5000');

export function apiPath(path: string): string {
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

const HTML_API_HINT =
  'Set VITE_API_URL on the Railway web service to your API URL (https://your-api.up.railway.app), then redeploy.';

export async function parseApiJson(r: Response): Promise<unknown> {
  const ct = r.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    return r.json();
  }

  const text = await r.text();
  if (/^\s*</.test(text)) {
    throw new Error(`API misconfigured — received HTML instead of JSON from ${r.url}. ${HTML_API_HINT}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid API response from ${r.url} (${r.status}). ${HTML_API_HINT}`);
  }
}

export async function probeApi(signal?: AbortSignal): Promise<boolean> {
  if (import.meta.env.PROD && !API_BASE) {
    return false;
  }

  try {
    const health = await fetch(apiPath('/health'), { signal });
    if (health.ok) {
      const d = await parseApiJson(health) as Record<string, unknown>;
      if (d.ok === true) return true;
    }
  } catch {
    /* try root */
  }

  try {
    const root = await fetch(apiPath('/'), { signal });
    if (!root.ok) return false;
    const d = await parseApiJson(root) as Record<string, unknown>;
    return typeof d.message === 'string';
  } catch {
    return false;
  }
}
