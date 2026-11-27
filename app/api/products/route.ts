import { NextResponse } from 'next/server';
import { addProduct, getProducts } from '@/lib/store';
import { isAdminAuthenticated } from '@/lib/auth';
import { isSafeImageUrl } from '@/lib/format';
import { safeErrorMessage, verifySameOrigin } from '@/lib/security';
import { ProductType } from '@/lib/types';

export const dynamic = 'force-dynamic';

const VALID_TYPES: ProductType[] = ['digital', 'service', 'physical'];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const wantsAll = searchParams.get('all') === '1';
    const includeInactive = wantsAll && (await isAdminAuthenticated());
    const products = await getProducts(includeInactive);
    return NextResponse.json({ success: true, products });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: safeErrorMessage(err, 'Failed to fetch products') },
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
    const category = typeof body?.category === 'string' ? body.category.trim() : '';
    const price = Number(body?.price);

    if (!title || !category || !Number.isFinite(price) || price < 0) {
      return NextResponse.json(
        { success: false, error: 'Valid title, category, and non-negative price are required.' },
        { status: 400 }
      );
    }

    const imageUrl = typeof body?.imageUrl === 'string' ? body.imageUrl.trim() : '';
    if (imageUrl && !isSafeImageUrl(imageUrl)) {
      return NextResponse.json(
        { success: false, error: 'Image URL must be a valid http(s) URL or local upload path.' },
        { status: 400 }
      );
    }

    const type: ProductType = VALID_TYPES.includes(body?.type as ProductType)
      ? (body?.type as ProductType)
      : 'digital';
    const rawStock = body?.stock !== undefined ? Number(body.stock) : -1;

    const created = await addProduct({
      title,
      category,
      type,
      price,
      badge: typeof body?.badge === 'string' ? body.badge.trim() : '',
      description: typeof body?.description === 'string' ? body.description.trim() : '',
      features: Array.isArray(body?.features)
        ? body.features.map((f: unknown) => String(f).trim()).filter(Boolean)
        : [],
      imageUrl,
      stock: Number.isFinite(rawStock) ? Math.floor(rawStock) : -1,
      featured: Boolean(body?.featured),
      active: body?.active !== false,
    });

    return NextResponse.json({ success: true, product: created });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: safeErrorMessage(err, 'Failed to create product') },
      { status: 500 }
    );
  }
}
