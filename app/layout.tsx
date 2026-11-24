import type { Metadata } from 'next';
import './globals.css';
import { StoreProvider } from '@/context/StoreContext';
import CartDrawer from '@/components/CartDrawer';
import OrderReceiptModal from '@/components/OrderReceiptModal';
import PaystackReturnHandler from '@/components/PaystackReturnHandler';
import {
  getBankTransferConfig,
  getPaystackConfig,
  getProducts,
  getProfile,
  getProjects,
} from '@/lib/store';
import {
  DEFAULT_BANK_TRANSFER_CONFIG,
  INITIAL_PRODUCTS,
  INITIAL_PROFILE,
  INITIAL_PROJECTS,
} from '@/lib/data';
import type { ShopPaymentConfig } from '@/context/StoreContext';
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
  let initialPaymentConfig: ShopPaymentConfig = {
    paystackEnabled: false,
    bankTransferEnabled: false,
    bankTransfer: null,
  };

  try {
    const [loadedProfile, loadedProjects, loadedProducts, paystackCfg, bankCfg] =
      await Promise.all([
        getProfile(),
        getProjects(),
        getProducts(),
        getPaystackConfig().catch(() => ({ enabled: false, secretKey: '', publicKey: '' })),
        getBankTransferConfig().catch(() => DEFAULT_BANK_TRANSFER_CONFIG),
      ]);
    profile = loadedProfile;
    projects = loadedProjects;
    products = loadedProducts;
    const bankTransferEnabled = Boolean(
      bankCfg.enabled && bankCfg.bankName && bankCfg.accountName && bankCfg.accountNumber
    );
    initialPaymentConfig = {
      paystackEnabled: Boolean(paystackCfg.enabled && paystackCfg.secretKey),
      bankTransferEnabled,
      bankTransfer: bankTransferEnabled
        ? {
            bankName: bankCfg.bankName,
            accountName: bankCfg.accountName,
            accountNumber: bankCfg.accountNumber,
            instructions: bankCfg.instructions || '',
          }
        : null,
    };
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
          initialPaymentConfig={initialPaymentConfig}
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
