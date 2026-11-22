export interface Invoice {
  id: number;
  invoiceNumber: string;
  status: 'OPEN' | 'PAID' | 'CANCELLED';
  totalAmountUsd: string;
  createdAt: string;
}

export interface InvoiceItem {
  id: number;
  invoiceId: number;
  productId: number | null;
  productNameSnapshot: string;
  categoryNameSnapshot: string;
  unitPriceUsd: string;
  quantity: number;
  lineTotalUsd: string;
}

export interface InvoiceDetail extends Invoice {
  items: InvoiceItem[];
}

/** Formats API Decimal strings without converting financial values to floating point. */
export function formatUsd(value: string): string {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return `$${value}`;
  const dollars = BigInt(match[1]).toLocaleString('en-US');
  const cents = (match[2] ?? '').padEnd(2, '0');
  return `$${dollars}.${cents}`;
}

export function previewUsd(unitPriceUsd: string, quantity: number): string {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(unitPriceUsd);
  if (!match) return formatUsd(unitPriceUsd);
  const cents = BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0') || '0');
  const total = cents * BigInt(quantity);
  return formatUsd(`${total / 100n}.${String(total % 100n).padStart(2, '0')}`);
}
