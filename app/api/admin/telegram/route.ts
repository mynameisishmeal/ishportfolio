import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';
import { getTelegramConfig, updateTelegramConfig } from '@/lib/store';
import { maskBotToken, sendTelegramText } from '@/lib/telegram';
import { safeErrorMessage, verifySameOrigin } from '@/lib/security';

export const dynamic = 'force-dynamic';

function toSafeResponse(cfg: Awaited<ReturnType<typeof getTelegramConfig>>) {
  return {
    enabled: cfg.enabled,
    chatId: cfg.chatId,
    hasBotToken: Boolean(cfg.botToken),
    maskedToken: maskBotToken(cfg.botToken),
    notifyContact: cfg.notifyContact,
    notifyChat: cfg.notifyChat,
    notifyOrders: cfg.notifyOrders,
  };
}

export async function GET() {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const cfg = await getTelegramConfig();
    return NextResponse.json({ success: true, telegram: toSafeResponse(cfg) });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: safeErrorMessage(err, 'Failed to load Telegram settings') },
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
    const current = await getTelegramConfig();

    const clearToken = Boolean(body?.clearToken);
    const incomingToken = typeof body?.botToken === 'string' ? body.botToken.trim() : '';
    const nextToken = clearToken ? '' : incomingToken || current.botToken;
    const nextChatId =
      typeof body?.chatId === 'string' ? body.chatId.trim() : current.chatId;
    const nextEnabled =
      typeof body?.enabled === 'boolean' ? body.enabled : current.enabled;

    if (nextToken && !/^[0-9]+:[A-Za-z0-9_-]{10,}$/.test(nextToken)) {
      return NextResponse.json(
        { success: false, error: 'Bot Token format looks invalid (expected 123456:ABC...).' },
        { status: 400 }
      );
    }

    if (nextEnabled && (!nextToken || !nextChatId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Both Bot Token and Chat ID are required to enable Telegram notifications.',
        },
        { status: 400 }
      );
    }

    const saved = await updateTelegramConfig({
      enabled: nextEnabled,
      botToken: nextToken,
      chatId: nextChatId,
      notifyContact:
        typeof body?.notifyContact === 'boolean' ? body.notifyContact : current.notifyContact,
      notifyChat:
        typeof body?.notifyChat === 'boolean' ? body.notifyChat : current.notifyChat,
      notifyOrders:
        typeof body?.notifyOrders === 'boolean' ? body.notifyOrders : current.notifyOrders,
    });

    return NextResponse.json({
      success: true,
      telegram: toSafeResponse(saved),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: safeErrorMessage(err, 'Failed to save Telegram settings') },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const csrfError = verifySameOrigin(request);
    if (csrfError) {
      return NextResponse.json({ success: false, error: csrfError }, { status: 403 });
    }

    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      botToken?: unknown;
      chatId?: unknown;
    };
    const current = await getTelegramConfig();

    const token =
      typeof body?.botToken === 'string' && body.botToken.trim()
        ? body.botToken.trim()
        : current.botToken;
    const chatId =
      typeof body?.chatId === 'string' && body.chatId.trim()
        ? body.chatId.trim()
        : current.chatId;

    const result = await sendTelegramText({
      botToken: token,
      chatId,
      text: '<b>Test Notification</b>\nTelegram forwarding from your portfolio admin panel is working.',
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Telegram test failed.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: safeErrorMessage(err, 'Telegram test failed') },
      { status: 500 }
    );
  }
}
