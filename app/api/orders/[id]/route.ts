import { NextResponse } from 'next/server';
import { deleteOrder, updateOrderStatus } from '@/lib/store';
import { isAdminAuthenticated } from '@/lib/auth';
import { OrderStatus, PaymentStatus } from '@/lib/types';

const VALID_STATUSES: OrderStatus[] = ['pending', 'completed', 'cancelled'];
const VALID_PAYMENT_STATUSES: PaymentStatus[] = ['unpaid', 'pending', 'paid', 'failed'];

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

    const rawStatus = typeof body?.status === 'string' ? body.status : undefined;
    const rawPaymentStatus =
      typeof body?.paymentStatus === 'string' ? body.paymentStatus : undefined;

    if (!rawStatus && !rawPaymentStatus) {
      return NextResponse.json({ success: false, error: 'No updates supplied' }, { status: 400 });
    }
    if (rawStatus && !VALID_STATUSES.includes(rawStatus as OrderStatus)) {
      return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });
    }
    if (
      rawPaymentStatus &&
      !VALID_PAYMENT_STATUSES.includes(rawPaymentStatus as PaymentStatus)
    ) {
      return NextResponse.json(
        { success: false, error: 'Invalid payment status' },
        { status: 400 }
      );
    }

    const updated = await updateOrderStatus(
      id,
      rawStatus as OrderStatus | undefined,
      rawPaymentStatus as PaymentStatus | undefined
    );
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, order: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update order';
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
    const deleted = await deleteOrder(id);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete order';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
