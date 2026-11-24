import crypto from 'crypto';

const PAYSTACK_API_BASE = 'https://api.paystack.co';

export function maskPaystackKey(key: string): string {
  const clean = key.trim();
  if (!clean) return '';
  if (clean.length <= 12) return '••••••••';
  return `${clean.slice(0, 8)}••••••${clean.slice(-4)}`;
}

export async function initializePaystackTransaction(options: {
  secretKey: string;
  email: string;
  amountMinor: number;
  currency: string;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}): Promise<{ ok: boolean; authorizationUrl?: string; error?: string }> {
  const secret = options.secretKey.trim();
  if (!secret) {
    return { ok: false, error: 'Paystack Secret Key is not configured.' };
  }

  try {
    const res = await fetch(`${PAYSTACK_API_BASE}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: options.email,
        amount: options.amountMinor,
        currency: options.currency.toUpperCase(),
        reference: options.reference,
        callback_url: options.callbackUrl,
        metadata: options.metadata,
      }),
      signal: AbortSignal.timeout(10000),
    });

    const json = (await res.json().catch(() => null)) as {
      status?: boolean;
      message?: string;
      data?: { authorization_url?: string };
    } | null;

    if (!res.ok || !json?.status || !json?.data?.authorization_url) {
      return {
        ok: false,
        error: json?.message || `Paystack initialization failed (HTTP ${res.status}).`,
      };
    }

    return { ok: true, authorizationUrl: json.data.authorization_url };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unable to reach Paystack.';
    return { ok: false, error: message };
  }
}

export interface VerifiedPaystackTx {
  status: string;
  reference: string;
  amount: number;
  currency: string;
  paidAt?: string;
}

export async function verifyPaystackTransaction(options: {
  secretKey: string;
  reference: string;
}): Promise<{ ok: boolean; data?: VerifiedPaystackTx; error?: string }> {
  const secret = options.secretKey.trim();
  if (!secret) {
    return { ok: false, error: 'Paystack Secret Key is not configured.' };
  }

  try {
    const res = await fetch(
      `${PAYSTACK_API_BASE}/transaction/verify/${encodeURIComponent(options.reference)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${secret}`,
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      }
    );

    const json = (await res.json().catch(() => null)) as {
      status?: boolean;
      message?: string;
      data?: {
        status?: string;
        reference?: string;
        amount?: number;
        currency?: string;
        paid_at?: string;
      };
    } | null;

    if (!res.ok || !json?.status || !json?.data) {
      return {
        ok: false,
        error: json?.message || `Paystack verification failed (HTTP ${res.status}).`,
      };
    }

    return {
      ok: true,
      data: {
        status: String(json.data.status || ''),
        reference: String(json.data.reference || ''),
        amount: Number(json.data.amount || 0),
        currency: String(json.data.currency || ''),
        paidAt: json.data.paid_at,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unable to verify Paystack transaction.';
    return { ok: false, error: message };
  }
}

export function verifyPaystackWebhookSignature(
  rawBody: string,
  signature: string | null,
  secretKey: string
): boolean {
  if (!signature || !secretKey) return false;
  const expected = crypto
    .createHmac('sha512', secretKey.trim())
    .update(rawBody)
    .digest('hex');
  const a = Buffer.from(signature.trim(), 'utf-8');
  const b = Buffer.from(expected, 'utf-8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
