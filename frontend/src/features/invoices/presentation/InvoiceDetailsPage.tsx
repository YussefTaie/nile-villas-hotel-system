import { useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState } from '../../../shared/ui/AsyncState';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { Chip } from '../../../shared/ui/Chip';
import { PageContainer } from '../../../shared/ui/PageContainer';
import { PageHeading } from '../../../shared/ui/PageHeading';
import { formatOperationalDateTime } from '../../../shared/date/reportingDate';
import { decimalToMinor, formatMinor, formatUsd } from '../domain/invoice';
import { useInvoiceDetails } from './hooks/useInvoiceDetails';
import { InvoicePrintDocument, type PrintMode } from './InvoicePrintDocument';
import './invoiceDetails.css';

const money = (value: string, currency: 'USD' | 'EUR' | 'EGP') => { const minor = decimalToMinor(value, 2); return minor === null ? `${value} ${currency}` : formatMinor(minor, currency); };
const sourceName = (source: string) => source === 'CENTRAL_BANK' ? 'Central bank' : source === 'BASE' ? 'Base rate' : 'Manual';

export function InvoiceDetailsPage() {
  const { invoiceId: rawId } = useParams();
  const parsedId = rawId && /^[1-9]\d*$/.test(rawId) ? Number(rawId) : NaN;
  const invoiceId = Number.isSafeInteger(parsedId) ? parsedId : null;
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const details = useInvoiceDetails(invoiceId);
  const requestedMode = params.get('print');
  const printMode: PrintMode | null = requestedMode === 'bill' ? 'bill' : requestedMode === 'receipt' ? 'receipt' : null;
  const autoPrintStarted = useRef(false);
  const returnTo = useMemo(() => {
    const candidate = params.get('returnTo');
    return candidate?.startsWith('/invoices') && !candidate.startsWith('//') ? candidate : '/invoices';
  }, [params]);
  const canPrintMode = details.invoice && (printMode === 'bill' ? details.invoice.status === 'OPEN' : printMode === 'receipt' ? details.invoice.status === 'PAID' && !details.paymentsError && details.payments.length > 0 : false);

  useEffect(() => {
    if (!printMode || !details.invoice || details.loading || autoPrintStarted.current) return;
    if (printMode === 'receipt' && (!details.payments.length || details.paymentsError)) return;
    if ((printMode === 'bill' && details.invoice.status !== 'OPEN') || (printMode === 'receipt' && details.invoice.status !== 'PAID')) return;
    autoPrintStarted.current = true;
    const timer = window.setTimeout(() => window.print(), 100);
    return () => window.clearTimeout(timer);
  }, [printMode, details.invoice, details.loading, details.payments, details.paymentsError]);

  if (details.loading) return <PageContainer><PageHeading title="Invoice Details" /><Card><LoadingState label="Loading invoice details…" /></Card></PageContainer>;
  if (!details.invoice) return <PageContainer><PageHeading title="Invoice Details" /><Card><ErrorState message={details.error ?? 'Unable to load invoice.'} action={<Button onClick={details.reload}>Try again</Button>} /></Card><Link to={returnTo}>Back to Invoice History</Link></PageContainer>;
  const invoice = details.invoice;
  const mode: PrintMode = invoice.status === 'PAID' ? 'receipt' : 'bill';

  return <PageContainer>
    <PageHeading title="Invoice Details" description={invoice.invoiceNumber} actions={<><Button onClick={() => navigate(returnTo)}>Back to History</Button>{invoice.status === 'OPEN' && <Button variant="secondary" onClick={() => window.print()}>Print unpaid bill</Button>}{invoice.status === 'PAID' && <Button variant="primary" disabled={details.paymentsError !== null || details.payments.length === 0} onClick={() => window.print()}>Print final receipt</Button>}</>} />
    {printMode && !canPrintMode && <Card className="invoice-details__notice"><p role="alert">{printMode === 'bill' && invoice.status !== 'OPEN' ? 'An unpaid bill can only be printed for an OPEN invoice.' : printMode === 'receipt' && invoice.status !== 'PAID' ? 'A final receipt can only be printed for a PAID invoice.' : details.paymentsError ?? 'Payment details are required for a final receipt.'}</p></Card>}
    <div className="invoice-details__layout">
      <div className="invoice-details__main">
        <Card className="invoice-details__summary"><div><span className="invoice-details__eyebrow">Invoice number</span><h2>{invoice.invoiceNumber}</h2></div><Chip tone={invoice.status === 'PAID' ? 'success' : invoice.status === 'OPEN' ? 'warning' : 'neutral'}>{invoice.status}</Chip><dl><div><dt>Created</dt><dd>{formatOperationalDateTime(invoice.createdAt)}</dd></div><div><dt>Completed</dt><dd>{formatOperationalDateTime(invoice.completedAt)}</dd></div><div><dt>Total</dt><dd className="invoice-details__amount">{formatUsd(invoice.totalAmountUsd)}</dd></div></dl></Card>
        <Card className="invoice-details__section"><h2>Invoice items</h2>{invoice.items.length === 0 ? <EmptyState>No items on this invoice.</EmptyState> : <div className="invoice-details__table-wrap"><table className="invoice-details__table"><thead><tr><th>Item</th><th>Category</th><th>Qty</th><th>Unit price</th><th>Line total</th></tr></thead><tbody>{invoice.items.map((item) => <tr key={item.id}><td>{item.productNameSnapshot}</td><td>{item.categoryNameSnapshot || '—'}</td><td>{item.quantity}</td><td>{formatUsd(item.unitPriceUsd)}</td><td>{formatUsd(item.lineTotalUsd)}</td></tr>)}</tbody></table></div>}<div className="invoice-details__total"><span>Invoice total (USD)</span><strong>{formatUsd(invoice.totalAmountUsd)}</strong></div></Card>
        <Card className="invoice-details__section"><h2>Payments</h2>{details.paymentsError ? <ErrorState message={details.paymentsError} action={<Button onClick={details.reload}>Retry</Button>} /> : details.payments.length === 0 ? <EmptyState>No payment records.</EmptyState> : <div className="invoice-details__table-wrap"><table className="invoice-details__table"><thead><tr><th>Amount</th><th>Method</th><th>Exchange rate</th><th>Source</th><th>USD equivalent</th><th>Recorded</th></tr></thead><tbody>{details.payments.map((payment) => <tr key={payment.id}><td>{money(payment.amountApplied, payment.currency)}</td><td>{payment.paymentMethod}</td><td>{payment.exchangeRate}</td><td>{sourceName(payment.rateSource)}</td><td>{formatUsd(payment.amountUsdEquivalent)}</td><td>{formatOperationalDateTime(payment.createdAt)}</td></tr>)}</tbody></table></div>}</Card>
        <Card className="invoice-details__section invoice-details__tips"><h2>Linked tips <small>Independent from invoice total and payments</small></h2>{details.tipsError ? <ErrorState message={details.tipsError} action={<Button onClick={details.reload}>Retry</Button>} /> : details.tips.length === 0 ? <EmptyState>No linked tips.</EmptyState> : <div className="invoice-details__table-wrap"><table className="invoice-details__table"><thead><tr><th>Amount</th><th>Method</th><th>Exchange rate</th><th>Source</th><th>USD equivalent</th><th>Recorded</th></tr></thead><tbody>{details.tips.map((tip) => <tr key={tip.id}><td>{money(tip.amountReceived, tip.currency)}</td><td>{tip.paymentMethod}</td><td>{tip.exchangeRate}</td><td>{sourceName(tip.rateSource)}</td><td>{formatUsd(tip.amountUsdEquivalent)}</td><td>{formatOperationalDateTime(tip.createdAt)}</td></tr>)}</tbody></table></div>}</Card>
      </div>
      <aside className="invoice-details__preview"><h2>{invoice.status === 'CANCELLED' ? 'Printing unavailable' : mode === 'bill' ? 'Unpaid bill preview' : 'Guest receipt preview'}</h2>{invoice.status === 'CANCELLED' ? <p className="invoice-details__hint">Cancelled invoices cannot be printed as bills or paid receipts.</p> : <InvoicePrintDocument invoice={invoice} payments={details.payments} mode={mode} className="invoice-print-preview" />}{details.paymentsError && invoice.status === 'PAID' && <p className="invoice-details__hint">Payment details could not be loaded, so receipt printing is unavailable.</p>}</aside>
    </div>
    <div className="invoice-print-sheet" aria-hidden="true">{invoice.status !== 'CANCELLED' && <InvoicePrintDocument invoice={invoice} payments={details.payments} mode={mode} />}</div>
  </PageContainer>;
}

