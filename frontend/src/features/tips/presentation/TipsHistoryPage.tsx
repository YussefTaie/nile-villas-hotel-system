import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ErrorState, EmptyState, LoadingState } from '../../../shared/ui/AsyncState';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { Chip } from '../../../shared/ui/Chip';
import { Dialog } from '../../../shared/ui/Dialog';
import { InputField, SelectField } from '../../../shared/ui/Field';
import { PageContainer } from '../../../shared/ui/PageContainer';
import { PageHeading } from '../../../shared/ui/PageHeading';
import { DataTable, TableCell, TableHeader } from '../../../shared/ui/Table';
import { formatOperationalDateTime, reportingDateBoundary } from '../../../shared/date/reportingDate';
import { decimalToMinor, formatMinor, paymentUsdCents } from '../../invoices/domain/invoice';
import type { Invoice } from '../../invoices/domain/invoice';
import type { TipCreateInput, TipCurrency, TipPaymentMethod, TipRateSource } from '../domain/tip';
import { useTipsHistory } from './hooks/useTipsHistory';
import './tipsHistory.css';

const PAGE_SIZE = 10;
const currencies: TipCurrency[] = ['USD', 'EUR', 'EGP'];
const methods: TipPaymentMethod[] = ['CASH', 'VISA'];
const sourceLabel = (source: TipRateSource) => source === 'CENTRAL_BANK' ? 'Central bank' : source === 'BASE' ? 'Base' : 'Manual';
const formatAmount = (value: string, currency: TipCurrency) => {
  const minor = decimalToMinor(value, 2);
  return minor === null ? `${value} ${currency}` : formatMinor(minor, currency);
};

