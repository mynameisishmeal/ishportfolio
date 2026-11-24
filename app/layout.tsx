import type { Metadata } from 'next';
import './globals.css';
import { StoreProvider } from '@/context/StoreContext';
import CartDrawer from '@/components/CartDrawer';
import OrderReceiptModal from '@/components/OrderReceiptModal';
import PaystackReturnHandler from '@/components/PaystackReturnHandler';
import { getProducts, getProfile, getProjects } from '@/lib/store';
import { INITIAL_PRODUCTS, INITIAL_PROFILE, INITIAL_PROJECTS } from '@/lib/data';
import { getFontScalePx } from '@/lib/format';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  try {
    const profile = await getProfile();
    return {
      title: `${profile.brandTitle || profile.name} — Portfolio & Shop`,
      description: profile.bio,
      icons: {
        icon: '/icon.svg',
      },
    };
  } catch {
    return {
      title: `${INITIAL_PROFILE.brandTitle} — Portfolio & Shop`,
      description: INITIAL_PROFILE.bio,
      icons: {
        icon: '/icon.svg',
      },
    };
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let profile = INITIAL_PROFILE;
  let projects = INITIAL_PROJECTS;
  let products = INITIAL_PRODUCTS;

  try {
    [profile, projects, products] = await Promise.all([
      getProfile(),
      getProjects(),
      getProducts(),
    ]);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn('MongoDB unavailable during SSR, using fallback defaults:', reason);
  }

  const rootFontPx = getFontScalePx(profile.fontScale);

  return (
    <html lang="en" style={{ fontSize: `${rootFontPx}px` }}>
      <body>
        <StoreProvider
          initialProfile={profile}
          initialProjects={projects}
          initialProducts={products}
        >
          {children}
          <CartDrawer />
          <OrderReceiptModal />
          <PaystackReturnHandler />
        </StoreProvider>
      </body>
    </html>
  );
}
