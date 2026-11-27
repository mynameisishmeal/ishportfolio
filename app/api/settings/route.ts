import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { getProfile, getSettings, updateSettings } from '@/lib/store';
import {
  ADMIN_COOKIE_NAME,
  createAdminSessionToken,
  isAdminAuthenticated,
} from '@/lib/auth';
import { hashPin, safeErrorMessage, verifyPin, verifySameOrigin } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const profile = await getProfile();
    return NextResponse.json({
      success: true,
      settings: {
        currencyCode: profile.currencyCode,
        currencySymbol: profile.currencySymbol,
        announcement: profile.announcement || '',
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: safeErrorMessage(err, 'Failed to fetch settings') },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const csrfError = verifySameOrigin(request);
    if (csrfError) {
      return NextResponse.json({ success: false, error: csrfError }, { status: 403 });
    }

    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const currentPin = typeof body?.currentPin === 'string' ? body.currentPin : '';
    const newPin = typeof body?.newPin === 'string' ? body.newPin.trim() : '';

    if (!newPin || newPin.length < 6) {
      return NextResponse.json(
        { success: false, error: 'New PIN must be at least 6 characters.' },
        { status: 400 }
      );
    }

    const settings = await getSettings();
    if (!currentPin || !settings.masterPin || !verifyPin(currentPin, settings.masterPin)) {
      return NextResponse.json(
        { success: false, error: 'Current PIN is incorrect.' },
        { status: 401 }
      );
    }

    await updateSettings({
      masterPin: hashPin(newPin),
      adminSessionSecret: crypto.randomBytes(32).toString('hex'),
    });

    const isHttps =
      request.url.startsWith('https://') ||
      request.headers.get('x-forwarded-proto') === 'https';

    const freshToken = await createAdminSessionToken();
    const response = NextResponse.json({ success: true, message: 'Admin PIN updated.' });
    response.cookies.set(ADMIN_COOKIE_NAME, freshToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      secure: isHttps,
    });
    return response;
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: safeErrorMessage(err, 'Failed to update settings') },
      { status: 500 }
    );
  }
}
