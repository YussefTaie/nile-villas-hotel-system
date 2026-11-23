import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../../../shared/api/ApiError';
import { createExchangeRateService } from '../../../exchange-rates/application/exchangeRateService';
import { exchangeRateApi } from '../../../exchange-rates/infrastructure/exchangeRateApi';
import type { ExchangeRate } from '../../../exchange-rates/domain/exchangeRate';
import { createInvoiceService } from '../../application/invoiceService';
import { invoiceApi } from '../../infrastructure/invoiceApi';
import type { CheckoutCurrency, InvoiceDetail, InvoicePayment, PaymentDraft, PaymentMethod } from '../../domain/invoice';
import { buildCheckoutPayments, quotePayments } from '../../domain/invoice';

const invoiceService = createInvoiceService(invoiceApi);
const rateService = createExchangeRateService(exchangeRateApi);
let nextPaymentKey = 1;

function messageFrom(error: unknown): string {
  if (error instanceof Error && !(error instanceof ApiError)) return error.message;
  if (error instanceof ApiError) {
    if (Array.isArray(error.details)) {
      const messages = error.details.map((detail) => detail && typeof detail === 'object' && 'msg' in detail ? String(detail.msg) : '').filter(Boolean);
      if (messages.length) return messages.join(' ');
    }
    return error.message;
  }
  return 'The request could not be completed. Please try again.';
}

