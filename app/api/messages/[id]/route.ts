import { NextResponse } from 'next/server';
import { deleteMessage, updateMessage } from '@/lib/store';
import { isAdminAuthenticated } from '@/lib/auth';
import { safeErrorMessage, verifySameOrigin } from '@/lib/security';

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
    const updated = await updateMessage(id, Boolean(body?.read));
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Message not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: updated });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: safeErrorMessage(err, 'Failed to update message') },
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
    const deleted = await deleteMessage(id);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Message not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: safeErrorMessage(err, 'Failed to delete message') },
      { status: 500 }
    );
  }
}
