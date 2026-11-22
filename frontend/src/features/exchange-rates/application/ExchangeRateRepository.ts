import type { ExchangeRate, ExchangeRateDraft, ExchangeRatePage } from '../domain/exchangeRate';

export interface ExchangeRateRepository {
  getCurrentRates(): Promise<ExchangeRate[]>;
  listRates(offset: number, limit: number): Promise<ExchangeRatePage>;
  createRate(draft: ExchangeRateDraft): Promise<ExchangeRate>;
}
