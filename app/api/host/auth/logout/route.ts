import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { deleteHostSession } from '@/lib/store';
import { HOST_COOKIE_NAME, verifyHostSessionCookie } from '@/lib/host-auth';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token =
      cookieStore.get(HOST_COOKIE_NAME)?.value ||
      request.headers.get('x-host-session')?.trim() ||
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
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
