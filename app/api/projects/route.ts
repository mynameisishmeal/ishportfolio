import { NextResponse } from 'next/server';
import { addProject, getProjects } from '@/lib/store';
import { isAdminAuthenticated } from '@/lib/auth';
import { isSafeHttpUrl, isSafeImageUrl } from '@/lib/format';
import { safeErrorMessage, verifySameOrigin } from '@/lib/security';
import { ProjectStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

const VALID_STATUSES: ProjectStatus[] = ['in_progress', 'live', 'completed', 'archived'];

export async function GET() {
  try {
    const projects = await getProjects();
    return NextResponse.json({ success: true, projects });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: safeErrorMessage(err, 'Failed to fetch projects') },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const csrfError = verifySameOrigin(request);
    if (csrfError) {
      return NextResponse.json({ success: false, error: csrfError }, { status: 403 });
    }

    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const tagline = typeof body?.tagline === 'string' ? body.tagline.trim() : '';

    if (!title) {
      return NextResponse.json({ success: false, error: 'Project title is required.' }, { status: 400 });
    }

    const liveUrl = typeof body?.liveUrl === 'string' ? body.liveUrl.trim() : '';
    const repoUrl = typeof body?.repoUrl === 'string' ? body.repoUrl.trim() : '';
    const imageUrl = typeof body?.imageUrl === 'string' ? body.imageUrl.trim() : '';

    if ((liveUrl && !isSafeHttpUrl(liveUrl)) || (repoUrl && !isSafeHttpUrl(repoUrl))) {
      return NextResponse.json(
        { success: false, error: 'Live URL and Repo URL must start with http:// or https://' },
        { status: 400 }
      );
    }
    if (imageUrl && !isSafeImageUrl(imageUrl)) {
      return NextResponse.json(
        { success: false, error: 'Image URL must be a valid http(s) URL or local upload path.' },
        { status: 400 }
      );
    }

    const status: ProjectStatus = VALID_STATUSES.includes(body?.status as ProjectStatus)
      ? (body?.status as ProjectStatus)
      : 'in_progress';

    const created = await addProject({
      title,
      tagline: tagline || (typeof body?.description === 'string' ? body.description.slice(0, 120) : ''),
      description: typeof body?.description === 'string' ? body.description.trim() : '',
      status,
      category: typeof body?.category === 'string' && body.category.trim() ? body.category.trim() : 'General',
      techStack: Array.isArray(body?.techStack)
        ? body.techStack.map((s: unknown) => String(s).trim()).filter(Boolean)
        : [],
      highlights: Array.isArray(body?.highlights)
        ? body.highlights.map((s: unknown) => String(s).trim()).filter(Boolean)
        : [],
      imageUrl,
      liveUrl,
      repoUrl,
      featured: Boolean(body?.featured),
    });

    return NextResponse.json({ success: true, project: created });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: safeErrorMessage(err, 'Failed to create project') },
      { status: 500 }
    );
  }
}
