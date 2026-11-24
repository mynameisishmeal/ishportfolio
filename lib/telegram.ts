import { DEFAULT_TELEGRAM_CONFIG } from './data';
import { formatPrice } from './format';
import { getTelegramConfig } from './store';
import { ContactMessage, HostingRequest, Order, TelegramConfig } from './types';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function maskBotToken(token: string): string {
  const clean = token.trim();
  if (!clean) return '';
  if (clean.length <= 10) return '••••••••';
  return `${clean.slice(0, 6)}••••••${clean.slice(-4)}`;
}

export async function sendTelegramText(options: {
  botToken: string;
  chatId: string;
  text: string;
}): Promise<{ ok: boolean; error?: string }> {
  const token = options.botToken.trim();
  const chatId = options.chatId.trim();

  if (!token || !chatId) {
    return { ok: false, error: 'Telegram Bot Token and Chat ID are required.' };
  }

  if (!/^[0-9]+:[A-Za-z0-9_-]{10,}$/.test(token)) {
    return { ok: false, error: 'Invalid Telegram Bot Token format.' };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: options.text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(5000),
    });

    const data = (await res.json().catch(() => null)) as {
      ok?: boolean;
      description?: string;
    } | null;

    if (!res.ok || !data?.ok) {
      return {
        ok: false,
        error: data?.description || `Telegram API returned HTTP ${res.status}`,
      };
    }

    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to reach Telegram API';
    return { ok: false, error: message };
  }
}

async function resolveConfigSafe(): Promise<TelegramConfig> {
  try {
    return await getTelegramConfig();
  } catch {
    return { ...DEFAULT_TELEGRAM_CONFIG };
  }
}

async function dispatchTelegramAlert(
  gate: (cfg: TelegramConfig) => boolean,
  lines: string[]
): Promise<{ sent: boolean; error?: string }> {
  const cfg = await resolveConfigSafe();
  if (!cfg.enabled || !cfg.botToken || !cfg.chatId || !gate(cfg)) {
    return { sent: false };
  }

  const res = await sendTelegramText({
    botToken: cfg.botToken,
    chatId: cfg.chatId,
    text: lines.join('\n'),
  });
  return { sent: res.ok, error: res.error };
}

export async function notifyContactToTelegram(
  msg: ContactMessage
): Promise<{ sent: boolean; error?: string }> {
  return dispatchTelegramAlert(
    cfg => cfg.notifyContact,
    [
      `<b>New Contact Message (#contact)</b>`,
      `<b>From:</b> ${escapeHtml(msg.name)} (${escapeHtml(msg.email)})`,
      `<b>Topic:</b> ${escapeHtml(msg.subject || 'General Inquiry')}`,
      ``,
      escapeHtml(msg.message),
    ]
  );
}

export async function notifyChatToTelegram(input: {
  visitorName: string;
  chatId: string;
  text: string;
}): Promise<{ sent: boolean; error?: string }> {
  return dispatchTelegramAlert(
    cfg => cfg.notifyChat,
    [
      `<b>New Live Chat Message</b>`,
      `<b>Visitor:</b> ${escapeHtml(input.visitorName || 'Visitor')}`,
      `<b>Session:</b> <code>${escapeHtml(input.chatId)}</code>`,
      ``,
      escapeHtml(input.text),
    ]
  );
}

export async function notifyOrderToTelegram(
  order: Order
): Promise<{ sent: boolean; error?: string }> {
  const itemLines = order.items.map(
    item =>
      `• ${escapeHtml(item.title)} x${item.quantity} (${escapeHtml(
        formatPrice(item.price * item.quantity, order.currencySymbol)
      )})`
  );

  return dispatchTelegramAlert(
    cfg => cfg.notifyOrders,
    [
      `<b>New Shop Order (${escapeHtml(order.id)})</b>`,
      `<b>Customer:</b> ${escapeHtml(order.customerName)} (${escapeHtml(order.customerEmail)})${
        order.keyHint ? ` · Key ••••-${escapeHtml(order.keyHint)}` : ''
      }`,
      `<b>Total:</b> ${escapeHtml(formatPrice(order.total, order.currencySymbol))}`,
      `<b>Payment:</b> ${escapeHtml(order.paymentMethod)}${
        order.paymentStatus === 'paid' ? ' (Paid)' : ''
      }`,
      ...(order.paymentReference
        ? [
            `<b>${
              order.paymentMethod === 'Bank Transfer' ? 'Narration Code' : 'Ref'
            }:</b> <code>${escapeHtml(order.paymentReference)}</code>`,
          ]
        : []),
      ``,
      ...itemLines,
      ...(order.notes ? [``, `<b>Notes:</b> ${escapeHtml(order.notes)}`] : []),
    ]
  );
}

