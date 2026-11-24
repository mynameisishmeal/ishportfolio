import { NextResponse } from 'next/server';
import { getProfile, getSettings, updateSettings } from '@/lib/store';
import { isAdminAuthenticated } from '@/lib/auth';

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
    const message = err instanceof Error ? err.message : 'Failed to fetch settings';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const currentPin = typeof body?.currentPin === 'string' ? body.currentPin : '';
    const newPin = typeof body?.newPin === 'string' ? body.newPin.trim() : '';

    if (!newPin || newPin.length < 4) {
      return NextResponse.json(
        { success: false, error: 'New PIN must be at least 4 characters.' },
        { status: 400 }
      );
    }

    const settings = await getSettings();
    if (!currentPin || !settings.masterPin || currentPin !== settings.masterPin) {
      return NextResponse.json(
        { success: false, error: 'Current PIN is incorrect.' },
        { status: 401 }
      );
    }

    await updateSettings({ masterPin: newPin });
    return NextResponse.json({ success: true, message: 'Admin PIN updated.' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update settings';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
