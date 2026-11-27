import { NextResponse } from 'next/server';
import { deleteProduct, getProductById, updateProduct } from '@/lib/store';
import { isAdminAuthenticated } from '@/lib/auth';
import { isSafeImageUrl } from '@/lib/format';
import { safeErrorMessage, verifySameOrigin } from '@/lib/security';
import { ProductType } from '@/lib/types';

export const dynamic = 'force-dynamic';

const VALID_TYPES: ProductType[] = ['digital', 'service', 'physical'];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const product = await getProductById(id);
    if (!product || (product.active === false && !(await isAdminAuthenticated()))) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, product });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: safeErrorMessage(err, 'Failed to fetch product') },
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

    if (body.type !== undefined && !VALID_TYPES.includes(body.type as ProductType)) {
      return NextResponse.json({ success: false, error: 'Invalid product type.' }, { status: 400 });
    }
    if (typeof body.imageUrl === 'string' && body.imageUrl.trim() && !isSafeImageUrl(body.imageUrl)) {
      return NextResponse.json(
        { success: false, error: 'Image URL must be a valid http(s) URL or local upload path.' },
        { status: 400 }
      );
    }

    const updated = await updateProduct(id, {
      ...(typeof body.title === 'string' && { title: body.title.trim() }),
      ...(typeof body.category === 'string' && { category: body.category.trim() || 'General' }),
      ...(body.type !== undefined && { type: body.type as ProductType }),
      ...(body.price !== undefined &&
        Number.isFinite(Number(body.price)) && { price: Math.max(0, Number(body.price)) }),
      ...(typeof body.badge === 'string' && { badge: body.badge.trim() }),
      ...(typeof body.description === 'string' && { description: body.description.trim() }),
      ...(Array.isArray(body.features) && {
        features: body.features.map((f: unknown) => String(f).trim()).filter(Boolean),
      }),
      ...(typeof body.imageUrl === 'string' && { imageUrl: body.imageUrl.trim() }),
      ...(body.stock !== undefined &&
        Number.isFinite(Number(body.stock)) && { stock: Math.floor(Number(body.stock)) }),
      ...(typeof body.featured === 'boolean' && { featured: body.featured }),
      ...(typeof body.active === 'boolean' && { active: body.active }),
    });

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, product: updated });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: safeErrorMessage(err, 'Failed to update product') },
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
    const deleted = await deleteProduct(id);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: safeErrorMessage(err, 'Failed to delete product') },
      { status: 500 }
    );
  }
}
