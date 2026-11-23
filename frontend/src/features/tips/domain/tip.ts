import type { CurrencyCode, FinancialRateSource, PaymentMethod } from '../../../shared/domain/financial';

export type TipCurrency = CurrencyCode;
export type TipPaymentMethod = PaymentMethod;
export type TipRateSource = FinancialRateSource;

export interface Tip {
  id: number;
  invoiceId: number | null;
  invoiceNumber: string | null;
  currency: TipCurrency;
  amountReceived: string;
  exchangeRate: string;
  amountUsdEquivalent: string;
  rateSource: TipRateSource;
  paymentMethod: TipPaymentMethod;
  createdAt: string;
}

export interface TipListQuery {
  invoiceId?: number;
  currency?: TipCurrency;
  paymentMethod?: TipPaymentMethod;
  createdFrom?: string;
  createdTo?: string;
  offset: number;
  limit: number;
}

export interface TipPage {
  items: Tip[];
  total: number;
  offset: number;
  limit: number;
}

export interface TipCreateInput {
  invoiceId: number | null;
  currency: TipCurrency;
  amountReceived: string;
  exchangeRate: string;
  amountUsdEquivalent: string;
  rateSource: TipRateSource;
  paymentMethod: TipPaymentMethod;
}
