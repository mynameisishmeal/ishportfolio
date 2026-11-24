import { NextResponse } from 'next/server';
import { getUploadById } from '@/lib/store';

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
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load image';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
