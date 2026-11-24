import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';
import {
  getAllHostingRequests,
  getHostingConfig,
  updateHostingConfig,
} from '@/lib/store';

export async function GET() {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const [requests, config] = await Promise.all([
      getAllHostingRequests(),
      getHostingConfig(),
    ]);
    return NextResponse.json({ success: true, requests, config });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load hosting requests';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json();
    const price = Number(body?.price);
    const redirectFeeRaw = body?.redirectFee;
    const redirectFee =
      redirectFeeRaw === undefined ? undefined : Number(redirectFeeRaw);
    const currencyCode =
      typeof body?.currencyCode === 'string' && body.currencyCode.trim()
        ? body.currencyCode.trim().toUpperCase()
        : undefined;
    const currencySymbol =
      typeof body?.currencySymbol === 'string' && body.currencySymbol.trim()
        ? body.currencySymbol.trim()
        : undefined;
    const badge =
      typeof body?.badge === 'string' ? body.badge.trim().slice(0, 80) : undefined;
    const title =
      typeof body?.title === 'string' ? body.title.trim().slice(0, 140) : undefined;
    const subtitle =
      typeof body?.subtitle === 'string' ? body.subtitle.trim().slice(0, 500) : undefined;
    const supportedStacksNotice =
      typeof body?.supportedStacksNotice === 'string'
        ? body.supportedStacksNotice.trim().slice(0, 300)
        : undefined;

    if (!Number.isFinite(price) || price < 100) {
      return NextResponse.json(
        { success: false, error: 'Hosting price must be at least 100.' },
        { status: 400 }
      );
    }

    if (redirectFee !== undefined && (!Number.isFinite(redirectFee) || redirectFee < 0)) {
      return NextResponse.json(
        { success: false, error: 'Redirect add-on fee must be 0 or higher.' },
        { status: 400 }
      );
    }

    const updated = await updateHostingConfig({
      price: Math.round(price),
      ...(redirectFee !== undefined && { redirectFee: Math.round(redirectFee) }),
      ...(currencyCode && { currencyCode }),
      ...(currencySymbol && { currencySymbol }),
      ...(badge !== undefined && { badge }),
      ...(title !== undefined && { title }),
      ...(subtitle !== undefined && { subtitle }),
      ...(supportedStacksNotice !== undefined && { supportedStacksNotice }),
    });

    return NextResponse.json({ success: true, config: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update hosting fee';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
