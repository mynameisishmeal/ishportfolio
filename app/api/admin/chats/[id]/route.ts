import { NextResponse } from 'next/server';
import { deleteChatThread, markChatRead, sendAdminChatReply } from '@/lib/store';
import { isAdminAuthenticated } from '@/lib/auth';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;
    const body = await request.json();
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    if (!text) {
      return NextResponse.json(
        { success: false, error: 'Reply message is required.' },
        { status: 400 }
      );
    }

    const thread = await sendAdminChatReply(id, text);
    if (!thread) {
      return NextResponse.json({ success: false, error: 'Chat thread not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, thread });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to send reply';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;
    const body = await request.json();
    const thread = await markChatRead(id, Boolean(body?.unreadByAdmin));
    if (!thread) {
      return NextResponse.json({ success: false, error: 'Chat thread not found.' }, { status: 404 });
    }
    return NextResponse.json({ success: true, thread });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update chat status';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;
    const deleted = await deleteChatThread(id);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Chat thread not found.' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete chat';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
