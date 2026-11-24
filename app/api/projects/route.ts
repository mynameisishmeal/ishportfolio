import { NextResponse } from 'next/server';
import { addProject, getProjects } from '@/lib/store';
import { isAdminAuthenticated } from '@/lib/auth';
import { ProjectStatus } from '@/lib/types';

const VALID_STATUSES: ProjectStatus[] = ['in_progress', 'live', 'completed', 'archived'];

export async function GET() {
  try {
    const projects = await getProjects();
    return NextResponse.json({ success: true, projects });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch projects';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const tagline = typeof body?.tagline === 'string' ? body.tagline.trim() : '';

    if (!title) {
      return NextResponse.json({ success: false, error: 'Project title is required.' }, { status: 400 });
    }

    const status: ProjectStatus = VALID_STATUSES.includes(body.status) ? body.status : 'in_progress';

    const created = await addProject({
      title,
      tagline: tagline || (typeof body.description === 'string' ? body.description.slice(0, 120) : ''),
      description: typeof body.description === 'string' ? body.description.trim() : '',
      status,
      category: typeof body.category === 'string' && body.category.trim() ? body.category.trim() : 'General',
      techStack: Array.isArray(body.techStack)
        ? body.techStack.map((s: unknown) => String(s).trim()).filter(Boolean)
        : [],
      highlights: Array.isArray(body.highlights)
        ? body.highlights.map((s: unknown) => String(s).trim()).filter(Boolean)
        : [],
      imageUrl: typeof body.imageUrl === 'string' ? body.imageUrl.trim() : '',
      liveUrl: typeof body.liveUrl === 'string' ? body.liveUrl.trim() : '',
      repoUrl: typeof body.repoUrl === 'string' ? body.repoUrl.trim() : '',
      featured: Boolean(body.featured),
    });

    return NextResponse.json({ success: true, project: created });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create project';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
