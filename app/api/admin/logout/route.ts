import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { ADMIN_COOKIE_NAME, isAdminAuthenticated } from '@/lib/auth';
import { updateSettings } from '@/lib/store';
import { verifySameOrigin } from '@/lib/security';

export async function POST(request: Request) {
  const csrfError = verifySameOrigin(request);
  if (csrfError) {
    return NextResponse.json({ success: false, error: csrfError }, { status: 403 });
  }

  try {
    if (await isAdminAuthenticated()) {
      await updateSettings({ adminSessionSecret: crypto.randomBytes(32).toString('hex') });
    }
  } catch {
    // Always clear cookie even if rotation fails transiently
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete(ADMIN_COOKIE_NAME);
  return response;
}
