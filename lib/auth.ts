import crypto from 'crypto';
import { cookies } from 'next/headers';
import { getSettings } from './store';

export const ADMIN_COOKIE_NAME = 'ish_admin_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function signPayload(payloadB64: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
}

export async function createAdminSessionToken(): Promise<string> {
  const { sessionSecret } = await getSettings();
  const payload = JSON.stringify({
    role: 'admin',
    exp: Date.now() + SESSION_TTL_MS,
  });
  const payloadB64 = Buffer.from(payload, 'utf-8').toString('base64url');
  const sig = signPayload(payloadB64, sessionSecret);
  return `${payloadB64}.${sig}`;
}

export async function verifyAdminSessionToken(token: string | undefined): Promise<boolean> {
  if (!token || !token.includes('.')) return false;
  const [payloadB64, providedSig] = token.split('.');
  if (!payloadB64 || !providedSig) return false;

  try {
    const { sessionSecret } = await getSettings();
    const expectedSig = signPayload(payloadB64, sessionSecret);
    const a = Buffer.from(providedSig, 'utf-8');
    const b = Buffer.from(expectedSig, 'utf-8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return false;
    }

    const decoded = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8')) as {
      role?: string;
      exp?: number;
    };
    if (decoded.role !== 'admin' || !decoded.exp || decoded.exp < Date.now()) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  return verifyAdminSessionToken(token);
}
