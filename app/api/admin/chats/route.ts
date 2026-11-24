import { NextResponse } from 'next/server';
import { getAllChats } from '@/lib/store';
import { isAdminAuthenticated } from '@/lib/auth';

export async function GET() {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const chats = await getAllChats();
    return NextResponse.json({ success: true, chats });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load chats';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
