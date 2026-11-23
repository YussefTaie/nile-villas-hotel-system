import { useCallback, useEffect, useState } from 'react';
import { createInvoiceService } from '../../application/invoiceService';
import { invoiceApi } from '../../infrastructure/invoiceApi';
import type { InvoiceDetail, InvoicePayment, InvoiceTip } from '../../domain/invoice';

const service = createInvoiceService(invoiceApi);

export function useInvoiceDetails(invoiceId: number | null) {
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [payments, setPayments] = useState<InvoicePayment[]>([]);
  const [tips, setTips] = useState<InvoiceTip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [tipsError, setTipsError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((value) => value + 1), []);

  useEffect(() => {
    let current = true;
    if (invoiceId === null) { setLoading(false); setError('A valid invoice ID is required.'); return; }
    setLoading(true); setError(null); setPaymentsError(null); setTipsError(null);
    Promise.allSettled([service.get(invoiceId), service.listPayments(invoiceId), service.listTips(invoiceId)]).then(([invoiceResult, paymentResult, tipResult]) => {
      if (!current) return;
      if (invoiceResult.status === 'fulfilled') setInvoice(invoiceResult.value);
      else { setInvoice(null); setError(invoiceResult.reason instanceof Error ? invoiceResult.reason.message : 'Unable to load invoice.'); }
      if (paymentResult.status === 'fulfilled') setPayments(paymentResult.value);
      else { setPayments([]); setPaymentsError(paymentResult.reason instanceof Error ? paymentResult.reason.message : 'Unable to load payment history.'); }
      if (tipResult.status === 'fulfilled') setTips(tipResult.value);
      else { setTips([]); setTipsError(tipResult.reason instanceof Error ? tipResult.reason.message : 'Unable to load linked tips.'); }
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [invoiceId, reloadKey]);

  return { invoice, payments, tips, loading, error, paymentsError, tipsError, reload };
}
