import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';
import { getPaystackConfig, updatePaystackConfig } from '@/lib/store';
import { maskPaystackKey } from '@/lib/paystack';
import { safeErrorMessage, verifySameOrigin } from '@/lib/security';

export const dynamic = 'force-dynamic';

function toSafePaystackResponse(cfg: Awaited<ReturnType<typeof getPaystackConfig>>) {
  return {
    enabled: cfg.enabled,
    publicKey: cfg.publicKey,
    hasSecretKey: Boolean(cfg.secretKey),
    maskedSecretKey: maskPaystackKey(cfg.secretKey),
  };
}

export async function GET() {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const cfg = await getPaystackConfig();
    return NextResponse.json({ success: true, paystack: toSafePaystackResponse(cfg) });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: safeErrorMessage(err, 'Failed to load Paystack settings') },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const csrfError = verifySameOrigin(request);
    if (csrfError) {
      return NextResponse.json({ success: false, error: csrfError }, { status: 403 });
    }

    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const current = await getPaystackConfig();

    const clearSecretKey = Boolean(body?.clearSecretKey);
    const incomingSecret = typeof body?.secretKey === 'string' ? body.secretKey.trim() : '';
    const nextSecret = clearSecretKey ? '' : incomingSecret || current.secretKey;
    const nextPublic =
      typeof body?.publicKey === 'string' ? body.publicKey.trim() : current.publicKey;
    const nextEnabled =
      typeof body?.enabled === 'boolean' ? body.enabled : current.enabled;

    if (nextSecret && !nextSecret.startsWith('sk_')) {
      return NextResponse.json(
        { success: false, error: 'Paystack Secret Key should start with "sk_test_" or "sk_live_".' },
        { status: 400 }
      );
    }

    if (nextPublic && !nextPublic.startsWith('pk_')) {
      return NextResponse.json(
        { success: false, error: 'Paystack Public Key should start with "pk_test_" or "pk_live_".' },
        { status: 400 }
      );
    }

    if (nextEnabled && !nextSecret) {
      return NextResponse.json(
        { success: false, error: 'A Paystack Secret Key is required to enable Paystack checkout.' },
        { status: 400 }
      );
    }

    const saved = await updatePaystackConfig({
      enabled: nextEnabled,
      publicKey: nextPublic,
      secretKey: nextSecret,
    });

    return NextResponse.json({
      success: true,
      paystack: toSafePaystackResponse(saved),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: safeErrorMessage(err, 'Failed to save Paystack settings') },
      { status: 500 }
    );
  }
}
