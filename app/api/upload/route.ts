import path from 'path';
import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';
import { saveUpload } from '@/lib/store';
import { safeErrorMessage, validateImageMagicBytes, verifySameOrigin } from '@/lib/security';

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};
const MAX_BYTES = 4 * 1024 * 1024; // 4 MB (fits within Vercel's 4.5 MB request body limit)

export async function POST(request: Request) {
  try {
    const csrfError = verifySameOrigin(request);
    if (csrfError) {
      return NextResponse.json({ success: false, error: csrfError }, { status: 403 });
    }

    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'No image file provided.' }, { status: 400 });
    }

    if (file.size <= 0 || file.size > MAX_BYTES) {
      return NextResponse.json({ success: false, error: 'Image file must be under 4 MB.' }, { status: 400 });
    }

    const rawExt = path.extname(file.name || '').toLowerCase();
    const contentType = MIME_BY_EXT[rawExt];
    if (!contentType) {
      return NextResponse.json(
        { success: false, error: 'Supported formats: PNG, JPG, WEBP, GIF.' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!validateImageMagicBytes(buffer, rawExt)) {
      return NextResponse.json(
        { success: false, error: 'Uploaded file content does not match a valid image format.' },
        { status: 400 }
      );
    }

    const baseName =
      path
        .basename(file.name, rawExt)
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'image';

    const fileId = `${Date.now()}-${baseName}${rawExt}`;
    await saveUpload(fileId, contentType, buffer);

    return NextResponse.json({ success: true, url: `/api/uploads/${fileId}` });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: safeErrorMessage(err, 'Upload failed') },
      { status: 500 }
    );
  }
}
