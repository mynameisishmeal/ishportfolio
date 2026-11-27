import { NextResponse } from 'next/server';
import { getUploadById } from '@/lib/store';
import { safeErrorMessage } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const upload = await getUploadById(id);

    if (!upload) {
      return NextResponse.json({ success: false, error: 'File not found' }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(upload.data), {
      status: 200,
      headers: {
        'Content-Type': upload.contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: safeErrorMessage(err, 'Failed to load image') },
      { status: 500 }
    );
  }
}
