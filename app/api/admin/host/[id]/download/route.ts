import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';
import { openHostingZipDownloadStream } from '@/lib/store';
import { safeErrorMessage } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;
    const download = await openHostingZipDownloadStream(id);
    if (!download) {
      return NextResponse.json({ success: false, error: 'ZIP file not found.' }, { status: 404 });
    }

    const safeFileName = download.fileName.replace(/[^a-zA-Z0-9._-]/g, '_') || 'project.zip';
    const webStream = new ReadableStream<Uint8Array>({
      start(controller) {
        download.stream.on('data', (chunk: Buffer) => {
          controller.enqueue(new Uint8Array(chunk));
        });
        download.stream.on('end', () => controller.close());
        download.stream.on('error', err => controller.error(err));
      },
      cancel() {
        download.stream.destroy();
      },
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${safeFileName}"`,
      'X-Content-Type-Options': 'nosniff',
    };
    if (download.sizeBytes && download.sizeBytes > 0) {
      headers['Content-Length'] = String(download.sizeBytes);
    }

    return new NextResponse(webStream, {
      status: 200,
      headers,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: safeErrorMessage(err, 'Failed to download ZIP') },
      { status: 500 }
    );
  }
}
