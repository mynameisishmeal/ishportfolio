import { NextResponse } from 'next/server';
import { createHostSession, findHostUserByKeyHash } from '@/lib/store';
import {
  hashAccessKey,
  HOST_COOKIE_NAME,
  HOST_SESSION_TTL_MS,
  signHostSessionCookie,
} from '@/lib/host-auth';
import { checkPersistentRateLimit, getClientIp, rateLimitHeaders } from '@/lib/rate-limit';
import { safeErrorMessage, verifySameOrigin } from '@/lib/security';

export async function POST(request: Request) {
  try {
    const csrfError = verifySameOrigin(request);
    if (csrfError) {
      return NextResponse.json({ success: false, error: csrfError }, { status: 403 });
    }

    const ip = getClientIp(request);
    const rate = await checkPersistentRateLimit({
      namespace: 'host-key-login',
      key: ip,
      maxRequests: 12,
      windowMs: 15 * 60_000,
    });
    const rlHeaders = rateLimitHeaders(rate);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many login attempts. Please wait ${rate.retryAfterSeconds}s and try again.`,
        },
        { status: 429, headers: rlHeaders }
      );
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const rawKey = typeof body?.accessKey === 'string' ? body.accessKey.trim() : '';

    if (rawKey.length < 10) {
      return NextResponse.json(
        { success: false, error: 'Please enter your unique access key.' },
        { status: 400, headers: rlHeaders }
      );
    }

    const keyHash = hashAccessKey(rawKey);
    const user = await findHostUserByKeyHash(keyHash);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid access key.' },
        { status: 401, headers: rlHeaders }
      );
    }

    const session = await createHostSession(user.id);
    const token = await signHostSessionCookie(session.id);

    const isHttps =
      request.url.startsWith('https://') ||
      request.headers.get('x-forwarded-proto') === 'https';

    const res = NextResponse.json({ success: true, user }, { headers: rlHeaders });
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
      { success: false, error: safeErrorMessage(err, 'Key login failed') },
      { status: 500 }
    );
  }
}
