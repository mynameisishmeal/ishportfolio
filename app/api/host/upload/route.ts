import { NextResponse } from 'next/server';
import { getAuthenticatedHostUser } from '@/lib/host-auth';
import {
  attachHostingZipUpload,
  finalizeHostingZipChunks,
  saveHostingZipChunk,
} from '@/lib/store';
import { notifyHostUploadToTelegram } from '@/lib/telegram';
import { checkRateLimit, getClientIp, rateLimitHeaders } from '@/lib/rate-limit';
import { safeErrorMessage, verifySameOrigin } from '@/lib/security';

const MAX_ZIP_BYTES = 50 * 1024 * 1024; // 50 MB total via GridFS
const MAX_SINGLE_REQUEST_BYTES = 4 * 1024 * 1024; // Fits safely under Vercel's 4.5 MB body limit
const UPLOAD_ID_PATTERN = /^[a-zA-Z0-9_-]{8,80}$/;

export async function POST(request: Request) {
  try {
    const csrfError = verifySameOrigin(request);
    if (csrfError) {
      return NextResponse.json({ success: false, error: csrfError }, { status: 403 });
    }

    const user = await getAuthenticatedHostUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Please sign in before uploading.' },
        { status: 401 }
      );
    }

    const contentType = request.headers.get('content-type') || '';

    // Mode 1: Finalize previously uploaded chunks
    if (contentType.includes('application/json')) {
      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      if (body?.mode !== 'finalize') {
        return NextResponse.json({ success: false, error: 'Invalid upload request.' }, { status: 400 });
      }

      const ip = getClientIp(request);
      const rate = checkRateLimit({
        namespace: 'host-upload',
        key: `${ip}:${user.id}`,
        maxRequests: 15,
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

      const uploadId = typeof body.uploadId === 'string' ? body.uploadId.trim() : '';
      const requestId = typeof body.requestId === 'string' ? body.requestId.trim() : '';
      const fileName = typeof body.fileName === 'string' ? body.fileName.trim() : '';
      const projectName = typeof body.projectName === 'string' ? body.projectName.trim() : '';
      const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
      const totalChunks = Number(body.totalChunks);

      if (!UPLOAD_ID_PATTERN.test(uploadId) || !requestId || !fileName.toLowerCase().endsWith('.zip')) {
        return NextResponse.json(
          { success: false, error: 'Invalid upload finalization parameters.' },
          { status: 400, headers: rlHeaders }
        );
      }

      const saved = await finalizeHostingZipChunks({
        uploadId,
        requestId,
        userId: user.id,
        totalChunks,
        fileName,
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
      return NextResponse.json({ success: true, request: saved.request }, { headers: rlHeaders });
    }

    const formData = await request.formData();
    const mode = String(formData.get('mode') || '').trim();
    const requestId = String(formData.get('requestId') || '').trim();

    if (!requestId) {
      return NextResponse.json(
        { success: false, error: 'Missing paid hosting slot ID.' },
        { status: 400 }
      );
    }

    // Mode 2: Chunk upload (<= 4 MB per request, supports up to 50 MB total on Vercel)
    if (mode === 'chunk') {
      const ip = getClientIp(request);
      const rate = checkRateLimit({
        namespace: 'host-upload-chunk',
        key: `${ip}:${user.id}`,
        maxRequests: 120,
        windowMs: 15 * 60_000,
      });
      const rlHeaders = rateLimitHeaders(rate);
      if (!rate.allowed) {
        return NextResponse.json(
          {
            success: false,
            error: `Too many upload requests. Please wait ${rate.retryAfterSeconds}s and try again.`,
          },
          { status: 429, headers: rlHeaders }
        );
      }

      const uploadId = String(formData.get('uploadId') || '').trim();
      const chunkIndex = Number(formData.get('chunkIndex'));
      const totalChunks = Number(formData.get('totalChunks'));
      const fileName = String(formData.get('fileName') || '').trim();
      const chunkEntry = formData.get('chunk');

      if (!UPLOAD_ID_PATTERN.test(uploadId)) {
        return NextResponse.json(
          { success: false, error: 'Invalid upload session ID.' },
          { status: 400, headers: rlHeaders }
        );
      }

      if (!fileName.toLowerCase().endsWith('.zip')) {
        return NextResponse.json(
          { success: false, error: 'Only .zip archive folders are accepted.' },
          { status: 400, headers: rlHeaders }
        );
      }

      if (!(chunkEntry instanceof Blob) || chunkEntry.size <= 0 || chunkEntry.size > MAX_SINGLE_REQUEST_BYTES) {
        return NextResponse.json(
          { success: false, error: 'Invalid upload chunk size.' },
          { status: 400, headers: rlHeaders }
        );
      }

      const chunkBuffer = Buffer.from(await chunkEntry.arrayBuffer());
      const res = await saveHostingZipChunk({
        uploadId,
        requestId,
        userId: user.id,
        chunkIndex,
        totalChunks,
        chunkBuffer,
      });

      if (!res.ok) {
        return NextResponse.json(
          { success: false, error: res.error || 'Could not save upload chunk.' },
          { status: 400, headers: rlHeaders }
        );
      }

      return NextResponse.json({ success: true, chunkIndex }, { headers: rlHeaders });
    }

    // Mode 3: Single-request upload (for small <= 4 MB files / backward compatibility)
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

    const projectName = String(formData.get('projectName') || '').trim();
    const notes = String(formData.get('notes') || '').trim();
    const fileEntry = formData.get('file');

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
    return NextResponse.json(
      { success: false, error: safeErrorMessage(err, 'ZIP upload failed') },
      { status: 500 }
    );
  }
}
