import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { deleteHostSession } from '@/lib/store';
import { HOST_COOKIE_NAME, verifyHostSessionCookie } from '@/lib/host-auth';
import { verifySameOrigin } from '@/lib/security';

export async function POST(request: Request) {
  const csrfError = verifySameOrigin(request);
  if (csrfError) {
    return NextResponse.json({ success: false, error: csrfError }, { status: 403 });
  }

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(HOST_COOKIE_NAME)?.value;
    const sessionId = await verifyHostSessionCookie(token);
    if (sessionId) {
      await deleteHostSession(sessionId).catch(() => undefined);
    }
  } catch {
    // Always clear cookie cleanly
  }

  const res = NextResponse.json({ success: true });
  res.cookies.delete(HOST_COOKIE_NAME);
  return res;
}
