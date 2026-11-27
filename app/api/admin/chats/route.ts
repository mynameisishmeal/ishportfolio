import { NextResponse } from 'next/server';
import { getAllChats } from '@/lib/store';
import { isAdminAuthenticated } from '@/lib/auth';
import { safeErrorMessage } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const chats = await getAllChats();
    return NextResponse.json({ success: true, chats });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: safeErrorMessage(err, 'Failed to load chats') },
      { status: 500 }
    );
  }
}
