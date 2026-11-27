import crypto from 'crypto';
import { isSafeHttpUrl } from './format';

const HOST_HEADER_PATTERN = /^[a-z0-9.-]+(:\d{1,5})?$/i;

export function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(pin, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  if (!pin || !stored) return false;

  if (stored.startsWith('scrypt$')) {
    const parts = stored.split('$');
    if (parts.length !== 3) return false;
    const [, salt, hashHex] = parts;
    if (!salt || !hashHex) return false;
    try {
      const expected = Buffer.from(hashHex, 'hex');
      const actual = crypto.scryptSync(pin, salt, expected.length);
      return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
    } catch {
      return false;
    }
  }

  // Constant-time comparison for legacy plaintext ADMIN_PIN values
  const a = crypto.createHash('sha256').update(pin, 'utf-8').digest();
  const b = crypto.createHash('sha256').update(stored, 'utf-8').digest();
  return crypto.timingSafeEqual(a, b);
}

export function verifySameOrigin(request: Request): string | null {
  const fetchSite = request.headers.get('sec-fetch-site')?.trim().toLowerCase();
  if (fetchSite === 'cross-site') {
    return 'Cross-site request blocked.';
  }

  const originHeader = request.headers.get('origin')?.trim();
  const refererHeader = request.headers.get('referer')?.trim();
  const sourceHeader = originHeader || refererHeader;
  if (!sourceHeader) {
    return null;
  }

  try {
    const sourceHost = new URL(sourceHeader).host.toLowerCase();
    const requestUrlHost = new URL(request.url).host.toLowerCase();
    const forwardedHost =
      process.env.VERCEL === '1'
        ? request.headers.get('x-forwarded-host')?.split(',')[0]?.trim().toLowerCase()
        : undefined;
    const directHost = request.headers.get('host')?.split(',')[0]?.trim().toLowerCase();

    const allowedHosts = new Set(
      [requestUrlHost, directHost, forwardedHost].filter(Boolean) as string[]
    );
    if (process.env.NEXT_PUBLIC_APP_URL && isSafeHttpUrl(process.env.NEXT_PUBLIC_APP_URL)) {
      allowedHosts.add(new URL(process.env.NEXT_PUBLIC_APP_URL).host.toLowerCase());
    }

    if (!allowedHosts.has(sourceHost)) {
      return 'Cross-origin request blocked.';
    }
    return null;
  } catch {
    return 'Invalid request origin.';
  }
}

export function resolveSafeOrigin(request: Request): string {
  const configured = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '').trim();
  if (configured && isSafeHttpUrl(configured)) {
    return new URL(configured).origin;
  }

  const url = new URL(request.url);
  const protoHeader = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase();
  const proto =
    protoHeader === 'https' || protoHeader === 'http'
      ? protoHeader
      : url.protocol.replace(':', '');

  const rawHost =
    (process.env.VERCEL === '1'
      ? request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
      : undefined) ||
    request.headers.get('host')?.split(',')[0]?.trim() ||
    url.host;

  const safeHost = HOST_HEADER_PATTERN.test(rawHost) ? rawHost : url.host;
  return `${proto}://${safeHost}`;
}

function signChatPayload(chatId: string, secret: string): string {
  return crypto
    .createHmac('sha256', `visitor-chat:${secret}`)
    .update(chatId)
    .digest('base64url');
}

export function signVisitorChatToken(chatId: string, secret: string): string {
  return `${chatId}.${signChatPayload(chatId, secret)}`;
}

export function verifyVisitorChatToken(
  token: string | undefined,
  secret: string
): string | null {
  if (!token || !token.includes('.') || !secret) return null;
  const dotIdx = token.lastIndexOf('.');
  const chatId = token.slice(0, dotIdx);
  const providedSig = token.slice(dotIdx + 1);
  if (!chatId || !providedSig) return null;

  const expectedSig = signChatPayload(chatId, secret);
  const a = Buffer.from(providedSig, 'utf-8');
  const b = Buffer.from(expectedSig, 'utf-8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }
  return chatId;
}

export function validateImageMagicBytes(buffer: Buffer, ext: string): boolean {
  if (buffer.length < 12) return false;
  switch (ext.toLowerCase()) {
    case '.png':
      return (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a
      );
    case '.jpg':
    case '.jpeg':
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case '.gif':
      return (
        buffer[0] === 0x47 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x38 &&
        (buffer[4] === 0x37 || buffer[4] === 0x39) &&
        buffer[5] === 0x61
      );
    case '.webp':
      return (
        buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
        buffer.subarray(8, 12).toString('ascii') === 'WEBP'
      );
    default:
      return false;
  }
}

export function safeErrorMessage(err: unknown, fallback: string): string {
  console.error(`[API Error] ${fallback}:`, err);
  if (err instanceof Error) {
    const msg = err.message;
    if (
      msg.includes('MONGODB_URI') ||
      msg.includes('MongoDB Atlas dropped the TLS handshake') ||
      msg.includes('MongoDB temporarily unreachable')
    ) {
      return msg;
    }
  }
  return fallback;
}
