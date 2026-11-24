import { NextResponse } from 'next/server';
import { deleteProduct, getProductById, updateProduct } from '@/lib/store';
import { isAdminAuthenticated } from '@/lib/auth';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const product = await getProductById(id);
    if (!product) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, product });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch product';
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

    const updated = await updateProduct(id, {
      ...(typeof body.title === 'string' && { title: body.title.trim() }),
      ...(typeof body.category === 'string' && { category: body.category.trim() || 'General' }),
      ...(body.type && { type: body.type }),
      ...(body.price !== undefined && !Number.isNaN(Number(body.price)) && { price: Math.max(0, Number(body.price)) }),
      ...(typeof body.badge === 'string' && { badge: body.badge.trim() }),
      ...(typeof body.description === 'string' && { description: body.description.trim() }),
      ...(Array.isArray(body.features) && {
        features: body.features.map((f: unknown) => String(f).trim()).filter(Boolean),
      }),
      ...(typeof body.imageUrl === 'string' && { imageUrl: body.imageUrl.trim() }),
      ...(body.stock !== undefined && !Number.isNaN(Number(body.stock)) && { stock: Number(body.stock) }),
      ...(typeof body.featured === 'boolean' && { featured: body.featured }),
      ...(typeof body.active === 'boolean' && { active: body.active }),
    });

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, product: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update product';
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
    const deleted = await deleteProduct(id);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete product';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
