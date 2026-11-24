export const HOST_CACHE_KEY = 'ish_host_workspace_v1';
export const HOST_TOKEN_KEY = 'ish_host_token_v1';

export function readStoredHostToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(HOST_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function writeStoredHostToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (token) window.localStorage.setItem(HOST_TOKEN_KEY, token);
    else window.localStorage.removeItem(HOST_TOKEN_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function hostAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = readStoredHostToken();
  return {
    ...(token ? { 'x-host-session': token } : {}),
    ...(extra || {}),
  };
}
