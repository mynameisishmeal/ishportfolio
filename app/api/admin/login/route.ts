import { NextResponse } from 'next/server';
import { getSettings } from '@/lib/store';
import { ADMIN_COOKIE_NAME, createAdminSessionToken } from '@/lib/auth';
import { checkPersistentRateLimit, getClientIp, rateLimitHeaders } from '@/lib/rate-limit';
import { safeErrorMessage, verifyPin, verifySameOrigin } from '@/lib/security';

export async function POST(request: Request) {
  try {
    const csrfError = verifySameOrigin(request);
    if (csrfError) {
      return NextResponse.json({ success: false, error: csrfError }, { status: 403 });
    }

    const ip = getClientIp(request);
    const rate = await checkPersistentRateLimit({
      namespace: 'admin-login',
      key: ip,
      maxRequests: 8,
      windowMs: 15 * 60_000,
    });
    const rlHeaders = rateLimitHeaders(rate);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many login attempts. Please wait ${rate.retryAfterSeconds}s before trying again.`,
        },
        { status: 429, headers: rlHeaders }
      );
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const pin = typeof body?.pin === 'string' ? body.pin : '';
    const settings = await getSettings();

    if (!settings.masterPin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Admin PIN is not configured. Set ADMIN_PIN in environment variables.',
        },
        { status: 503 }
      );
    }

    if (!pin || !verifyPin(pin, settings.masterPin)) {
      return NextResponse.json(
        { success: false, error: 'Incorrect PIN.' },
        { status: 401, headers: rlHeaders }
      );
    }

    const isHttps =
      request.url.startsWith('https://') ||
      request.headers.get('x-forwarded-proto') === 'https';

    const token = await createAdminSessionToken();
    const response = NextResponse.json({ success: true }, { headers: rlHeaders });
    response.cookies.set(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      secure: isHttps,
    });
    return response;
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: safeErrorMessage(err, 'Login failed') },
      { status: 500 }
    );
  }
}
