import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';
import { deleteHostingRequest, updateHostingRequestAdmin } from '@/lib/store';
import { isSafeHttpUrl } from '@/lib/format';
import { safeErrorMessage, verifySameOrigin } from '@/lib/security';
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
    const csrfError = verifySameOrigin(request);
    if (csrfError) {
      return NextResponse.json({ success: false, error: csrfError }, { status: 403 });
    }

    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

    const rawUrl = typeof body?.liveUrl === 'string' ? body.liveUrl.trim() : undefined;
    if (rawUrl && !isSafeHttpUrl(rawUrl)) {
      return NextResponse.json(
        { success: false, error: 'Live URL must be a valid http:// or https:// URL' },
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
    return NextResponse.json(
      { success: false, error: safeErrorMessage(err, 'Failed to update hosting request') },
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
    const deleted = await deleteHostingRequest(id);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Hosting request not found.' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: safeErrorMessage(err, 'Failed to delete hosting request') },
      { status: 500 }
    );
  }
}
