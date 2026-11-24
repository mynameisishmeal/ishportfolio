import { NextResponse } from 'next/server';
import { getSettings } from '@/lib/store';
import { ADMIN_COOKIE_NAME, createAdminSessionToken } from '@/lib/auth';
import { checkRateLimit, getClientIp, rateLimitHeaders } from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const rate = checkRateLimit({
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

    const body = await request.json();
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

    if (!pin || pin !== settings.masterPin) {
      return NextResponse.json(
        { success: false, error: 'Incorrect PIN.' },
        { status: 401 }
      );
    }

    const isHttps =
      request.url.startsWith('https://') ||
      request.headers.get('x-forwarded-proto') === 'https';

    const token = await createAdminSessionToken();
    const response = NextResponse.json({ success: true });
    response.cookies.set(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      secure: isHttps,
    });
    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Login failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
