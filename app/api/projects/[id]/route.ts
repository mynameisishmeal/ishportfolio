import { NextResponse } from 'next/server';
import { deleteProject, getProjectById, updateProject } from '@/lib/store';
import { isAdminAuthenticated } from '@/lib/auth';

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
    const message = err instanceof Error ? err.message : 'Failed to fetch project';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const updated = await updateProject(id, {
      ...(typeof body.title === 'string' && { title: body.title.trim() }),
      ...(typeof body.tagline === 'string' && { tagline: body.tagline.trim() }),
      ...(typeof body.description === 'string' && { description: body.description.trim() }),
      ...(body.status && { status: body.status }),
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
    const message = err instanceof Error ? err.message : 'Failed to update project';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
    const message = err instanceof Error ? err.message : 'Failed to delete project';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
