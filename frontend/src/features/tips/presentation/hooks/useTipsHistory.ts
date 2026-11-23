import { useCallback, useEffect, useState } from 'react';
import { createTipService } from '../../application/tipService';
import { tipApi } from '../../infrastructure/tipApi';
import type { TipCreateInput, TipListQuery, TipPage } from '../../domain/tip';
import { exchangeRateApi } from '../../../exchange-rates/infrastructure/exchangeRateApi';
import { createInvoiceService } from '../../../invoices/application/invoiceService';
import { invoiceApi } from '../../../invoices/infrastructure/invoiceApi';
import type { Invoice } from '../../../invoices/domain/invoice';

const service = createTipService(tipApi);
const invoices = createInvoiceService(invoiceApi);

export function useTipsHistory(query: TipListQuery) {
  const [page, setPage] = useState<TipPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rates, setRates] = useState<Awaited<ReturnType<typeof exchangeRateApi.getCurrentRates>>>([]);
  const [ratesError, setRatesError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [invoiceSearchLoading, setInvoiceSearchLoading] = useState(false);
  const [invoiceSearchError, setInvoiceSearchError] = useState<string | null>(null);
  const [paidInvoices, setPaidInvoices] = useState<Invoice[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((value) => value + 1), []);

  useEffect(() => {
    let current = true;
    setLoading(true); setError(null);
    service.list(query).then((result) => { if (current) setPage(result); })
      .catch((reason: unknown) => { if (current) setError(reason instanceof Error ? reason.message : 'Unable to load tips.'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [query.invoiceId, query.currency, query.paymentMethod, query.createdFrom, query.createdTo, query.offset, query.limit, reloadKey]);

  useEffect(() => {
    let current = true;
    setRatesError(null);
    exchangeRateApi.getCurrentRates().then((result) => { if (current) setRates(result); })
      .catch((reason: unknown) => { if (current) setRatesError(reason instanceof Error ? reason.message : 'Unable to load current exchange rates.'); });
    return () => { current = false; };
  }, [reloadKey]);

  const searchPaidInvoices = useCallback(async (invoiceNumber: string) => {
    setInvoiceSearchLoading(true); setInvoiceSearchError(null); setPaidInvoices([]);
    try {
      const result = await invoices.listInvoices({ status: 'PAID', invoiceNumber: invoiceNumber.trim() || undefined, offset: 0, limit: 10 });
      setPaidInvoices(result.items);
    } catch (reason) {
      setInvoiceSearchError(reason instanceof Error ? reason.message : 'Unable to search PAID invoices.');
    } finally { setInvoiceSearchLoading(false); }
  }, []);

  const createTip = useCallback(async (input: TipCreateInput) => {
    setSubmitting(true);
    try {
      const tip = await service.create(input);
      reload();
      return tip;
    } finally { setSubmitting(false); }
  }, [reload]);

  return { page, loading, error, reload, rates, ratesError, submitting, createTip, searchPaidInvoices, invoiceSearchLoading, invoiceSearchError, paidInvoices };
}
