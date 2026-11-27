import { FontScale, ProjectStatus, ProductType } from './types';

export function formatPrice(amount: number, symbol = '$', code = 'USD'): string {
  if (amount <= 0) return 'Free';
  const prefix = symbol || (code ? `${code} ` : '$');
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${prefix}${formatted}`;
}

export const PROJECT_STATUS_META: Record<
  ProjectStatus,
  { label: string; dotColor: string; bg: string; border: string; text: string }
> = {
  in_progress: {
    label: 'In Progress',
    dotColor: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.12)',
    border: 'rgba(245, 158, 11, 0.28)',
    text: '#fbbf24',
  },
  live: {
    label: 'Live',
    dotColor: '#10b981',
    bg: 'rgba(16, 185, 129, 0.12)',
    border: 'rgba(16, 185, 129, 0.28)',
    text: '#34d399',
  },
  completed: {
    label: 'Completed',
    dotColor: '#60a5fa',
    bg: 'rgba(96, 165, 250, 0.12)',
    border: 'rgba(96, 165, 250, 0.28)',
    text: '#93c5fd',
  },
  archived: {
    label: 'Archived',
    dotColor: '#71717a',
    bg: 'rgba(113, 113, 122, 0.15)',
    border: 'rgba(113, 113, 122, 0.3)',
    text: '#a1a1aa',
  },
};

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  digital: 'Digital Product',
  service: 'Service',
  physical: 'Physical Item',
};

export const FONT_SCALE_OPTIONS: {
  id: FontScale;
  label: string;
  shortLabel: string;
  px: number;
}[] = [
  { id: 'small', label: 'Small (12px)', shortLabel: 'S', px: 12 },
  { id: 'medium', label: 'Medium (14px)', shortLabel: 'M', px: 14 },
  { id: 'large', label: 'Large (16px)', shortLabel: 'L', px: 16 },
];

export function normalizeFontScale(value?: string | null): FontScale {
  if (value === 'medium' || value === 'large' || value === 'small') return value;
  return 'small';
}

export function getFontScalePx(value?: string | null): number {
  const scale = normalizeFontScale(value);
  return FONT_SCALE_OPTIONS.find(opt => opt.id === scale)?.px ?? 12;
}

const NARRATION_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateNarrationCode(prefix: 'HBT' | 'OBT' = 'HBT'): string {
  let suffix = '';
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(6);
    globalThis.crypto.getRandomValues(bytes);
    for (let i = 0; i < 6; i += 1) {
      suffix += NARRATION_ALPHABET[bytes[i] % NARRATION_ALPHABET.length];
    }
  } else {
    for (let i = 0; i < 6; i += 1) {
      suffix += NARRATION_ALPHABET[Math.floor(Math.random() * NARRATION_ALPHABET.length)];
    }
  }
  return `${prefix}-${suffix}`;
}

export function isSafeHttpUrl(raw?: string | null): boolean {
  if (!raw || typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function toSafeHttpUrl(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return isSafeHttpUrl(trimmed) ? trimmed : null;
}

export function isSafeImageUrl(raw?: string | null): boolean {
  if (!raw || typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return true;
  }
  return isSafeHttpUrl(trimmed);
}
