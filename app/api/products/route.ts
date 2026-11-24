import { NextResponse } from 'next/server';
import { addProduct, getProducts } from '@/lib/store';
import { isAdminAuthenticated } from '@/lib/auth';
import { ProductType } from '@/lib/types';

const VALID_TYPES: ProductType[] = ['digital', 'service', 'physical'];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const wantsAll = searchParams.get('all') === '1';
    const includeInactive = wantsAll && (await isAdminAuthenticated());
    const products = await getProducts(includeInactive);
    return NextResponse.json({ success: true, products });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch products';
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
    const category = typeof body?.category === 'string' ? body.category.trim() : '';
    const price = Number(body?.price);

    if (!title || !category || Number.isNaN(price) || price < 0) {
      return NextResponse.json(
        { success: false, error: 'Valid title, category, and non-negative price are required.' },
        { status: 400 }
      );
    }

    const type: ProductType = VALID_TYPES.includes(body.type) ? body.type : 'digital';
    const rawStock = body.stock !== undefined ? Number(body.stock) : -1;

    const created = await addProduct({
      title,
      category,
      type,
      price,
      badge: typeof body.badge === 'string' ? body.badge.trim() : '',
      description: typeof body.description === 'string' ? body.description.trim() : '',
      features: Array.isArray(body.features)
        ? body.features.map((f: unknown) => String(f).trim()).filter(Boolean)
        : [],
      imageUrl: typeof body.imageUrl === 'string' ? body.imageUrl.trim() : '',
      stock: Number.isNaN(rawStock) ? -1 : rawStock,
      featured: Boolean(body.featured),
      active: body.active !== false,
    });

    return NextResponse.json({ success: true, product: created });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create product';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
