import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';
import { deleteHostingRequest, updateHostingRequestAdmin } from '@/lib/store';
import { HostingStatus, PaymentStatus } from '@/lib/types';

const VALID_STATUSES: HostingStatus[] = [
  'awaiting_payment',
  'awaiting_upload',
  'submitted',
  'in_review',
  'live',
  'rejected',
];

const VALID_PAYMENT_STATUSES: PaymentStatus[] = ['pending', 'paid', 'failed'];

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

    const rawUrl = typeof body?.liveUrl === 'string' ? body.liveUrl.trim() : undefined;
    if (rawUrl && !/^https?:\/\//i.test(rawUrl)) {
      return NextResponse.json(
        { success: false, error: 'Live URL must start with http:// or https://' },
        { status: 400 }
      );
    }

    const rawStatus = typeof body?.hostingStatus === 'string' ? body.hostingStatus : undefined;
    if (rawStatus && !VALID_STATUSES.includes(rawStatus as HostingStatus)) {
      return NextResponse.json(
        { success: false, error: 'Invalid hosting status.' },
        { status: 400 }
      );
    }

    const rawPaymentStatus =
      typeof body?.paymentStatus === 'string' ? body.paymentStatus : undefined;
    if (
      rawPaymentStatus &&
      !VALID_PAYMENT_STATUSES.includes(rawPaymentStatus as PaymentStatus)
    ) {
      return NextResponse.json(
        { success: false, error: 'Invalid payment status.' },
        { status: 400 }
      );
    }

    const updated = await updateHostingRequestAdmin(id, {
      ...(rawStatus && { hostingStatus: rawStatus as HostingStatus }),
      ...(rawPaymentStatus && { paymentStatus: rawPaymentStatus as PaymentStatus }),
      ...(rawUrl !== undefined && { liveUrl: rawUrl }),
      ...(typeof body?.adminNotes === 'string' && { adminNotes: body.adminNotes }),
    });

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Hosting request not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, request: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update hosting request';
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
    const deleted = await deleteHostingRequest(id);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Hosting request not found.' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete hosting request';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
