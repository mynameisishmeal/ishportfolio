export const HOST_CACHE_KEY = 'ish_host_workspace_v1';
const LEGACY_HOST_TOKEN_KEY = 'ish_host_token_v1';

export function clearLegacyHostToken(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(LEGACY_HOST_TOKEN_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function writeStoredHostToken(_token: string | null): void {
  // Sessions are maintained strictly via httpOnly cookies; always purge legacy localStorage tokens.
  clearLegacyHostToken();
}

export function hostAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    ...(extra || {}),
  };
}
