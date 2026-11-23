import { useCallback, useEffect, useState } from 'react';
import { createInvoiceService } from '../../application/invoiceService';
import { invoiceApi } from '../../infrastructure/invoiceApi';
import type { InvoiceListQuery, InvoicePage } from '../../domain/invoice';

const service = createInvoiceService(invoiceApi);

export function useInvoiceHistory(query: InvoiceListQuery) {
  const [page, setPage] = useState<InvoicePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((value) => value + 1), []);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(null);
    service.listInvoices(query).then((result) => {
      if (current) setPage(result);
    }).catch((reason: unknown) => {
      if (current) setError(reason instanceof Error ? reason.message : 'Unable to load invoices.');
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [query.status, query.invoiceNumber, query.createdFrom, query.createdTo, query.offset, query.limit, reloadKey]);

  return { page, loading, error, reload };
}
