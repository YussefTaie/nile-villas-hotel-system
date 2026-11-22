import { request } from '../../../shared/api/apiClient';
import type { ExchangeRate, ExchangeRateDraft, ExchangeRatePage } from '../domain/exchangeRate';
import type { ExchangeRateRepository } from '../application/ExchangeRateRepository';

interface ExchangeRateResponse {
  id: number;
  currency: 'EUR' | 'EGP';
  rate_to_usd: string;
  source: 'MANUAL' | 'CENTRAL_BANK';
  is_current: boolean;
  effective_from: string;
  effective_to: string | null;
  created_at: string;
}

interface ExchangeRatePageResponse {
  items: ExchangeRateResponse[];
  total: number;
  offset: number;
  limit: number;
}

function mapRate(rate: ExchangeRateResponse): ExchangeRate {
  return {
    id: rate.id,
    currency: rate.currency,
    rateToUsd: rate.rate_to_usd,
    source: rate.source,
    isCurrent: rate.is_current,
    effectiveFrom: rate.effective_from,
    effectiveTo: rate.effective_to,
    createdAt: rate.created_at,
  };
}

function mapDraft(draft: ExchangeRateDraft) {
  return {
    currency: draft.currency,
    rate_to_usd: draft.rateToUsd,
    source: draft.source,
    effective_from: draft.effectiveFrom,
  };
}

export const exchangeRateApi: ExchangeRateRepository = {
  async getCurrentRates() {
    const rates = await request<ExchangeRateResponse[]>('/exchange-rates/current');
    return rates.map(mapRate);
  },
  async listRates(offset, limit) {
    const page = await request<ExchangeRatePageResponse>(`/exchange-rates?offset=${offset}&limit=${limit}`);
    return { ...page, items: page.items.map(mapRate) } satisfies ExchangeRatePage;
  },
  async createRate(draft) {
    const rate = await request<ExchangeRateResponse>('/exchange-rates', {
      method: 'POST',
      body: JSON.stringify(mapDraft(draft)),
    });
    return mapRate(rate);
  },
};
