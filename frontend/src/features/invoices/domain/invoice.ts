import type { CurrencyCode, FinancialRateSource, PaymentMethod as SharedPaymentMethod } from '../../../shared/domain/financial';

export interface Invoice {
  id: number;
  invoiceNumber: string;
  status: 'OPEN' | 'PAID' | 'CANCELLED';
  totalAmountUsd: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
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

export interface InvoicePayment {
  id: number;
  invoiceId: number;
  currency: CheckoutCurrency;
  amountApplied: string;
  exchangeRate: string;
  amountUsdEquivalent: string;
  rateSource: FinancialRateSource;
  paymentMethod: PaymentMethod;
  createdAt: string;
}

export interface InvoiceTip {
  id: number;
  invoiceId: number | null;
  currency: CheckoutCurrency;
  amountReceived: string;
  exchangeRate: string;
  amountUsdEquivalent: string;
  rateSource: FinancialRateSource;
  paymentMethod: PaymentMethod;
  createdAt: string;
}

export interface InvoiceListQuery {
  status?: Invoice['status'];
  invoiceNumber?: string;
  createdFrom?: string;
  createdTo?: string;
  offset: number;
  limit: number;
}

export interface InvoicePage {
  items: Invoice[];
  total: number;
  offset: number;
  limit: number;
}

export type CheckoutCurrency = CurrencyCode;
export type PaymentMethod = SharedPaymentMethod;

export interface PaymentDraft {
  key: number;
  currency: CheckoutCurrency;
  paymentMethod: PaymentMethod;
  amountApplied: string;
}

export interface CheckoutPaymentInput {
  currency: CheckoutCurrency;
  amount_applied: string;
  exchange_rate: string;
  amount_usd_equivalent: string;
  rate_source: 'MANUAL' | 'CENTRAL_BANK' | 'BASE';
  payment_method: PaymentMethod;
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

export function decimalToMinor(value: string, scale = 2, maxDigits = 12): bigint | null {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match || (match[2]?.length ?? 0) > scale) return null;
  const significantWholeDigits = match[1].replace(/^0+/, '').length || 1;
  if (significantWholeDigits + (match[2]?.length ?? 0) > maxDigits) return null;
  const fraction = (match[2] ?? '').padEnd(scale, '0');
  return BigInt(match[1]) * (10n ** BigInt(scale)) + BigInt(fraction || '0');
}

/** Convert an amount in foreign units to USD cents, rounding half up like backend Decimal.quantize. */
export function paymentUsdCents(amountApplied: string, currencyUnitsPerUsd: string): bigint | null {
  const amountCents = decimalToMinor(amountApplied, 2);
  const rateMicros = decimalToMinor(currencyUnitsPerUsd, 6, 18);
  if (amountCents === null || rateMicros === null || amountCents <= 0n || rateMicros <= 0n) return null;
  const numerator = amountCents * 1_000_000n;
  const quotient = numerator / rateMicros;
  const remainder = numerator % rateMicros;
  return quotient + (remainder * 2n >= rateMicros ? 1n : 0n);
}

export function formatMinor(value: bigint, currency: CheckoutCurrency = 'USD'): string {
  const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : 'EGP ';
  const major = (value / 100n).toLocaleString('en-US');
  return `${symbol}${major}.${String(value % 100n).padStart(2, '0')}`;
}

export interface PaymentQuote {
  drafts: PaymentDraft[];
  equivalents: Array<bigint | null>;
  totalEquivalentCents: bigint;
  remainingCents: bigint;
  valid: boolean;
  error: string | null;
}

export function quotePayments(
  invoiceTotalUsd: string,
  drafts: PaymentDraft[],
  rates: Partial<Record<'EUR' | 'EGP', { rateToUsd: string; source: string }>>,
): PaymentQuote {
  const invoiceCents = decimalToMinor(invoiceTotalUsd, 2);
  if (invoiceCents === null) return { drafts, equivalents: [], totalEquivalentCents: 0n, remainingCents: 0n, valid: false, error: 'The invoice total has an invalid amount.' };
  if (drafts.length === 0) return { drafts, equivalents: [], totalEquivalentCents: 0n, remainingCents: invoiceCents, valid: false, error: 'Add at least one payment entry.' };

  const equivalents = drafts.map((draft) => {
    const rate = draft.currency === 'USD' ? '1.000000' : rates[draft.currency]?.rateToUsd;
    return rate ? paymentUsdCents(draft.amountApplied, rate) : null;
  });
  if (equivalents.some((value) => value === null)) {
    return { drafts, equivalents, totalEquivalentCents: 0n, remainingCents: invoiceCents, valid: false, error: 'Enter a positive amount with no more than two decimal places, and ensure a current rate is available.' };
  }
  const exact = equivalents as bigint[];
  if (exact.some((value) => value <= 0n)) {
    return { drafts, equivalents, totalEquivalentCents: exact.reduce((sum, value) => sum + value, 0n), remainingCents: invoiceCents, valid: false, error: 'Each payment must convert to at least $0.01 USD.' };
  }
  const totalEquivalentCents = exact.reduce((sum, value) => sum + value, 0n);
  const priorCents = exact.slice(0, -1).reduce((sum, value) => sum + value, 0n);
  const remainingCents = invoiceCents - totalEquivalentCents;
  if (exact.length === 1) {
    const valid = totalEquivalentCents === invoiceCents;
    return { drafts, equivalents, totalEquivalentCents, remainingCents, valid, error: valid ? null : totalEquivalentCents < invoiceCents ? 'Payment entries must cover the invoice total.' : 'Payment entries exceed the invoice total.' };
  }
  const lastRemainder = invoiceCents - priorCents;
  const difference = exact[exact.length - 1] - lastRemainder;
  const valid = priorCents < invoiceCents && difference >= -1n && difference <= 1n;
  return {
    drafts, equivalents, totalEquivalentCents, remainingCents, valid,
    error: valid ? null : priorCents >= invoiceCents || totalEquivalentCents > invoiceCents + 1n
      ? 'Payment entries exceed the invoice total.'
      : 'Payment entries must cover the invoice total. The final payment may differ by at most $0.01 due to currency rounding.',
  };
}

export function buildCheckoutPayments(
  drafts: PaymentDraft[],
  rates: Partial<Record<'EUR' | 'EGP', { rateToUsd: string; source: string }>>,
): CheckoutPaymentInput[] {
  return drafts.map((draft) => {
    const rate = draft.currency === 'USD' ? '1.000000' : rates[draft.currency]!.rateToUsd;
    const equivalent = paymentUsdCents(draft.amountApplied, rate)!;
    const appliedCents = decimalToMinor(draft.amountApplied, 2)!;
    return {
      currency: draft.currency,
      amount_applied: `${appliedCents / 100n}.${String(appliedCents % 100n).padStart(2, '0')}`,
      exchange_rate: rate,
      amount_usd_equivalent: `${equivalent / 100n}.${String(equivalent % 100n).padStart(2, '0')}`,
      rate_source: draft.currency === 'USD' ? 'BASE' : rates[draft.currency]!.source as 'MANUAL' | 'CENTRAL_BANK',
      payment_method: draft.paymentMethod,
    };
  });
}
