import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  generateChatId,
  getChatById,
  sanitizeChatId,
  sendVisitorChatMessage,
} from '@/lib/store';
import {
  checkMultiRateLimit,
  detectBotPayload,
  getClientIp,
  rateLimitHeaders,
} from '@/lib/rate-limit';
import { notifyChatToTelegram } from '@/lib/telegram';

const VISITOR_CHAT_COOKIE = 'ish_chat_id';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function attachVisitorCookie(
  response: NextResponse,
  chatId: string,
  request: Request
): NextResponse {
  const isHttps =
    request.headers.get('x-forwarded-proto') === 'https' ||
    request.url.startsWith('https://');
  response.cookies.set(VISITOR_CHAT_COOKIE, chatId, {
    httpOnly: false,
    sameSite: 'lax',
    secure: isHttps,
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
  });
  return response;
}

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const url = new URL(request.url);
  const queryId = sanitizeChatId(url.searchParams.get('chatId'));
  const cookieId = sanitizeChatId(cookieStore.get(VISITOR_CHAT_COOKIE)?.value);
  const chatId = queryId || cookieId || generateChatId();

  try {
    const thread = await getChatById(chatId);
    const res = NextResponse.json({
      success: true,
      chatId,
      thread,
    });
    return attachVisitorCookie(res, chatId, request);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load chat';
    const res = NextResponse.json(
      { success: false, chatId, thread: null, error: message },
      { status: 503 }
    );
    return attachVisitorCookie(res, chatId, request);
  }
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const cookieId = sanitizeChatId(cookieStore.get(VISITOR_CHAT_COOKIE)?.value);
  let resolvedChatId = cookieId || '';

  try {
    const ip = getClientIp(request);
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

    const botError = detectBotPayload(body);
    if (botError) {
      const chatId = resolvedChatId || generateChatId();
      return attachVisitorCookie(
        NextResponse.json({ success: false, chatId, error: botError }, { status: 400 }),
        chatId,
        request
      );
    }

    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    const visitorName = typeof body?.visitorName === 'string' ? body.visitorName.trim() : '';
    const bodyChatId = sanitizeChatId(typeof body?.chatId === 'string' ? body.chatId : undefined);
    const messageId = typeof body?.messageId === 'string' ? body.messageId : undefined;
    const chatId = bodyChatId || cookieId || generateChatId();
    resolvedChatId = chatId;

    const rate = checkMultiRateLimit([
      { namespace: 'chat-burst', key: ip, maxRequests: 10, windowMs: 60_000 },
      { namespace: 'chat-sustained', key: ip, maxRequests: 35, windowMs: 15 * 60_000 },
    ]);
    const rlHeaders = rateLimitHeaders(rate);
    if (!rate.allowed) {
      return attachVisitorCookie(
        NextResponse.json(
          {
            success: false,
            chatId,
            error: `Rate limit reached. Please wait ${rate.retryAfterSeconds}s before sending more messages.`,
          },
          { status: 429, headers: rlHeaders }
        ),
        chatId,
        request
      );
    }

    if (!text) {
      return attachVisitorCookie(
        NextResponse.json(
          { success: false, chatId, error: 'Message text is required.' },
          { status: 400, headers: rlHeaders }
        ),
        chatId,
        request
      );
    }

    const thread = await sendVisitorChatMessage({
      chatId,
      visitorName,
      text,
      messageId,
    });

    await notifyChatToTelegram({
      visitorName: thread.visitorName,
      chatId,
      text,
    });

    const res = NextResponse.json(
      {
        success: true,
        chatId,
        thread,
      },
      { headers: rlHeaders }
    );
    return attachVisitorCookie(res, chatId, request);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to send message';
    const fallbackChatId = resolvedChatId || generateChatId();
    return attachVisitorCookie(
      NextResponse.json(
        { success: false, chatId: fallbackChatId, error: message },
        { status: 503 }
      ),
      fallbackChatId,
      request
    );
  }
}