export function TipsHistoryPage() {
  const [params, setParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const currency = currencies.includes(params.get('currency') as TipCurrency) ? params.get('currency') as TipCurrency : undefined;
  const paymentMethod = methods.includes(params.get('payment_method') as TipPaymentMethod) ? params.get('payment_method') as TipPaymentMethod : undefined;
  const invoiceIdParam = params.get('invoice_id') ?? '';
  const invoiceId = /^[1-9]\d*$/.test(invoiceIdParam) && Number.isSafeInteger(Number(invoiceIdParam)) ? Number(invoiceIdParam) : undefined;
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const offset = Math.max(0, Number(params.get('offset')) || 0);
  const query = useMemo(() => ({
    currency, paymentMethod, invoiceId,
    createdFrom: from ? reportingDateBoundary(from, false) : undefined,
    createdTo: to ? reportingDateBoundary(to, true) : undefined,
    offset, limit: PAGE_SIZE,
  }), [currency, paymentMethod, invoiceId, from, to, offset]);
  const history = useTipsHistory(query);

  const update = (values: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values)) value ? next.set(key, value) : next.delete(key);
    next.set('offset', '0');
    setParams(next);
  };
  const invoiceIdInvalid = invoiceIdParam !== '' && invoiceId === undefined;
  const returnTo = `${location.pathname}${location.search}`;

  return <PageContainer>
    <PageHeading title="Tips History" description="Review standalone tips and tips linked to paid invoices." actions={<Button variant="primary" onClick={() => { setSuccessNotice(null); setDialogOpen(true); }}>Record Tip</Button>} />
    {successNotice && <p className="tips-history__success" role="status">{successNotice}</p>}
    <Card className="tips-history__filters">
      <label className="tips-history__filter">Invoice ID<input type="number" min="1" step="1" value={invoiceIdParam} onChange={(event) => update({ invoice_id: event.target.value || null })} aria-invalid={invoiceIdInvalid} /></label>
      <label className="tips-history__filter">Currency<select value={currency ?? ''} onChange={(event) => update({ currency: event.target.value || null })}><option value="">All currencies</option>{currencies.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <label className="tips-history__filter">Payment method<select value={paymentMethod ?? ''} onChange={(event) => update({ payment_method: event.target.value || null })}><option value="">All methods</option>{methods.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <label className="tips-history__filter">From<input type="date" value={from} max={to || undefined} onChange={(event) => update({ from: event.target.value || null })} /></label>
      <label className="tips-history__filter">To<input type="date" value={to} min={from || undefined} onChange={(event) => update({ to: event.target.value || null })} /></label>
    </Card>
    {invoiceIdInvalid && <p className="tips-history__validation" role="alert">Invoice ID must be a positive whole number.</p>}
    <Card className="tips-history__results">
      {history.loading ? <LoadingState label="Loading tips…" /> : history.error ? <ErrorState message={history.error} action={<Button onClick={history.reload}>Try again</Button>} /> : history.page && history.page.items.length === 0 ? <EmptyState>{history.page.total === 0 ? 'No tips match these filters.' : 'No tips on this page.'}</EmptyState> : history.page && <>
        <DataTable className="tips-history__table"><thead><tr><TableHeader>Created</TableHeader><TableHeader>Amount received</TableHeader><TableHeader>Rate (currency per USD)</TableHeader><TableHeader>USD equivalent</TableHeader><TableHeader>Rate source</TableHeader><TableHeader>Method</TableHeader><TableHeader>Invoice</TableHeader><TableHeader>Association</TableHeader></tr></thead><tbody>
          {history.page.items.map((tip) => <tr key={tip.id}><TableCell>{formatOperationalDateTime(tip.createdAt)}</TableCell><TableCell className="tips-history__original">{formatAmount(tip.amountReceived, tip.currency)} <small>{tip.currency}</small></TableCell><TableCell>{tip.exchangeRate}</TableCell><TableCell className="tips-history__equivalent">{formatAmount(tip.amountUsdEquivalent, 'USD')}</TableCell><TableCell>{sourceLabel(tip.rateSource)}</TableCell><TableCell>{tip.paymentMethod}</TableCell><TableCell>{tip.invoiceId === null ? '—' : tip.invoiceNumber ? <Link to={`/invoices/${tip.invoiceId}?returnTo=${encodeURIComponent(returnTo)}`}>{tip.invoiceNumber}</Link> : `Invoice #${tip.invoiceId}`}</TableCell><TableCell><Chip tone={tip.invoiceId === null ? 'neutral' : 'info'}>{tip.invoiceId === null ? 'Standalone' : 'Invoice linked'}</Chip></TableCell></tr>)}
        </tbody></DataTable>
        <div className="tips-history__pagination"><span>{history.page.total ? `${offset + 1}–${Math.min(offset + history.page.items.length, history.page.total)} of ${history.page.total}` : '0 results'}</span><div><Button disabled={offset <= 0} onClick={() => setParams((current) => { const next = new URLSearchParams(current); next.set('offset', String(Math.max(0, offset - PAGE_SIZE))); return next; })}>Previous</Button><Button disabled={offset + PAGE_SIZE >= history.page.total} onClick={() => setParams((current) => { const next = new URLSearchParams(current); next.set('offset', String(offset + PAGE_SIZE)); return next; })}>Next</Button></div></div>
      </>}
    </Card>
    <RecordTipDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onSuccess={setSuccessNotice} history={history} />
  </PageContainer>;
}

type HistoryHook = ReturnType<typeof useTipsHistory>;

function RecordTipDialog({ open, onClose, onSuccess, history }: { open: boolean; onClose: () => void; onSuccess: (message: string) => void; history: HistoryHook }) {
  const [association, setAssociation] = useState<'standalone' | 'invoice'>('standalone');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [currency, setCurrency] = useState<TipCurrency>('USD');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<TipPaymentMethod>('CASH');
  const [formError, setFormError] = useState<string | null>(null);
  const submittingGuard = useRef(false);
  const rate = currency === 'USD' ? { rateToUsd: '1.000000', source: 'BASE' as const } : history.rates.find((value) => value.currency === currency);
  const usdCents = rate ? paymentUsdCents(amount, rate.rateToUsd) : null;
  const equivalent = usdCents === null ? null : formatMinor(usdCents, 'USD');
  const equivalentDecimal = usdCents === null ? null : `${usdCents / 100n}.${String(usdCents % 100n).padStart(2, '0')}`;
  const amountValid = decimalToMinor(amount, 2) !== null && decimalToMinor(amount, 2)! > 0n;

  const searchInvoices = async () => {
    setSelectedInvoice(null);
    await history.searchPaidInvoices(invoiceSearch);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (association === 'invoice' && !selectedInvoice) { setFormError('Search for and select a PAID invoice.'); return; }
    if (!amountValid) { setFormError('Enter a positive amount with no more than two decimal places.'); return; }
    if (!rate || usdCents === null || equivalentDecimal === null) { setFormError(history.ratesError ?? `A current ${currency} exchange rate is required.`); return; }
    const input: TipCreateInput = {
      invoiceId: association === 'invoice' ? selectedInvoice!.id : null,
      currency, amountReceived: amount.trim(), exchangeRate: rate.rateToUsd,
      amountUsdEquivalent: equivalentDecimal, rateSource: rate.source, paymentMethod: method,
    };
    if (submittingGuard.current) return;
    submittingGuard.current = true;
    try {
      const created = await history.createTip(input);
      onSuccess(`Tip recorded${created.invoiceNumber ? ` for ${created.invoiceNumber}` : ''}.`);
      setAmount(''); setInvoiceSearch(''); setSelectedInvoice(null); setAssociation('standalone'); setCurrency('USD'); setMethod('CASH');
      onClose();
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : 'Unable to record tip. Your entries are still here.');
    } finally { submittingGuard.current = false; }
  };

  return <Dialog open={open} title="Record Tip" description="Tips are independent transactions and do not change invoices or payments." onClose={onClose} size="large">
    <form className="record-tip" onSubmit={submit}>
      <SelectField label="Association" value={association} onChange={(event) => { const next = event.target.value as 'standalone' | 'invoice'; setAssociation(next); setSelectedInvoice(null); setFormError(null); }}><option value="standalone">Standalone tip</option><option value="invoice">Link to a PAID invoice</option></SelectField>
      {association === 'invoice' && <div className="record-tip__invoice-picker"><div className="record-tip__search"><InputField label="Invoice number" placeholder="Search PAID invoice number" value={invoiceSearch} onChange={(event) => setInvoiceSearch(event.target.value)} /><Button type="button" disabled={history.invoiceSearchLoading} onClick={() => void searchInvoices()}>{history.invoiceSearchLoading ? 'Searching…' : 'Search'}</Button></div>{history.invoiceSearchError && <p className="record-tip__error" role="alert">{history.invoiceSearchError}</p>}{history.paidInvoices.length > 0 && <div className="record-tip__invoice-results" role="listbox" aria-label="PAID invoices">{history.paidInvoices.map((invoice) => <button type="button" role="option" aria-selected={selectedInvoice?.id === invoice.id} key={invoice.id} className={selectedInvoice?.id === invoice.id ? 'is-selected' : ''} onClick={() => setSelectedInvoice(invoice)}><span>{invoice.invoiceNumber}</span><small>{invoice.status} · {formatMinor(decimalToMinor(invoice.totalAmountUsd, 2) ?? 0n, 'USD')}</small></button>)}</div>}{selectedInvoice && <p className="record-tip__selected">Selected {selectedInvoice.invoiceNumber}</p>}</div>}
      <div className="record-tip__row"><SelectField label="Currency" value={currency} onChange={(event) => setCurrency(event.target.value as TipCurrency)}>{currencies.map((value) => <option key={value} value={value}>{value}</option>)}</SelectField><InputField label="Amount received" type="text" inputMode="decimal" placeholder="0.00" required aria-invalid={amount !== '' && !amountValid} value={amount} onChange={(event) => setAmount(event.target.value)} /></div>
      {amount !== '' && !amountValid && <p className="record-tip__error" role="alert">Enter a positive amount with no more than two decimal places.</p>}
      <div className="record-tip__row"><SelectField label="Payment method" value={method} onChange={(event) => setMethod(event.target.value as TipPaymentMethod)}>{methods.map((value) => <option key={value} value={value}>{value}</option>)}</SelectField><div className="record-tip__rate"><span>Exchange rate</span><strong>{rate ? `${rate.rateToUsd} ${currency} per USD` : 'Current rate unavailable'}</strong><small>Source: {rate ? sourceLabel(rate.source) : '—'}</small></div></div>
      <div className="record-tip__equivalent"><span>USD equivalent</span><strong>{equivalent ?? '—'}</strong></div>
      {history.ratesError && currency !== 'USD' && <p className="record-tip__error" role="alert">{history.ratesError}</p>}
      {!rate && !history.ratesError && currency !== 'USD' && <p className="record-tip__error" role="alert">No current {currency} rate is available. Add a rate in Settings before recording this tip.</p>}
      {formError && <p className="record-tip__error" role="alert">{formError}</p>}
      <div className="record-tip__actions"><Button type="button" onClick={onClose} disabled={history.submitting}>Close</Button><Button type="submit" variant="primary" disabled={history.submitting || !amountValid || !rate || (association === 'invoice' && !selectedInvoice)}>{history.submitting ? 'Recording…' : 'Record Tip'}</Button></div>
    </form>
  </Dialog>;
}
