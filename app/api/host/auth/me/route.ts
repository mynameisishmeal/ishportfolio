import { NextResponse } from 'next/server';
import { getAuthenticatedHostUser } from '@/lib/host-auth';
import { safeErrorMessage } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedHostUser(request);
    return NextResponse.json({ success: true, user });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, user: null, error: safeErrorMessage(err, 'Failed to load session') },
      { status: 500 }
    );
  }
}
