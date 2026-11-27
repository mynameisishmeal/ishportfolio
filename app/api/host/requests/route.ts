import { NextResponse } from 'next/server';
import {
  getAuthenticatedHostSession,
  HOST_COOKIE_NAME,
  HOST_SESSION_TTL_MS,
  signHostSessionCookie,
} from '@/lib/host-auth';
import {
  getBankTransferConfig,
  getHostingConfig,
  getHostingRequestsByUserId,
  getPaystackConfig,
} from '@/lib/store';
import { DEFAULT_BANK_TRANSFER_CONFIG, DEFAULT_HOSTING_CONFIG } from '@/lib/data';
import { safeErrorMessage } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const [config, paystackCfg, bankCfg] = await Promise.all([
      getHostingConfig().catch(() => DEFAULT_HOSTING_CONFIG),
      getPaystackConfig().catch(() => ({ enabled: false, secretKey: '', publicKey: '' })),
      getBankTransferConfig().catch(() => DEFAULT_BANK_TRANSFER_CONFIG),
    ]);

    const bankTransferEnabled = Boolean(
      bankCfg.enabled && bankCfg.bankName && bankCfg.accountName && bankCfg.accountNumber
    );

    const session = await getAuthenticatedHostSession(request);
    const user = session?.user ?? null;
    const requests = user ? await getHostingRequestsByUserId(user.id) : [];

    const res = NextResponse.json({
      success: true,
      config: {
        price: config.price,
        redirectFee: config.redirectFee ?? DEFAULT_HOSTING_CONFIG.redirectFee ?? 15000,
        currencyCode: config.currencyCode,
        currencySymbol: config.currencySymbol,
        badge: config.badge || DEFAULT_HOSTING_CONFIG.badge,
        title: config.title || DEFAULT_HOSTING_CONFIG.title,
        subtitle: config.subtitle || DEFAULT_HOSTING_CONFIG.subtitle,
        supportedStacksNotice:
          config.supportedStacksNotice || DEFAULT_HOSTING_CONFIG.supportedStacksNotice,
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
      user,
      requests,
    });

    // Slide the browser cookie expiration forward while session is active so users log in less
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
    return NextResponse.json(
      { success: false, error: safeErrorMessage(err, 'Failed to load hosting status') },
      { status: 503 }
    );
  }
}
