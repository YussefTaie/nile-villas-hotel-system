export type Currency = 'EUR' | 'EGP';
export type ExchangeRateSource = 'MANUAL' | 'CENTRAL_BANK';

export interface ExchangeRate {
  id: number;
  currency: Currency;
  rateToUsd: string;
  source: ExchangeRateSource;
  isCurrent: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
}

export interface ExchangeRatePage {
  items: ExchangeRate[];
  total: number;
  offset: number;
  limit: number;
}

export interface ExchangeRateDraft {
  currency: Currency;
  rateToUsd: string;
  source: ExchangeRateSource;
  effectiveFrom: string;
}
