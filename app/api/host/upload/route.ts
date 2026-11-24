import { NextResponse } from 'next/server';
import { getAuthenticatedHostUser } from '@/lib/host-auth';
import { attachHostingZipUpload } from '@/lib/store';
import { notifyHostUploadToTelegram } from '@/lib/telegram';
import { checkRateLimit, getClientIp, rateLimitHeaders } from '@/lib/rate-limit';

const MAX_ZIP_BYTES = 50 * 1024 * 1024; // 50 MB via GridFS

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedHostUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Please sign in before uploading.' },
        { status: 401 }
      );
    }

    const ip = getClientIp(request);
    const rate = checkRateLimit({
      namespace: 'host-upload',
      key: `${ip}:${user.id}`,
      maxRequests: 10,
      windowMs: 15 * 60_000,
    });
    const rlHeaders = rateLimitHeaders(rate);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many upload attempts. Please wait ${rate.retryAfterSeconds}s and try again.`,
        },
        { status: 429, headers: rlHeaders }
      );
    }

    const formData = await request.formData();
    const requestId = String(formData.get('requestId') || '').trim();
    const projectName = String(formData.get('projectName') || '').trim();
    const notes = String(formData.get('notes') || '').trim();
    const fileEntry = formData.get('file');

    if (!requestId) {
      return NextResponse.json(
        { success: false, error: 'Missing paid hosting slot ID.' },
        { status: 400, headers: rlHeaders }
      );
    }

    if (!(fileEntry instanceof File)) {
      return NextResponse.json(
        { success: false, error: 'Please choose a .zip file to upload.' },
        { status: 400, headers: rlHeaders }
      );
    }

    if (!fileEntry.name.toLowerCase().endsWith('.zip')) {
      return NextResponse.json(
        { success: false, error: 'Only .zip archive folders are accepted.' },
        { status: 400, headers: rlHeaders }
      );
    }

    if (fileEntry.size <= 0 || fileEntry.size > MAX_ZIP_BYTES) {
      return NextResponse.json(
        { success: false, error: 'ZIP file must be between 1 byte and 50 MB.' },
        { status: 400, headers: rlHeaders }
      );
    }

    const arrayBuffer = await fileEntry.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Check ZIP magic bytes ("PK")
    if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
      return NextResponse.json(
        { success: false, error: 'Uploaded file does not appear to be a valid ZIP archive.' },
        { status: 400, headers: rlHeaders }
      );
    }

    const saved = await attachHostingZipUpload({
      requestId,
      userId: user.id,
      fileBuffer: buffer,
      fileName: fileEntry.name,
      projectName,
      notes,
    });

    if (saved.error || !saved.request) {
      return NextResponse.json(
        { success: false, error: saved.error || 'Failed to store uploaded ZIP.' },
        { status: 400, headers: rlHeaders }
      );
    }

    await notifyHostUploadToTelegram(saved.request);

    return NextResponse.json(
      { success: true, request: saved.request },
      { headers: rlHeaders }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'ZIP upload failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
