import { NextResponse } from 'next/server';
import { deleteProject, getProjectById, updateProject } from '@/lib/store';
import { isAdminAuthenticated } from '@/lib/auth';
import { isSafeHttpUrl, isSafeImageUrl } from '@/lib/format';
import { safeErrorMessage, verifySameOrigin } from '@/lib/security';
import { ProjectStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

const VALID_STATUSES: ProjectStatus[] = ['in_progress', 'live', 'completed', 'archived'];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = await getProjectById(id);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, project });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: safeErrorMessage(err, 'Failed to fetch project') },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrfError = verifySameOrigin(request);
    if (csrfError) {
      return NextResponse.json({ success: false, error: csrfError }, { status: 403 });
    }

    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      return NextResponse.json({ success: false, error: 'Invalid request body.' }, { status: 400 });
    }

    if (body.status !== undefined && !VALID_STATUSES.includes(body.status as ProjectStatus)) {
      return NextResponse.json({ success: false, error: 'Invalid project status.' }, { status: 400 });
    }
    if (typeof body.liveUrl === 'string' && body.liveUrl.trim() && !isSafeHttpUrl(body.liveUrl)) {
      return NextResponse.json(
        { success: false, error: 'Live URL must start with http:// or https://' },
        { status: 400 }
      );
    }
    if (typeof body.repoUrl === 'string' && body.repoUrl.trim() && !isSafeHttpUrl(body.repoUrl)) {
      return NextResponse.json(
        { success: false, error: 'Repository URL must start with http:// or https://' },
        { status: 400 }
      );
    }
    if (typeof body.imageUrl === 'string' && body.imageUrl.trim() && !isSafeImageUrl(body.imageUrl)) {
      return NextResponse.json(
        { success: false, error: 'Image URL must be a valid http(s) URL or local upload path.' },
        { status: 400 }
      );
    }

    const updated = await updateProject(id, {
      ...(typeof body.title === 'string' && { title: body.title.trim() }),
      ...(typeof body.tagline === 'string' && { tagline: body.tagline.trim() }),
      ...(typeof body.description === 'string' && { description: body.description.trim() }),
      ...(body.status !== undefined && { status: body.status as ProjectStatus }),
      ...(typeof body.category === 'string' && { category: body.category.trim() || 'General' }),
      ...(Array.isArray(body.techStack) && {
        techStack: body.techStack.map((s: unknown) => String(s).trim()).filter(Boolean),
      }),
      ...(Array.isArray(body.highlights) && {
        highlights: body.highlights.map((s: unknown) => String(s).trim()).filter(Boolean),
      }),
      ...(typeof body.imageUrl === 'string' && { imageUrl: body.imageUrl.trim() }),
      ...(typeof body.liveUrl === 'string' && { liveUrl: body.liveUrl.trim() }),
      ...(typeof body.repoUrl === 'string' && { repoUrl: body.repoUrl.trim() }),
      ...(typeof body.featured === 'boolean' && { featured: body.featured }),
    });

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, project: updated });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: safeErrorMessage(err, 'Failed to update project') },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrfError = verifySameOrigin(request);
    if (csrfError) {
      return NextResponse.json({ success: false, error: csrfError }, { status: 403 });
    }

    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const deleted = await deleteProject(id);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: safeErrorMessage(err, 'Failed to delete project') },
      { status: 500 }
    );
  }
}
