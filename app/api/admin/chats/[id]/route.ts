import { NextResponse } from 'next/server';
import { deleteChatThread, markChatRead, sendAdminChatReply } from '@/lib/store';
import { isAdminAuthenticated } from '@/lib/auth';
import { safeErrorMessage, verifySameOrigin } from '@/lib/security';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrfError = verifySameOrigin(request);
    if (csrfError) {
      return NextResponse.json({ success: false, error: csrfError }, { status: 403 });
    }
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
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
    return NextResponse.json(
      { success: false, error: safeErrorMessage(err, 'Failed to send reply') },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrfError = verifySameOrigin(request);
    if (csrfError) {
      return NextResponse.json({ success: false, error: csrfError }, { status: 403 });
    }
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const thread = await markChatRead(id, Boolean(body?.unreadByAdmin));
    if (!thread) {
      return NextResponse.json({ success: false, error: 'Chat thread not found.' }, { status: 404 });
    }
    return NextResponse.json({ success: true, thread });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: safeErrorMessage(err, 'Failed to update chat status') },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrfError = verifySameOrigin(request);
    if (csrfError) {
      return NextResponse.json({ success: false, error: csrfError }, { status: 403 });
    }
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
    return NextResponse.json(
      { success: false, error: safeErrorMessage(err, 'Failed to delete chat') },
      { status: 500 }
    );
  }
}
