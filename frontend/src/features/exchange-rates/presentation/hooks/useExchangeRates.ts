import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../../../shared/api/ApiError';
import { exchangeRateApi } from '../../infrastructure/exchangeRateApi';
import { createExchangeRateService } from '../../application/exchangeRateService';
import type { ExchangeRate, ExchangeRateDraft, ExchangeRatePage } from '../../domain/exchangeRate';

const service = createExchangeRateService(exchangeRateApi);
const PAGE_SIZE = 10;

export function useExchangeRates() {
  const [currentRates, setCurrentRates] = useState<ExchangeRate[]>([]);
  const [history, setHistory] = useState<ExchangeRatePage>({ items: [], total: 0, offset: 0, limit: PAGE_SIZE });
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (nextOffset = offset) => {
    setLoading(true);
    setError(null);
    try {
      const [current, page] = await Promise.all([
        service.getCurrentRates(),
        service.listRates(nextOffset, PAGE_SIZE),
      ]);
      setCurrentRates(current);
      setHistory(page);
      setOffset(nextOffset);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load exchange rates. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [offset]);

  useEffect(() => { void load(0); }, []); // Initial page is always the first page.

  const createRate = useCallback(async (draft: ExchangeRateDraft) => {
    if (submitting) return false;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await service.createRate(draft);
      setNotice(`The ${draft.currency} exchange rate was added. The previous rate is now historical.`);
      await load(0);
      return true;
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to save the exchange rate. Please try again.');
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [load, submitting]);

  return {
    currentRates, history, offset, loading, error, notice, submitting,
    load, createRate,
    setPage: (nextOffset: number) => { void load(nextOffset); },
    clearMessages: () => { setError(null); setNotice(null); },
  };
}
