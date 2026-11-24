import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';
import { getBankTransferConfig, updateBankTransferConfig } from '@/lib/store';

function toBankResponse(cfg: Awaited<ReturnType<typeof getBankTransferConfig>>) {
  return {
    enabled: Boolean(cfg.enabled),
    bankName: cfg.bankName || '',
    accountName: cfg.accountName || '',
    accountNumber: cfg.accountNumber || '',
    instructions: cfg.instructions || '',
  };
}

export async function GET() {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const cfg = await getBankTransferConfig();
    return NextResponse.json({ success: true, bank: toBankResponse(cfg) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load bank transfer settings';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const current = await getBankTransferConfig();

    const nextEnabled =
      typeof body?.enabled === 'boolean' ? body.enabled : current.enabled;
    const nextBankName =
      typeof body?.bankName === 'string'
        ? body.bankName.trim().slice(0, 100)
        : current.bankName;
    const nextAccountName =
      typeof body?.accountName === 'string'
        ? body.accountName.trim().slice(0, 120)
        : current.accountName;
    const nextAccountNumber =
      typeof body?.accountNumber === 'string'
        ? body.accountNumber.trim().slice(0, 40)
        : current.accountNumber;
    const nextInstructions =
      typeof body?.instructions === 'string'
        ? body.instructions.trim().slice(0, 500)
        : current.instructions;

    if (nextEnabled && (!nextBankName || !nextAccountName || !nextAccountNumber)) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Bank Name, Account Name, and Account Number are required to enable Direct Bank Transfer.',
        },
        { status: 400 }
      );
    }

    const saved = await updateBankTransferConfig({
      enabled: nextEnabled,
      bankName: nextBankName,
      accountName: nextAccountName,
      accountNumber: nextAccountNumber,
      instructions: nextInstructions,
    });

    return NextResponse.json({
      success: true,
      bank: toBankResponse(saved),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save bank transfer settings';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
