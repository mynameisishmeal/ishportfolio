import { NextResponse } from 'next/server';
import { deleteMessage, updateMessage } from '@/lib/store';
import { isAdminAuthenticated } from '@/lib/auth';

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
    const updated = await updateMessage(id, Boolean(body?.read));
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Message not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update message';
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
    const deleted = await deleteMessage(id);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Message not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete message';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
