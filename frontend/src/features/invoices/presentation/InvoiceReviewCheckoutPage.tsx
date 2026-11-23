import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState } from '../../../shared/ui/AsyncState';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { Chip } from '../../../shared/ui/Chip';
import { Icon } from '../../../shared/ui/Icon';
import { PageContainer } from '../../../shared/ui/PageContainer';
import { PageHeading } from '../../../shared/ui/PageHeading';
import { formatOperationalDateTime } from '../../../shared/date/reportingDate';
import { decimalToMinor, formatMinor, formatUsd } from '../domain/invoice';
import type { CheckoutCurrency, PaymentDraft, PaymentMethod } from '../domain/invoice';
import { useInvoiceCheckout } from './hooks/useInvoiceCheckout';
import './invoiceReviewCheckout.css';

const currencyInfo: Record<CheckoutCurrency, { name: string; sign: string }> = {
  USD: { name: 'US Dollar', sign: '$' }, EUR: { name: 'Euro', sign: '€' }, EGP: { name: 'Egyptian Pound', sign: 'EGP' },
};

export function InvoiceReviewCheckoutPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const rawId = params.get('invoiceId');
  const parsed = rawId && /^[1-9]\d*$/.test(rawId) ? Number(rawId) : NaN;
  const invoiceId = Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  const checkout = useInvoiceCheckout(invoiceId);
  const currentRates = useMemo(() => new Map(checkout.rates.map((rate) => [rate.currency, rate])), [checkout.rates]);
  const invoiceCents = checkout.invoice ? decimalToMinor(checkout.invoice.totalAmountUsd, 2) ?? 0n : 0n;
  const hasCompleteQuote = !checkout.quote.equivalents.some((value) => value === null);
  const priorEquivalentCents = checkout.quote.equivalents.slice(0, -1).reduce<bigint>((sum, value) => sum + (value ?? 0n), 0n);
  const expectedLastEquivalent = invoiceCents - priorEquivalentCents;
  const lastEquivalent = checkout.quote.equivalents.at(-1);
  const rawRoundingAdjustment = hasCompleteQuote && typeof lastEquivalent === 'bigint' && checkout.paymentEntries.length > 1
    ? (lastEquivalent > expectedLastEquivalent ? lastEquivalent - expectedLastEquivalent : expectedLastEquivalent - lastEquivalent) : 0n;
  const roundingAdjustment = checkout.quote.valid ? rawRoundingAdjustment : 0n;
  const roundingSettlesInvoice = roundingAdjustment > 0n;
  const remainingLabel = roundingSettlesInvoice ? formatMinor(0n) : checkout.quote.remainingCents < 0n
    ? `Over by ${formatMinor(-checkout.quote.remainingCents)}`
    : formatMinor(checkout.quote.remainingCents);
  const canPay = Boolean(checkout.invoice && checkout.invoice.status === 'OPEN' && checkout.invoice.items.length > 0 && checkout.quote.valid && !checkout.submitting && !checkout.loading);

  if (invoiceId === null) {
    return <PageContainer><PageHeading title="Invoice Review & Checkout" description="Review the saved invoice and record its payment." /><Card><ErrorState message="A valid invoiceId is required to review an invoice." action={<Button onClick={() => navigate('/invoices/new')}>Create Invoice</Button>} /></Card></PageContainer>;
  }

  if (checkout.loading) return <PageContainer><PageHeading title="Invoice Review & Checkout" /><Card><LoadingState label="Loading invoice details…" /></Card></PageContainer>;
  if (!checkout.invoice) return <PageContainer><PageHeading title="Invoice Review & Checkout" /><Card><ErrorState message={checkout.error ?? 'Unable to load this invoice.'} action={<Button onClick={() => void checkout.reload()}>Try Again</Button>} /></Card></PageContainer>;

  const invoice = checkout.invoice;
  const isPayable = invoice.status === 'OPEN';
  const missingCurrencies = (['EUR', 'EGP'] as const).filter((currency) => !currentRates.has(currency));

  return (
    <PageContainer>
      <PageHeading
        title="Invoice Review & Checkout"
        description={invoice.invoiceNumber}
        actions={<Chip tone={invoice.status === 'PAID' ? 'success' : invoice.status === 'CANCELLED' ? 'error' : 'info'}>{invoice.status}</Chip>}
      />
      {checkout.notice && <p className="checkout-message checkout-message--success" role="status">{checkout.notice}</p>}
      {checkout.error && <p className="checkout-message checkout-message--error" role="alert">{checkout.error} {checkout.checkoutConfirmed && <Button variant="quiet" onClick={() => void checkout.reload()}>Reload details</Button>}</p>}

      <div className="checkout-layout">
        <section className="checkout-review-column" aria-label="Invoice review">
          <Card className="checkout-breakdown-card">
            <div className="checkout-section-heading">
              <div><Icon name="fact_check" /><h2>Invoice Breakdown</h2></div>
              <span>{invoice.items.length} {invoice.items.length === 1 ? 'line item' : 'line items'}</span>
            </div>
            {invoice.items.length === 0 ? <EmptyState>This invoice has no saved items and cannot be paid.</EmptyState> : (
              <div className="checkout-table-scroll"><table className="checkout-items-table">
                <thead><tr><th>Item description</th><th>Category</th><th>Qty</th><th>Unit price (USD)</th><th>Line total (USD)</th></tr></thead>
                <tbody>{invoice.items.map((item) => <tr key={item.id}>
                  <td><strong>{item.productNameSnapshot}</strong></td><td><span className="checkout-category">{item.categoryNameSnapshot}</span></td>
                  <td>{item.quantity}</td><td>{formatUsd(item.unitPriceUsd)}</td><td><strong>{formatUsd(item.lineTotalUsd)}</strong></td>
                </tr>)}</tbody>
              </table></div>
            )}
            <div className="checkout-breakdown-footer"><span>{invoice.items.length} distinct line items · {invoice.items.reduce((sum, item) => sum + item.quantity, 0)} total units</span><span>USD base ledger</span></div>
          </Card>

          <Card className="checkout-subtotal-card">
            <div className="checkout-section-heading"><h2>Financial Subtotal Breakdown</h2><span>USD base ledger</span></div>
            <div className="checkout-subtotal-row"><span>Base subtotal</span><strong>{formatUsd(invoice.totalAmountUsd)}</strong></div>
            <div className="checkout-subtotal-total"><div><strong>Total in base USD</strong><span>Includes all invoice items</span></div><strong>{formatUsd(invoice.totalAmountUsd)} <small>USD</small></strong></div>
          </Card>

          {invoice.status === 'PAID' && checkout.payments.length > 0 && <Card className="checkout-recorded-card">
            <div className="checkout-section-heading"><h2>Recorded Payments</h2><span>Saved by the backend</span></div>
            <div className="checkout-recorded-list">{checkout.payments.map((payment) => <div className="checkout-recorded-row" key={payment.id}>
              <div><strong>{payment.currency} · {payment.paymentMethod}</strong><span>Rate {payment.exchangeRate} · {payment.rateSource}</span></div>
              <div><strong>{currencyInfo[payment.currency].sign}{payment.amountApplied}</strong><span>{formatUsd(payment.amountUsdEquivalent)}</span></div>
            </div>)}</div>
          </Card>}
        </section>

        <aside className="checkout-payment-column" aria-label="Payment and settlement">
          <Card className="checkout-rates-card">
            <div className="checkout-section-heading">
              <div><Icon name="currency_exchange" /><h2>Select Payment Currency</h2></div>
              <Chip>{1 + checkout.rates.length} rates available</Chip>
            </div>
            <p className="checkout-hint">Rates are foreign currency units per 1 USD. Current rates are locked for this checkout.</p>
            <div className="checkout-rate-options">
              <RateOption currency="USD" rateLabel="1.000000" source="BASE" effectiveAt={null} selected={checkout.paymentEntries.some((entry) => entry.currency === 'USD')} />
              {(['EUR', 'EGP'] as const).map((currency) => {
                const rate = currentRates.get(currency);
                return <RateOption key={currency} currency={currency} rateLabel={rate?.rateToUsd ?? null} source={rate?.source ?? null} effectiveAt={rate?.effectiveFrom ?? null} selected={checkout.paymentEntries.some((entry) => entry.currency === currency)} unavailable={!rate} />;
              })}
            </div>
            {checkout.ratesLoading && <div className="checkout-rate-status"><LoadingState label="Loading current exchange rates…" /></div>}
            {checkout.rateError && <div className="checkout-rate-error" role="alert">{checkout.rateError} USD remains available. <Button variant="quiet" onClick={() => void checkout.reloadRates()}>Retry rates</Button></div>}
            {!checkout.ratesLoading && !checkout.rateError && missingCurrencies.length > 0 && <p className="checkout-rate-unavailable">A current {missingCurrencies.join(' and ')} rate is not configured. {missingCurrencies.length === 1 ? 'That currency cannot' : 'Those currencies cannot'} be selected.</p>}
          </Card>

          {isPayable && <Card className="checkout-tender-card">
            <div className="checkout-section-heading"><div><Icon name="payments" /><h2>Tender Entries</h2></div><Chip>{checkout.paymentEntries.length} {checkout.paymentEntries.length === 1 ? 'payment' : 'payments'}</Chip></div>
            <div className="checkout-tender-list">
              {checkout.paymentEntries.map((entry, index) => {
                const rate = entry.currency === 'USD' ? null : currentRates.get(entry.currency);
                const equivalent = checkout.quote.equivalents[index];
                const currencyUnavailable = entry.currency !== 'USD' && !rate;
                return <PaymentEntry key={entry.key} entry={entry} index={index} rate={rate ?? null} equivalent={typeof equivalent === 'bigint' ? equivalent : null}
                  ratesLoading={checkout.ratesLoading} eurAvailable={Boolean(checkout.rateMap.EUR)} egpAvailable={Boolean(checkout.rateMap.EGP)} currencyUnavailable={currencyUnavailable}
                  onChangeCurrency={(currency) => checkout.changeCurrency(entry.key, currency)}
                  onChangeMethod={(method) => checkout.changeMethod(entry.key, method)}
                  onChangeAmount={(amountApplied) => checkout.updateEntry(entry.key, { amountApplied })}
                  onRemove={() => checkout.removeEntry(entry.key)} canRemove={checkout.paymentEntries.length > 1} />;
              })}
            </div>
            <Button variant="secondary" fullWidth onClick={checkout.addEntry}><Icon name="add" />Add another payment</Button>
            <div className="checkout-rate-lock"><Icon name="verified_user" /><span>Exchange rates are recorded with each payment. Existing rates cannot be edited from checkout.</span></div>
          </Card>}

          <Card className="checkout-settlement-card">
            <div className="checkout-settlement-total"><span>Final amount payable</span><strong>{formatUsd(invoice.totalAmountUsd)}</strong></div>
            {isPayable ? <>
              <div className="checkout-settlement-row"><span>Combined USD equivalent</span><strong>{hasCompleteQuote ? formatMinor(checkout.quote.totalEquivalentCents) : '—'}</strong></div>
              <div className={`checkout-settlement-row checkout-settlement-row--remaining${checkout.quote.remainingCents < 0n && !roundingSettlesInvoice ? ' is-over' : ''}`}><span>{checkout.quote.remainingCents < 0n && !roundingSettlesInvoice ? 'Over by' : 'Remaining in USD'}</span><strong>{remainingLabel}</strong></div>
              {roundingAdjustment > 0n && <p className="checkout-rounding-note">The backend will adjust the final USD equivalent by {formatMinor(roundingAdjustment)} to settle the invoice exactly.</p>}
              {checkout.quote.error && <p className="checkout-validation" role="status">{checkout.quote.error}</p>}
              <Button variant="primary" fullWidth disabled={!canPay} onClick={() => void checkout.submitCheckout()}>
                {checkout.submitting ? <><span className="async-state__spinner" />Completing payment…</> : <><Icon name="receipt_long" />Complete Invoice</>}
              </Button>
              <p className="checkout-no-gateway-note">CASH and VISA are recorded as payment methods. No card information or authorization is collected.</p>
            </> : <>
              <Chip tone={invoice.status === 'PAID' ? 'success' : 'error'}>{invoice.status === 'PAID' ? 'Payment complete' : 'Payment unavailable'}</Chip>
              <p className="checkout-terminal-message">{invoice.status === 'PAID' ? 'This invoice has already been paid and cannot be checked out again.' : 'Cancelled invoices cannot be paid.'}</p>
              {checkout.checkoutConfirmed && <Button variant="primary" fullWidth onClick={() => navigate(`/invoices/${invoice.id}`)}><Icon name="description" />View Invoice Details</Button>}
              {invoice.status === 'PAID' && checkout.payments.length === 0 && <Button variant="secondary" fullWidth onClick={() => void checkout.reload()}>Reload payment records</Button>}
            </>}
          </Card>
        </aside>
      </div>
    </PageContainer>
  );
}