export async function notifyHostPaidToTelegram(
  req: HostingRequest
): Promise<{ sent: boolean; error?: string }> {
  return dispatchTelegramAlert(
    () => true,
    [
      `<b>New Hosting Payment Confirmed (${escapeHtml(req.id)})</b>`,
      `<b>User:</b> ${escapeHtml(req.userName)} (${escapeHtml(req.userEmail)})`,
      `<b>Amount:</b> ${escapeHtml(formatPrice(req.amount, req.currencySymbol, req.currencyCode))}${
        req.redirectAddon
          ? ` (Includes Link Redirect +${escapeHtml(
              formatPrice(req.redirectFee ?? 15000, req.currencySymbol, req.currencyCode)
            )})`
          : ''
      }`,
      `<b>Project:</b> ${escapeHtml(req.projectName)}`,
      ...(req.redirectAddon && req.redirectTargetUrl
        ? [`<b>Redirect Target:</b> ${escapeHtml(req.redirectTargetUrl)}`]
        : []),
      ...(req.paymentReference
        ? [`<b>Ref:</b> <code>${escapeHtml(req.paymentReference)}</code>`]
        : []),
      ``,
      `User can now upload their ZIP folder.`,
    ]
  );
}

export async function notifyHostUploadToTelegram(
  req: HostingRequest
): Promise<{ sent: boolean; error?: string }> {
  const sizeMb = req.zipSizeBytes
    ? `${(req.zipSizeBytes / (1024 * 1024)).toFixed(2)} MB`
    : 'Unknown size';

  return dispatchTelegramAlert(
    () => true,
    [
      `<b>ZIP Folder Uploaded for Hosting (${escapeHtml(req.id)})</b>`,
      `<b>User:</b> ${escapeHtml(req.userName)} (${escapeHtml(req.userEmail)})`,
      `<b>Project:</b> ${escapeHtml(req.projectName)}`,
      ...(req.redirectAddon
        ? [
            `<b>Add-on:</b> Link Redirect (+${escapeHtml(
              formatPrice(req.redirectFee ?? 15000, req.currencySymbol, req.currencyCode)
            )})${req.redirectTargetUrl ? ` -> ${escapeHtml(req.redirectTargetUrl)}` : ''}`,
          ]
        : []),
      `<b>File:</b> <code>${escapeHtml(req.zipFileName || 'project.zip')}</code> (${escapeHtml(sizeMb)})`,
      ...(req.notes ? [``, `<b>Notes:</b> ${escapeHtml(req.notes)}`] : []),
      ``,
      `Open /admin -> Hosting to download the ZIP, deploy, and share the live link.`,
    ]
  );
}

export async function notifyHostBankTransferToTelegram(
  req: HostingRequest
): Promise<{ sent: boolean; error?: string }> {
  return dispatchTelegramAlert(
    () => true,
    [
      `<b>New Hosting Bank Transfer Submitted (${escapeHtml(req.id)})</b>`,
      `<b>User:</b> ${escapeHtml(req.userName)} (${escapeHtml(req.userEmail)})`,
      `<b>Project:</b> ${escapeHtml(req.projectName)}`,
      `<b>Amount Expected:</b> ${escapeHtml(
        formatPrice(req.amount, req.currencySymbol, req.currencyCode)
      )}`,
      ...(req.redirectAddon
        ? [
            `<b>Add-on:</b> Link Redirect (+${escapeHtml(
              formatPrice(req.redirectFee ?? 15000, req.currencySymbol, req.currencyCode)
            )})`,
          ]
        : []),
      ...(req.paymentReference
        ? [`<b>Narration Code:</b> <code>${escapeHtml(req.paymentReference)}</code>`]
        : []),
      ...(req.transferProof
        ? [`<b>Sender / Note:</b> ${escapeHtml(req.transferProof)}`]
        : []),
      ...(req.notes ? [``, `<b>Notes:</b> ${escapeHtml(req.notes)}`] : []),
      ``,
      `Open /admin -> Hosting to verify the transfer and unlock ZIP upload.`,
    ]
  );
}
