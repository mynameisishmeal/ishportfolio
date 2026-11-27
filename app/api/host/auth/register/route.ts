import { NextResponse } from 'next/server';
import { createHostSession, createKeyHostUser } from '@/lib/store';
import {
  extractKeyHint,
  generateUniqueAccessKey,
  hashAccessKey,
  HOST_COOKIE_NAME,
  HOST_SESSION_TTL_MS,
  signHostSessionCookie,
} from '@/lib/host-auth';
import {
  checkPersistentRateLimit,
  detectBotPayload,
  getClientIp,
  rateLimitHeaders,
} from '@/lib/rate-limit';
import { safeErrorMessage, verifySameOrigin } from '@/lib/security';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const csrfError = verifySameOrigin(request);
    if (csrfError) {
      return NextResponse.json({ success: false, error: csrfError }, { status: 403 });
    }

    const ip = getClientIp(request);
    const rate = await checkPersistentRateLimit({
      namespace: 'host-key-create',
      key: ip,
      maxRequests: 8,
      windowMs: 15 * 60_000,
    });
    const rlHeaders = rateLimitHeaders(rate);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many requests. Please wait ${rate.retryAfterSeconds}s before generating another key.`,
        },
        { status: 429, headers: rlHeaders }
      );
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const botError = detectBotPayload(body);
    if (botError) {
      return NextResponse.json({ success: false, error: botError }, { status: 400 });
    }

    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 80) : '';
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!email || !EMAIL_PATTERN.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid email address for receipts and updates.' },
        { status: 400, headers: rlHeaders }
      );
    }

    const accessKey = generateUniqueAccessKey();
    const keyHash = hashAccessKey(accessKey);
    const keyHint = extractKeyHint(accessKey);

    const user = await createKeyHostUser({
      name: name || email.split('@')[0] || 'Client',
      email,
      keyHash,
      keyHint,
    });

    const session = await createHostSession(user.id);
    const token = await signHostSessionCookie(session.id);

    const isHttps =
      request.url.startsWith('https://') ||
      request.headers.get('x-forwarded-proto') === 'https';

    const res = NextResponse.json({ success: true, user, accessKey }, { headers: rlHeaders });
    res.cookies.set(HOST_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: Math.floor(HOST_SESSION_TTL_MS / 1000),
      secure: isHttps,
    });
    return res;
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: safeErrorMessage(err, 'Failed to create access key') },
      { status: 500 }
    );
  }
}
