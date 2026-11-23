import type { InvoiceDetail, InvoicePayment } from '../domain/invoice';
import { decimalToMinor, formatMinor, formatUsd } from '../domain/invoice';
import { formatOperationalDateTime } from '../../../shared/date/reportingDate';

export type PrintMode = 'bill' | 'receipt';
const money = (value: string, currency: InvoicePayment['currency']) => {
  const minor = decimalToMinor(value, 2);
  return minor === null ? `${value} ${currency}` : formatMinor(minor, currency);
};

export function InvoicePrintDocument({ invoice, payments, mode, className = '' }: { invoice: InvoiceDetail; payments: InvoicePayment[]; mode: PrintMode; className?: string }) {
  return <article className={`invoice-print ${className}`}>
    <header className="invoice-print__header"><p>Nile Villas Hotel</p><h2>{mode === 'bill' ? 'UNPAID BILL' : 'PAID GUEST RECEIPT'}</h2><div>{invoice.invoiceNumber}</div><time>{formatOperationalDateTime(mode === 'receipt' && invoice.completedAt ? invoice.completedAt : invoice.createdAt)}</time></header>
    <table className="invoice-print__items"><thead><tr><th>Item</th><th>Qty</th><th>Amount</th></tr></thead><tbody>{invoice.items.map((item) => <tr key={item.id}><td>{item.productNameSnapshot}</td><td>{item.quantity}</td><td>{formatUsd(item.lineTotalUsd)}</td></tr>)}</tbody></table>
    <div className="invoice-print__total"><span>Total USD</span><strong>{formatUsd(invoice.totalAmountUsd)}</strong></div>
    {mode === 'receipt' && <section className="invoice-print__payments"><h3>Payment</h3>{payments.map((payment) => <div key={payment.id}><span>{money(payment.amountApplied, payment.currency)} · {payment.paymentMethod} · rate {payment.exchangeRate}</span><strong>{formatUsd(payment.amountUsdEquivalent)}</strong></div>)}</section>}
    <footer>Thank you for staying with us.</footer>
  </article>;
}
