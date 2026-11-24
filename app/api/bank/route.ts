import { NextResponse } from 'next/server';
import { getBankTransferConfig } from '@/lib/store';

export async function GET() {
  try {
    const cfg = await getBankTransferConfig();
    const isActive = Boolean(
      cfg.enabled && cfg.bankName && cfg.accountName && cfg.accountNumber
    );
    return NextResponse.json({
      success: true,
      bank: {
        enabled: isActive,
        bankName: isActive ? cfg.bankName : '',
        accountName: isActive ? cfg.accountName : '',
        accountNumber: isActive ? cfg.accountNumber : '',
        instructions: isActive ? cfg.instructions || '' : '',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load bank transfer info';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
