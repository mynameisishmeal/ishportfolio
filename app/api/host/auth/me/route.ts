import { NextResponse } from 'next/server';
import { getAuthenticatedHostUser } from '@/lib/host-auth';

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedHostUser(request);
    return NextResponse.json({ success: true, user });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load session';
    return NextResponse.json({ success: false, user: null, error: message }, { status: 500 });
  }
}
