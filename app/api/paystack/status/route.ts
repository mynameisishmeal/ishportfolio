import { NextResponse } from 'next/server';
import { getPaystackConfig } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cfg = await getPaystackConfig();
    return NextResponse.json({
      success: true,
      enabled: Boolean(cfg.enabled && cfg.secretKey),
    });
  } catch {
    return NextResponse.json({ success: true, enabled: false });
  }
}
