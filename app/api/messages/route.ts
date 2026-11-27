import { NextResponse } from 'next/server';
import { addMessage, getMessages } from '@/lib/store';
import { isAdminAuthenticated } from '@/lib/auth';
import {
  checkMultiRateLimit,
  detectBotPayload,
  getClientIp,
  rateLimitHeaders,
} from '@/lib/rate-limit';
import { notifyContactToTelegram } from '@/lib/telegram';
import { safeErrorMessage, verifySameOrigin } from '@/lib/security';

export const dynamic = 'force-dynamic';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const messages = await getMessages();
    return NextResponse.json({ success: true, messages });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: safeErrorMessage(err, 'Failed to fetch messages') },
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

    const ip = getClientIp(request);
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

    const botError = detectBotPayload(body);
    if (botError) {
      return NextResponse.json({ success: false, error: botError }, { status: 400 });
    }

    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 120) : '';
    const email = typeof body?.email === 'string' ? body.email.trim().slice(0, 160) : '';
    const subject =
      typeof body?.subject === 'string' && body.subject.trim()
        ? body.subject.trim().slice(0, 200)
        : 'General Inquiry';
    const message = typeof body?.message === 'string' ? body.message.trim().slice(0, 4000) : '';

    if (!name || !email || !message) {
      return NextResponse.json(
        { success: false, error: 'Name, email, and message are required.' },
        { status: 400 }
      );
    }

    if (!EMAIL_PATTERN.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    const rate = checkMultiRateLimit([
      { namespace: 'contact-burst', key: ip, maxRequests: 2, windowMs: 60_000 },
      { namespace: 'contact-ip', key: ip, maxRequests: 5, windowMs: 15 * 60_000 },
      {
        namespace: 'contact-email',
        key: email.toLowerCase(),
        maxRequests: 4,
        windowMs: 15 * 60_000,
      },
    ]);
    const rlHeaders = rateLimitHeaders(rate);

    if (!rate.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many messages sent. Please wait ${rate.retryAfterSeconds}s and try again.`,
        },
        { status: 429, headers: rlHeaders }
      );
    }

    let saved: Awaited<ReturnType<typeof addMessage>> | null = null;
    let dbError: unknown = null;
    try {
      saved = await addMessage({ name, email, subject, message });
    } catch (err) {
      dbError = err;
    }

    const messagePayload = saved ?? {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      email,
      subject,
      message,
      createdAt: new Date().toISOString(),
      read: false,
    };

    const tg = await notifyContactToTelegram(messagePayload);

    if (!saved && !tg.sent) {
      throw dbError instanceof Error ? dbError : new Error('Failed to send message');
    }

    return NextResponse.json(
      { success: true, message: messagePayload },
      { headers: rlHeaders }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: safeErrorMessage(err, 'Failed to send message') },
      { status: 500 }
    );
  }
}
