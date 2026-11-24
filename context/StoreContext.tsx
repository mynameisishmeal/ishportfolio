'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  CartItem,
  FontScale,
  Order,
  Product,
  ProjectItem,
  PublicHostUser,
  SiteProfile,
} from '@/lib/types';
import { INITIAL_PRODUCTS, INITIAL_PROFILE, INITIAL_PROJECTS } from '@/lib/data';
import { getFontScalePx, normalizeFontScale } from '@/lib/format';
import {
  HOST_CACHE_KEY,
  hostAuthHeaders,
  writeStoredHostToken,
} from '@/lib/host-client';

export interface BankTransferPublicInfo {
  bankName: string;
  accountName: string;
  accountNumber: string;
  instructions?: string;
}

export interface ShopPaymentConfig {
  paystackEnabled: boolean;
  bankTransferEnabled: boolean;
  bankTransfer: BankTransferPublicInfo | null;
}

interface StoreContextValue {
  profile: SiteProfile;
  projects: ProjectItem[];
  products: Product[];
  isLoading: boolean;
  refreshProfile: () => Promise<void>;
  refreshProjects: () => Promise<void>;
  refreshProducts: () => Promise<void>;
  refreshAll: () => Promise<void>;

  cart: CartItem[];
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;

  completedOrder: Order | null;
  setCompletedOrder: (order: Order | null) => void;

  accountUser: PublicHostUser | null;
  shopOrders: Order[];
  paymentConfig: ShopPaymentConfig;
  accountLoading: boolean;
  newlyCreatedKey: string | null;
  clearNewlyCreatedKey: () => void;
  refreshAccount: () => Promise<void>;
  applyAuthSession: (input: {
    user?: PublicHostUser | null;
    sessionToken?: string;
    accessKey?: string;
  }) => Promise<void>;
  signOutAccount: () => Promise<void>;

  currentPage: number;
  pageDirection: 1 | -1;
  goToPage: (index: number, directionOverride?: 1 | -1) => void;

  fontScale: FontScale;
  setFontScale: (scale: FontScale) => void;
  resetFontScale: () => void;
}

const StoreContext = createContext<StoreContextValue | undefined>(undefined);
const CART_STORAGE_KEY =
  process.env.NEXT_PUBLIC_CART_STORAGE_KEY || 'ish_portfolio_cart_v1';
const FONT_STORAGE_KEY = 'ish_font_scale_v1';

const DEFAULT_PAYMENT_CFG: ShopPaymentConfig = {
  paystackEnabled: false,
  bankTransferEnabled: false,
  bankTransfer: null,
};

interface StoreProviderProps {
  children: React.ReactNode;
  initialProfile?: SiteProfile;
  initialProjects?: ProjectItem[];
  initialProducts?: Product[];
  initialPaymentConfig?: ShopPaymentConfig;
}

