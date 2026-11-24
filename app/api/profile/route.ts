import { NextResponse } from 'next/server';
import { getProfile, updateProfile } from '@/lib/store';
import { isAdminAuthenticated } from '@/lib/auth';
import { normalizeFontScale } from '@/lib/format';

export async function GET() {
  try {
    const profile = await getProfile();
    return NextResponse.json({ success: true, profile });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch profile';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const updated = await updateProfile({
      ...(typeof body.name === 'string' && { name: body.name.trim() }),
      ...(typeof body.brandTitle === 'string' && { brandTitle: body.brandTitle.trim() }),
      ...(typeof body.role === 'string' && { role: body.role.trim() }),
      ...(typeof body.headline === 'string' && { headline: body.headline.trim() }),
      ...(typeof body.bio === 'string' && { bio: body.bio.trim() }),
      ...(typeof body.aboutText === 'string' && { aboutText: body.aboutText.trim() }),
      ...(typeof body.location === 'string' && { location: body.location.trim() }),
      ...(typeof body.availability === 'string' && { availability: body.availability.trim() }),
      ...(typeof body.email === 'string' && { email: body.email.trim() }),
      ...(typeof body.githubUrl === 'string' && { githubUrl: body.githubUrl.trim() }),
      ...(typeof body.xUrl === 'string' && { xUrl: body.xUrl.trim() }),
      ...(typeof body.linkedinUrl === 'string' && { linkedinUrl: body.linkedinUrl.trim() }),
      ...(typeof body.telegramHandle === 'string' && { telegramHandle: body.telegramHandle.trim() }),
      ...(typeof body.announcement === 'string' && { announcement: body.announcement.trim() }),
      ...(typeof body.currencyCode === 'string' && { currencyCode: body.currencyCode.trim().toUpperCase() || 'USD' }),
      ...(typeof body.currencySymbol === 'string' && { currencySymbol: body.currencySymbol.trim() || '$' }),
      ...(typeof body.fontScale === 'string' && { fontScale: normalizeFontScale(body.fontScale) }),
      ...(Array.isArray(body.skills) && {
        skills: body.skills.map((s: unknown) => String(s).trim()).filter(Boolean),
      }),
    });

    return NextResponse.json({ success: true, profile: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update profile';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
