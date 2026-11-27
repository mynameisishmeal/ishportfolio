import crypto from 'crypto';
import { cookies } from 'next/headers';
import { getSettings, getValidHostSession } from './store';
import { PublicHostUser } from './types';

export const HOST_COOKIE_NAME = 'ish_host_session';
export const HOST_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 90; // 90 days

const KEY_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function generateUniqueAccessKey(): string {
  const groups: string[] = [];
  for (let g = 0; g < 4; g++) {
    let chunk = '';
    for (let i = 0; i < 4; i++) {
      chunk += KEY_ALPHABET[crypto.randomInt(KEY_ALPHABET.length)];
    }
    groups.push(chunk);
  }
  return `ISH-${groups.join('-')}`;
}

export function normalizeAccessKey(raw: string): string {
  const alnum = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  // Accept raw key with or without dashes; strip leading ISH prefix if rebuilding canonical form
  if (alnum.startsWith('ISH') && alnum.length === 19) {
    const body = alnum.slice(3);
    return `ISH-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}-${body.slice(12, 16)}`;
  }
  return raw.trim().toUpperCase();
}

export function hashAccessKey(rawKey: string): string {
  const normalized = normalizeAccessKey(rawKey);
  return crypto.createHash('sha256').update(normalized, 'utf-8').digest('hex');
}

export function extractKeyHint(rawKey: string): string {
  const normalized = normalizeAccessKey(rawKey);
  return normalized.slice(-4);
}

function signSessionId(sessionId: string, secret: string): string {
  return crypto
    .createHmac('sha256', `host-sess:${secret}`)
    .update(sessionId)
    .digest('base64url');
}

export async function signHostSessionCookie(sessionId: string): Promise<string> {
  const { sessionSecret } = await getSettings();
  const sig = signSessionId(sessionId, sessionSecret);
  return `${sessionId}.${sig}`;
}

export async function verifyHostSessionCookie(
  token: string | undefined
): Promise<string | null> {
  if (!token || !token.includes('.')) return null;
  const dotIdx = token.lastIndexOf('.');
  const sessionId = token.slice(0, dotIdx);
  const providedSig = token.slice(dotIdx + 1);
  if (!sessionId || !providedSig) return null;

  try {
    const { sessionSecret } = await getSettings();
    const expectedSig = signSessionId(sessionId, sessionSecret);
    const a = Buffer.from(providedSig, 'utf-8');
    const b = Buffer.from(expectedSig, 'utf-8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null;
    }
    return sessionId;
  } catch {
    return null;
  }
}

export async function getAuthenticatedHostSession(_request?: Request): Promise<{
  sessionId: string;
  user: PublicHostUser;
} | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(HOST_COOKIE_NAME)?.value;
  const sessionId = await verifyHostSessionCookie(token);
  if (!sessionId) return null;

  const found = await getValidHostSession(sessionId);
  if (!found) return null;
  return { sessionId: found.session.id, user: found.user };
}

export async function getAuthenticatedHostUser(request?: Request): Promise<PublicHostUser | null> {
  const res = await getAuthenticatedHostSession(request);
  return res?.user ?? null;
}
