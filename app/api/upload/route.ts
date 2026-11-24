import path from 'path';
import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';
import { saveUpload } from '@/lib/store';

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

export async function POST(request: Request) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'No image file provided.' }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ success: false, error: 'File must be under 5 MB.' }, { status: 400 });
    }

    const rawExt = path.extname(file.name || '').toLowerCase();
    const contentType = MIME_BY_EXT[rawExt];
    if (!contentType) {
      return NextResponse.json(
        { success: false, error: 'Supported formats: PNG, JPG, WEBP, GIF.' },
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
    const buffer = Buffer.from(await file.arrayBuffer());
    await saveUpload(fileId, contentType, buffer);

    return NextResponse.json({ success: true, url: `/api/uploads/${fileId}` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
