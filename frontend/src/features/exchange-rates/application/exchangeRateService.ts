import type { ExchangeRateDraft } from '../domain/exchangeRate';
import type { ExchangeRateRepository } from './ExchangeRateRepository';

export function createExchangeRateService(repository: ExchangeRateRepository) {
  return {
    getCurrentRates: () => repository.getCurrentRates(),
    listRates: (offset: number, limit: number) => repository.listRates(offset, limit),
    createRate: (draft: ExchangeRateDraft) => repository.createRate(draft),
  };
}
