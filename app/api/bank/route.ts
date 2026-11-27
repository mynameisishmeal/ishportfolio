import { NextResponse } from 'next/server';
import { getBankTransferConfig } from '@/lib/store';
import { safeErrorMessage } from '@/lib/security';

export const dynamic = 'force-dynamic';

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
    return NextResponse.json(
      { success: false, error: safeErrorMessage(err, 'Failed to load bank transfer info') },
      { status: 500 }
    );
  }
}