function RateOption({ currency, rateLabel, source, effectiveAt, selected, unavailable = false }: {
  currency: CheckoutCurrency; rateLabel: string | null; source: string | null; effectiveAt: string | null; selected: boolean; unavailable?: boolean;
}) {
  const info = currencyInfo[currency];
  return <div className={`checkout-rate-option${selected ? ' checkout-rate-option--selected' : ''}${unavailable ? ' checkout-rate-option--disabled' : ''}`} aria-label={`${currency} ${unavailable ? 'unavailable' : selected ? 'selected' : 'available'}`}>
    <span className="checkout-rate-dot" aria-hidden="true">{selected ? '●' : unavailable ? '○' : '◯'}</span>
    <div className="checkout-rate-option__copy"><strong>{currency} ({info.sign}) <small>{info.name}</small></strong><span>{unavailable ? 'No current rate configured' : `Rate: ${rateLabel} ${currency} per 1 USD · ${source}`}</span>{effectiveAt && <time dateTime={effectiveAt}>Effective {formatOperationalDateTime(effectiveAt)} Cairo</time>}</div>
    <strong className="checkout-rate-option__rate">{unavailable ? 'Unavailable' : rateLabel}</strong>
  </div>;
}

function PaymentEntry({ entry, index, rate, equivalent, ratesLoading, eurAvailable, egpAvailable, currencyUnavailable, onChangeCurrency, onChangeMethod, onChangeAmount, onRemove, canRemove }: {
  entry: PaymentDraft; index: number; rate: { rateToUsd: string; source: string; effectiveFrom: string } | null; equivalent: bigint | null;
  ratesLoading: boolean; eurAvailable: boolean; egpAvailable: boolean; currencyUnavailable: boolean; onChangeCurrency: (currency: CheckoutCurrency) => void;
  onChangeMethod: (method: PaymentMethod) => void; onChangeAmount: (amount: string) => void; onRemove: () => void; canRemove: boolean;
}) {
  const selectedRate = entry.currency === 'USD' ? '1.000000' : rate?.rateToUsd;
  const selectedSource = entry.currency === 'USD' ? 'BASE' : rate?.source;
  return <div className="checkout-payment-entry">
    <div className="checkout-payment-entry__heading"><strong>Payment {index + 1}</strong><button type="button" className="checkout-remove-entry" aria-label={`Remove payment ${index + 1}`} disabled={!canRemove} onClick={onRemove}><Icon name="delete" size={18} /></button></div>
    <label className="checkout-control"><span>Currency</span><select value={entry.currency} onChange={(event) => onChangeCurrency(event.target.value as CheckoutCurrency)}>
      <option value="USD">USD · US Dollar</option>
      <option value="EUR" disabled={ratesLoading || !eurAvailable}>EUR · Euro{!eurAvailable ? ' (no current rate)' : ''}</option>
      <option value="EGP" disabled={ratesLoading || !egpAvailable}>EGP · Egyptian Pound{!egpAvailable ? ' (no current rate)' : ''}</option>
    </select></label>
    <div className="checkout-payment-entry__columns">
      <label className="checkout-control"><span>Payment method</span><select value={entry.paymentMethod} onChange={(event) => onChangeMethod(event.target.value as PaymentMethod)}><option value="CASH">CASH</option><option value="VISA">VISA</option></select></label>
      <label className="checkout-control"><span>Amount applied ({entry.currency})</span><input type="text" inputMode="decimal" autoComplete="off" placeholder="0.00" value={entry.amountApplied} onChange={(event) => onChangeAmount(event.target.value)} aria-label={`Amount applied for payment ${index + 1}`} /></label>
    </div>
    <div className="checkout-payment-entry__conversion"><span>{currencyUnavailable ? 'Current exchange rate unavailable' : `Rate ${selectedRate ?? '—'} · ${selectedSource ?? '—'}`}</span><strong>USD equivalent: {equivalent === null ? '—' : formatMinor(equivalent)}</strong></div>
    {rate?.effectiveFrom && <small className="checkout-payment-entry__effective">Rate effective {formatOperationalDateTime(rate.effectiveFrom)} Cairo</small>}
  </div>;
}
