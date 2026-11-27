import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  generateChatId,
  getChatById,
  getSettings,
  sanitizeChatId,
  sendVisitorChatMessage,
} from '@/lib/store';
import {
  checkMultiRateLimit,
  checkRateLimit,
  detectBotPayload,
  getClientIp,
  rateLimitHeaders,
} from '@/lib/rate-limit';
import { notifyChatToTelegram } from '@/lib/telegram';
import {
  safeErrorMessage,
  signVisitorChatToken,
  verifySameOrigin,
  verifyVisitorChatToken,
} from '@/lib/security';

export const dynamic = 'force-dynamic';

const VISITOR_CHAT_COOKIE = 'ish_chat_token';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function attachVisitorCookie(
  response: NextResponse,
  signedToken: string,
  request: Request
): NextResponse {
  const isHttps =
    request.headers.get('x-forwarded-proto') === 'https' ||
    request.url.startsWith('https://');
  response.cookies.set(VISITOR_CHAT_COOKIE, signedToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isHttps,
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
  });
  return response;
}

async function resolveVerifiedChatIdentity(): Promise<{
  chatId: string;
  signedToken: string;
}> {
  const cookieStore = await cookies();
  const { sessionSecret } = await getSettings();
  const rawToken = cookieStore.get(VISITOR_CHAT_COOKIE)?.value;
  const verified = verifyVisitorChatToken(rawToken, sessionSecret);
  const chatId = sanitizeChatId(verified) || generateChatId();
  const signedToken = signVisitorChatToken(chatId, sessionSecret);
  return { chatId, signedToken };
}

export async function GET(request: Request) {
  try {
    const ip = getClientIp(request);
    const rate = checkRateLimit({
      namespace: 'chat-read',
      key: ip,
      maxRequests: 60,
      windowMs: 60_000,
    });
    const rlHeaders = rateLimitHeaders(rate);
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, thread: null, error: 'Too many requests. Please slow down.' },
        { status: 429, headers: rlHeaders }
      );
    }

    const { chatId, signedToken } = await resolveVerifiedChatIdentity();
    const thread = await getChatById(chatId);
    const res = NextResponse.json(
      {
        success: true,
        chatId,
        thread,
      },
      { headers: rlHeaders }
    );
    return attachVisitorCookie(res, signedToken, request);
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, thread: null, error: safeErrorMessage(err, 'Failed to load chat') },
      { status: 503 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const csrfError = verifySameOrigin(request);
    if (csrfError) {
      return NextResponse.json({ success: false, error: csrfError }, { status: 403 });
    }

    const ip = getClientIp(request);
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

    const botError = detectBotPayload(body);
    if (botError) {
      return NextResponse.json({ success: false, error: botError }, { status: 400 });
    }

    const rate = checkMultiRateLimit([
      { namespace: 'chat-burst', key: ip, maxRequests: 10, windowMs: 60_000 },
      { namespace: 'chat-sustained', key: ip, maxRequests: 35, windowMs: 15 * 60_000 },
    ]);
    const rlHeaders = rateLimitHeaders(rate);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Rate limit reached. Please wait ${rate.retryAfterSeconds}s before sending more messages.`,
        },
        { status: 429, headers: rlHeaders }
      );
    }

    const { chatId, signedToken } = await resolveVerifiedChatIdentity();
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    const visitorName = typeof body?.visitorName === 'string' ? body.visitorName.trim() : '';
    const messageId = typeof body?.messageId === 'string' ? body.messageId : undefined;

    if (!text) {
      return attachVisitorCookie(
        NextResponse.json(
          { success: false, chatId, error: 'Message text is required.' },
          { status: 400, headers: rlHeaders }
        ),
        signedToken,
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
    return attachVisitorCookie(res, signedToken, request);
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: safeErrorMessage(err, 'Failed to send message') },
      { status: 503 }
    );
  }
}
