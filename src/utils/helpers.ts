export function normalizeUrl(url: string): string {
  if (!url) return "";
  let normalized = url.trim().toLowerCase();
  
  // Remove protocol
  normalized = normalized.replace(/^(https?:\/\/)/, "");
  
  // Remove www.
  normalized = normalized.replace(/^www\./, "");
  
  // Remove trailing slash
  normalized = normalized.replace(/\/$/, "");
  
  return normalized;
}

export const DEFAULT_CURRENCY_RATES = {
  USD: 1,
  PKR: 280,
  GBP: 0.79,
} as const;

export type Currency = keyof typeof DEFAULT_CURRENCY_RATES;

export function formatCurrency(value: number, currency: Currency, rates: Record<Currency, number> = DEFAULT_CURRENCY_RATES): string {
  const rate = rates[currency];
  const converted = value * rate;
  
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  
  return formatter.format(converted);
}

export function parseNumeric(value: any): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'number') return isNaN(value) ? undefined : value;
  
  // Extract numbers and decimals
  const match = String(value).match(/[\d.]+/);
  if (!match) return undefined;
  
  const num = Number(match[0]);
  return isNaN(num) ? undefined : num;
}
