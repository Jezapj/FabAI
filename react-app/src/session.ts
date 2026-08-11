/**
 * Session persistence.
 *
 * The signed-in user used to live only in React state, so closing the tab (or
 * even a refresh) logged you straight back out. The API identifies a user by
 * their `sub`, so the decoded profile is cached in localStorage and restored on
 * boot until the session TTL expires.
 */

const SESSION_KEY = 'fabai-session';
const GUEST_ID_KEY = 'fabai-guest-id';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface SessionUser {
  sub: string;
  name: string;
  email?: string;
  picture?: string;
  guest?: boolean;
  [key: string]: unknown;
}

interface StoredSession {
  user: SessionUser;
  savedAt: number;
}

export function loadSession(): SessionUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    const stored = JSON.parse(raw) as Partial<StoredSession>;
    const user = stored.user;
    const savedAt = Number(stored.savedAt);

    if (!user?.sub || !Number.isFinite(savedAt)) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    if (Date.now() - savedAt > SESSION_TTL_MS) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

export function saveSession(user: SessionUser): void {
  try {
    const payload: StoredSession = { user, savedAt: Date.now() };
    localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  } catch {
    /* storage unavailable (private mode / quota) — session stays in memory */
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Guest identity, reused across visits so a guest wardrobe survives a sign-out.
 * `email` is synthesised because the backend has a unique constraint on it.
 */
export function createGuestUser(): SessionUser {
  let guestId: string | null = null;
  try {
    guestId = localStorage.getItem(GUEST_ID_KEY);
  } catch {
    /* ignore */
  }

  if (!guestId) {
    guestId = `guest-${randomId()}`;
    try {
      localStorage.setItem(GUEST_ID_KEY, guestId);
    } catch {
      /* ignore */
    }
  }

  return {
    sub: guestId,
    name: 'Guest',
    email: `${guestId}@guest.local`,
    provider: 'guest',
    guest: true,
  };
}
