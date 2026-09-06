import type { UserRequest } from "@sloptail/shared";

/**
 * Everything the phone remembers. Server holds the orders; the phone only
 * needs a stable id to find them again, plus a few conveniences.
 */
export interface LocalUser {
  userId: string;
  name: string;
}

const KEY_USER = "sloptail:user";
const KEY_REQUEST = "sloptail:lastRequest";
const KEY_ACTIVE = "sloptail:activeOrder";

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === null || value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode etc. */
  }
}

export function loadUser(): LocalUser {
  const existing = read<LocalUser>(KEY_USER);
  if (existing?.userId) return existing;
  const fresh: LocalUser = { userId: crypto.randomUUID(), name: "" };
  write(KEY_USER, fresh);
  return fresh;
}

export function saveUser(user: LocalUser): void {
  write(KEY_USER, user);
}

export const loadLastRequest = () => read<UserRequest>(KEY_REQUEST);
export const saveLastRequest = (r: UserRequest) => write(KEY_REQUEST, r);

export const loadActiveOrder = () => read<string>(KEY_ACTIVE);
export const saveActiveOrder = (id: string | null) => write(KEY_ACTIVE, id);
