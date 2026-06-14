// Token storage in localStorage. All helpers are safe to call server-side
// (they return null / no-op when window is unavailable).

const KEY = "paisa_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(KEY);
}