export function StoreProvider({
  children,
  initialProfile,
  initialProjects,
  initialProducts,
  initialPaymentConfig,
}: StoreProviderProps) {
  const [profile, setProfile] = useState<SiteProfile>(initialProfile || INITIAL_PROFILE);
  const [projects, setProjects] = useState<ProjectItem[]>(initialProjects || INITIAL_PROJECTS);
  const [products, setProducts] = useState<Product[]>(initialProducts || INITIAL_PRODUCTS);
  const [isLoading, setIsLoading] = useState(false);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartHydrated, setCartHydrated] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);

  const [accountUser, setAccountUser] = useState<PublicHostUser | null>(null);
  const [shopOrders, setShopOrders] = useState<Order[]>([]);
  const [paymentConfig, setPaymentConfig] = useState<ShopPaymentConfig>(
    initialPaymentConfig || DEFAULT_PAYMENT_CFG
  );
  const [accountLoading, setAccountLoading] = useState(true);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);

  const [userFontScale, setUserFontScale] = useState<FontScale | null>(null);
  const [pageState, setPageState] = useState<{ index: number; direction: 1 | -1 }>({
    index: 0,
    direction: 1,
  });

  // Sync initial URL hash (e.g. /#shop, /#host, /#contact) and listen for hash changes
  useEffect(() => {
    const hashMap: Record<string, number> = {
      '#home': 0,
      '#projects': 1,
      '#shop': 2,
      '#host': 3,
      '#about': 4,
      '#contact': 5,
    };
    const applyHash = () => {
      const idx = hashMap[window.location.hash];
      if (typeof idx === 'number') {
        setPageState(prev => {
          if (idx === prev.index) return prev;
          return { index: idx, direction: idx > prev.index ? 1 : -1 };
        });
      }
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, []);

  const goToPage = useCallback((nextIndex: number, directionOverride?: 1 | -1) => {
    const totalPages = 6;
    const wrapped = ((nextIndex % totalPages) + totalPages) % totalPages;
    setPageState(prev => {
      if (wrapped === prev.index) return prev;
      return {
        index: wrapped,
        direction: directionOverride ?? (wrapped > prev.index ? 1 : -1),
      };
    });
  }, []);

  const currentPage = pageState.index;
  const pageDirection = pageState.direction;

  // Hydrate visitor font scale override and apply active global font size (12px / 14px / 16px)
  useEffect(() => {
    try {
      const savedScale = localStorage.getItem(FONT_STORAGE_KEY);
      if (savedScale === 'small' || savedScale === 'medium' || savedScale === 'large') {
        setUserFontScale(savedScale);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const fontScale: FontScale = userFontScale ?? normalizeFontScale(profile.fontScale);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.style.fontSize = `${getFontScalePx(fontScale)}px`;
    }
  }, [fontScale]);

  const setFontScale = useCallback((scale: FontScale) => {
    const clean = normalizeFontScale(scale);
    setUserFontScale(clean);
    try {
      localStorage.setItem(FONT_STORAGE_KEY, clean);
    } catch {
      // ignore storage errors
    }
  }, []);

  const resetFontScale = useCallback(() => {
    setUserFontScale(null);
    try {
      localStorage.removeItem(FONT_STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
  }, []);

  // Hydrate cart from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setCart(parsed);
        }
      }
    } catch {
      // ignore storage errors
    } finally {
      setCartHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!cartHydrated) return;
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // ignore storage errors
    }
  }, [cart, cartHydrated]);

  const refreshAccount = useCallback(async () => {
    try {
      const res = await fetch('/api/shop/session', {
        cache: 'no-store',
        headers: hostAuthHeaders(),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        const nextUser: PublicHostUser | null = data.user ?? null;
        setAccountUser(nextUser);
        setShopOrders(Array.isArray(data.orders) ? data.orders : []);
        if (data.payment) {
          setPaymentConfig({
            paystackEnabled: Boolean(data.payment.paystackEnabled),
            bankTransferEnabled: Boolean(data.payment.bankTransferEnabled),
            bankTransfer: data.payment.bankTransfer ?? null,
          });
        }
        if (!nextUser) {
          writeStoredHostToken(null);
        }
      }
    } catch {
      // Ignore transient network failures
    } finally {
      setAccountLoading(false);
    }
  }, []);

  // Hydrate cached account user on mount, then verify persistent key session with server
  useEffect(() => {
    try {
      const raw = localStorage.getItem(HOST_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { user?: PublicHostUser };
        if (parsed.user?.id) {
          setAccountUser(parsed.user);
        }
      }
    } catch {
      // Ignore cache error
    }
    void refreshAccount();
  }, [refreshAccount]);

  const clearNewlyCreatedKey = useCallback(() => {
    setNewlyCreatedKey(null);
  }, []);

  const applyAuthSession = useCallback(
    async (input: {
      user?: PublicHostUser | null;
      sessionToken?: string;
      accessKey?: string;
    }) => {
      if (input.sessionToken) {
        writeStoredHostToken(input.sessionToken);
      }
      if (input.user) {
        setAccountUser(input.user);
      }
      if (input.accessKey) {
        setNewlyCreatedKey(input.accessKey);
      }
      await refreshAccount();
    },
    [refreshAccount]
  );

  const signOutAccount = useCallback(async () => {
    try {
      await fetch('/api/host/auth/logout', {
        method: 'POST',
        headers: hostAuthHeaders(),
      });
    } catch {
      // Ignore network error during sign-out
    }
    writeStoredHostToken(null);
    try {
      localStorage.removeItem(HOST_CACHE_KEY);
    } catch {
      // Ignore storage error
    }
    setAccountUser(null);
    setShopOrders([]);
    setNewlyCreatedKey(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/profile', { cache: 'no-store' });
      const data = await res.json();
      if (data.success && data.profile) {
        setProfile(data.profile);
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    }
  }, []);

  const refreshProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects', { cache: 'no-store' });
      const data = await res.json();
      if (data.success && Array.isArray(data.projects)) {
        setProjects(data.projects);
      }
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    }
  }, []);

  const refreshProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/products', { cache: 'no-store' });
      const data = await res.json();
      if (data.success && Array.isArray(data.products)) {
        setProducts(data.products);
      }
    } catch (err) {
      console.error('Failed to fetch products:', err);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([refreshProfile(), refreshProjects(), refreshProducts()]);
    setIsLoading(false);
  }, [refreshProfile, refreshProjects, refreshProducts]);

  useEffect(() => {
    if (!initialProfile || !initialProjects || !initialProducts) {
      refreshAll();
    }
  }, [initialProfile, initialProjects, initialProducts, refreshAll]);

  const addToCart = (product: Product) => {
    if (product.stock === 0) return;
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        const nextQty = existing.quantity + 1;
        if (product.stock >= 0 && nextQty > product.stock) return prev;
        return prev.map(item =>
          item.product.id === product.id ? { ...item, quantity: nextQty } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev =>
      prev.map(item => {
        if (item.product.id !== productId) return item;
        const capped =
          item.product.stock >= 0 ? Math.min(quantity, item.product.stock) : quantity;
        return { ...item, quantity: capped };
      })
    );
  };

  const clearCart = () => {
    setCart([]);
  };

  return (
    <StoreContext.Provider
      value={{
        profile,
        projects,
        products,
        isLoading,
        refreshProfile,
        refreshProjects,
        refreshProducts,
        refreshAll,
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        isCartOpen,
        setIsCartOpen,
        completedOrder,
        setCompletedOrder,
        accountUser,
        shopOrders,
        paymentConfig,
        accountLoading,
        newlyCreatedKey,
        clearNewlyCreatedKey,
        refreshAccount,
        applyAuthSession,
        signOutAccount,
        currentPage,
        pageDirection,
        goToPage,
        fontScale,
        setFontScale,
        resetFontScale,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error('useStore must be used inside a StoreProvider');
  }
  return ctx;
}
