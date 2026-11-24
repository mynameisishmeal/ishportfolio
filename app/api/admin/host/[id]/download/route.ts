import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';
import { getHostingZipDownload } from '@/lib/store';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;
    const file = await getHostingZipDownload(id);
    if (!file) {
      return NextResponse.json({ success: false, error: 'ZIP file not found.' }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(file.buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${file.fileName}"`,
        'Content-Length': String(file.buffer.length),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to download ZIP';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