export function useInvoiceCheckout(invoiceId: number | null) {
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [payments, setPayments] = useState<InvoicePayment[]>([]);
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratesLoading, setRatesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rateError, setRateError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutConfirmed, setCheckoutConfirmed] = useState(false);
  const operationLock = useRef(false);
  const [paymentEntries, setPaymentEntries] = useState<PaymentDraft[]>([
    { key: nextPaymentKey++, currency: 'USD', paymentMethod: 'CASH', amountApplied: '' },
  ]);

  const refreshInvoice = useCallback(async (id: number) => {
    const detail = await invoiceService.get(id);
    setInvoice(detail);
    if (detail.status === 'PAID') {
      setCheckoutConfirmed(true);
      setPayments(await invoiceService.listPayments(id));
    }
    return detail;
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    if (invoiceId === null) {
      setLoading(false);
      setRatesLoading(false);
      return () => { active = false; };
    }
    void invoiceService.get(invoiceId).then(async (detail) => {
      if (!active) return;
      setInvoice(detail);
      if (detail.status === 'PAID') {
        setCheckoutConfirmed(true);
        try {
          const recordedPayments = await invoiceService.listPayments(invoiceId);
          if (active) setPayments(recordedPayments);
        } catch (caught) {
          if (active) setError(`This invoice is PAID, but its payment records could not be loaded. ${messageFrom(caught)}`);
        }
      }
    }).catch((caught) => { if (active) setError(messageFrom(caught)); })
      .finally(() => { if (active) setLoading(false); });
    void rateService.getCurrentRates().then((current) => { if (active) setRates(current); })
      .catch((caught) => { if (active) setRateError(messageFrom(caught)); })
      .finally(() => { if (active) setRatesLoading(false); });
    return () => { active = false; };
  }, [invoiceId]);

  const rateMap = Object.fromEntries(rates.map((rate) => [rate.currency, { rateToUsd: rate.rateToUsd, source: rate.source }])) as Partial<Record<'EUR' | 'EGP', { rateToUsd: string; source: string }>>;
  const quote = quotePayments(invoice?.totalAmountUsd ?? '0.00', paymentEntries, rateMap);

  async function reloadRates() {
    setRatesLoading(true);
    setRateError(null);
    try { setRates(await rateService.getCurrentRates()); }
    catch (caught) { setRateError(messageFrom(caught)); }
    finally { setRatesLoading(false); }
  }

  function updateEntry(key: number, update: Partial<Pick<PaymentDraft, 'currency' | 'paymentMethod' | 'amountApplied'>>) {
    setPaymentEntries((entries) => entries.map((entry) => entry.key === key ? { ...entry, ...update } : entry));
    setError(null);
    setNotice(null);
  }

  function addEntry() {
    setPaymentEntries((entries) => [...entries, { key: nextPaymentKey++, currency: 'USD', paymentMethod: 'CASH', amountApplied: '' }]);
    setError(null);
  }

  function removeEntry(key: number) {
    setPaymentEntries((entries) => entries.length > 1 ? entries.filter((entry) => entry.key !== key) : entries);
    setError(null);
    setNotice(null);
  }

  async function refreshAfterSuccess(id: number) {
    try {
      const [detail, recordedPayments] = await Promise.all([invoiceService.get(id), invoiceService.listPayments(id)]);
      setInvoice(detail);
      setPayments(recordedPayments);
      if (detail.status !== 'PAID') throw new Error('The backend has not confirmed the invoice as PAID.');
      setCheckoutConfirmed(true);
      setNotice('Payment completed. The invoice is now PAID.');
      return true;
    } catch (caught) {
      setCheckoutConfirmed(true);
      setInvoice((current) => current ? { ...current, status: 'PAID' } : current);
      setNotice('Payment completed. The invoice is PAID, but refreshed details are unavailable. Retry loading the invoice details.');
      setError(messageFrom(caught));
      return false;
    }
  }

  async function submitCheckout() {
    if (invoiceId === null || !invoice || invoice.status !== 'OPEN' || !quote.valid || operationLock.current) return false;
    operationLock.current = true;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      let ratesForSubmission = rateMap;
      const foreignCurrencies = [...new Set(paymentEntries.map((entry) => entry.currency).filter((currency) => currency !== 'USD'))];
      if (foreignCurrencies.length) {
        const latestRates = await rateService.getCurrentRates();
        ratesForSubmission = Object.fromEntries(latestRates.map((rate) => [rate.currency, { rateToUsd: rate.rateToUsd, source: rate.source }])) as typeof rateMap;
        const changedCurrency = foreignCurrencies.find((currency) => {
          const loaded = rateMap[currency];
          const latest = ratesForSubmission[currency];
          return !latest || !loaded || latest.rateToUsd !== loaded.rateToUsd || latest.source !== loaded.source;
        });
        if (changedCurrency) {
          setRates(latestRates);
          setError(`The current ${changedCurrency} rate changed or is no longer available. Review the updated USD equivalents before retrying.`);
          return false;
        }
      }
      const latestQuote = quotePayments(invoice.totalAmountUsd, paymentEntries, ratesForSubmission);
      if (!latestQuote.valid) {
        setError(latestQuote.error ?? 'Review the payment entries before retrying.');
        return false;
      }
      const status = await invoiceService.checkout(invoiceId, buildCheckoutPayments(paymentEntries, ratesForSubmission));
      if (status !== 'PAID') throw new Error('The backend did not confirm that this invoice is PAID.');
      setCheckoutConfirmed(true);
      return await refreshAfterSuccess(invoiceId);
    } catch (caught) {
      try {
        const latest = await invoiceService.get(invoiceId);
        setInvoice(latest);
        if (latest.status === 'PAID') {
          const recordedPayments = await invoiceService.listPayments(invoiceId);
          setPayments(recordedPayments);
          setCheckoutConfirmed(true);
          setNotice('Payment completed. The invoice is now PAID.');
          return true;
        }
      } catch { /* Keep the original checkout error and the user's entries. */ }
      setError(messageFrom(caught));
      return false;
    } finally {
      operationLock.current = false;
      setSubmitting(false);
    }
  }

  async function reload() {
    if (invoiceId === null || operationLock.current) return;
    setLoading(true);
    setError(null);
    try { await refreshInvoice(invoiceId); }
    catch (caught) { setError(messageFrom(caught)); }
    finally { setLoading(false); }
  }

  function changeCurrency(key: number, currency: CheckoutCurrency) { updateEntry(key, { currency }); }
  function changeMethod(key: number, paymentMethod: PaymentMethod) { updateEntry(key, { paymentMethod }); }

  return {
    invoice, payments, rates, rateMap, loading, ratesLoading, error, rateError, notice,
    submitting, checkoutConfirmed, paymentEntries, quote,
    updateEntry, addEntry, removeEntry, changeCurrency, changeMethod, submitCheckout, reload,
    reloadRates,
  };
}
