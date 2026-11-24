import { NextResponse } from 'next/server';
import {
  getAuthenticatedHostSession,
  HOST_COOKIE_NAME,
  HOST_SESSION_TTL_MS,
  signHostSessionCookie,
} from '@/lib/host-auth';
import {
  getBankTransferConfig,
  getOrdersByUserId,
  getPaystackConfig,
} from '@/lib/store';
import { DEFAULT_BANK_TRANSFER_CONFIG } from '@/lib/data';

export async function GET(request: Request) {
  try {
    const [paystackCfg, bankCfg, session] = await Promise.all([
      getPaystackConfig().catch(() => ({ enabled: false, secretKey: '', publicKey: '' })),
      getBankTransferConfig().catch(() => DEFAULT_BANK_TRANSFER_CONFIG),
      getAuthenticatedHostSession(request),
    ]);

    const user = session?.user ?? null;
    const orders = user ? await getOrdersByUserId(user.id) : [];

    const bankTransferEnabled = Boolean(
      bankCfg.enabled && bankCfg.bankName && bankCfg.accountName && bankCfg.accountNumber
    );

    const res = NextResponse.json({
      success: true,
      user,
      orders,
      payment: {
        paystackEnabled: Boolean(paystackCfg.enabled && paystackCfg.secretKey),
        bankTransferEnabled,
        bankTransfer: bankTransferEnabled
          ? {
              bankName: bankCfg.bankName,
              accountName: bankCfg.accountName,
              accountNumber: bankCfg.accountNumber,
              instructions: bankCfg.instructions || '',
            }
          : null,
      },
    });

    if (session) {
      const refreshedToken = await signHostSessionCookie(session.sessionId);
      const isHttps =
        request.url.startsWith('https://') ||
        request.headers.get('x-forwarded-proto') === 'https';
      res.cookies.set(HOST_COOKIE_NAME, refreshedToken, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: Math.floor(HOST_SESSION_TTL_MS / 1000),
        secure: isHttps,
      });
    }

    return res;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load shop session';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
