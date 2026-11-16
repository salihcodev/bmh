import { i18n } from '@/localization';

function locale(): string {
  return i18n.language === 'ar' ? 'ar-EG' : 'en-US';
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(locale()).format(value);
}

export function formatDate(value: Date | null | undefined): string {
  if (!value) return '';
  return new Intl.DateTimeFormat(locale(), { year: 'numeric', month: 'short', day: 'numeric' }).format(value);
}

export function formatDateTime(value: Date | null | undefined): string {
  if (!value) return '';
  return new Intl.DateTimeFormat(locale(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}
