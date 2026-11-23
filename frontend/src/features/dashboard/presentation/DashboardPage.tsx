import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ErrorState, LoadingState } from '../../../shared/ui/AsyncState';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { Icon } from '../../../shared/ui/Icon';
import { PageContainer } from '../../../shared/ui/PageContainer';
import { PageHeading } from '../../../shared/ui/PageHeading';
import { decimalToMinor, formatMinor, formatUsd } from '../../invoices/domain/invoice';
import { formatOperationalDateTime } from '../../../shared/date/reportingDate';
import type { CurrencyFinancialSummary, DashboardCurrency, TransactionSummary } from '../domain/dashboard';
import { useDashboardSummary } from './hooks/useDashboardSummary';
import './dashboard.css';

function cairoToday(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const value = (name: string) => parts.find((part) => part.type === name)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function isDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function currencyAmount(value: string, currency: DashboardCurrency) {
  const minor = decimalToMinor(value, 2);
  const amount = minor === null ? `${value} ${currency}` : formatMinor(minor, currency);
  return `${amount} ${currency}`;
}

function CurrencyBreakdown({ summary }: { summary: TransactionSummary }) {
  if (summary.byCurrency.length === 0) return <p className="dashboard__no-breakdown">No records in this period.</p>;
  return <div className="dashboard__currency-list">{summary.byCurrency.map((row: CurrencyFinancialSummary) => <div className="dashboard__currency-row" key={row.currency}>
    <div><strong>{row.currency}</strong><span>{row.recordCount} {row.recordCount === 1 ? 'record' : 'records'}</span></div>
    <div className="dashboard__currency-values"><span>Original {currencyAmount(row.originalAmount, row.currency)}</span><span>USD equivalent {formatUsd(row.amountUsdEquivalent)}</span></div>
  </div>)}</div>;
}

export function DashboardPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const today = useMemo(cairoToday, []);
  const startDate = params.get('start_date') ?? today;
  const endDate = params.get('end_date') ?? today;
  const startValid = isDateOnly(startDate);
  const endValid = isDateOnly(endDate);
  const validRange = startValid && endValid && startDate <= endDate;
  const data = useDashboardSummary(startDate, endDate, validRange);
  const updateDate = (key: 'start_date' | 'end_date', value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
  };
  const periodLabel = (start: string, end: string) => start === end
    ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${start}T12:00:00Z`))
    : `${formatOperationalDateTime(`${start}T12:00:00Z`).split(',')[0]} – ${formatOperationalDateTime(`${end}T12:00:00Z`).split(',')[0]}`;
  const summary = data.summary;
  const noActivity = Boolean(summary && summary.invoiceSales.completedInvoiceCount === 0 && summary.paymentCollections.recordCount === 0 && summary.tips.recordCount === 0);

  return <PageContainer>
    <PageHeading title="Dashboard" description="Financial activity for the selected reporting period." />
    <Card className="dashboard__welcome">
      <div className="dashboard__welcome-copy"><div className="dashboard__eyebrow"><span>Financial Summary</span><span aria-hidden="true">•</span><span>Base Currency USD</span></div><h2>Nile Villas Overview</h2><p>{summary ? `${periodLabel(summary.period.startDate, summary.period.endDate)} · ${summary.period.timezone}` : `Reporting dates use Africa/Cairo`}</p></div>
      <div className="dashboard__period" aria-label="Reporting period">
        <label>From<input aria-label="Start date" type="date" value={startDate} max={endDate} onChange={(event) => updateDate('start_date', event.target.value)} /></label>
        <label>To<input aria-label="End date" type="date" value={endDate} min={startDate} onChange={(event) => updateDate('end_date', event.target.value)} /></label>
      </div>
      <div className="dashboard__welcome-actions"><Button onClick={() => data.reload()} disabled={!validRange || data.loading}><Icon name="refresh" />Refresh</Button><Button variant="primary" onClick={() => navigate('/invoices/new')}><Icon name="add" />Create Invoice</Button><Link className="dashboard__history-link" to="/invoices"><Icon name="history" />Invoice History</Link></div>
    </Card>
    {!startValid || !endValid ? <Card className="dashboard__error"><ErrorState message="Choose valid start and end dates." /></Card> : startDate > endDate ? <Card className="dashboard__error"><ErrorState message="Start date must be on or before end date." /></Card> : data.loading ? <Card className="dashboard__loading"><LoadingState label="Loading financial summary…" /></Card> : data.error ? <Card className="dashboard__error"><ErrorState message={data.error} action={<Button onClick={data.reload}>Try again</Button>} /></Card> : summary && <>
      {noActivity && <p className="dashboard__empty-period" role="status">No financial activity for this period. The zero values below are from the reporting API.</p>}
      <section className="dashboard__metrics" aria-label="Financial summary">
        <Card className="dashboard__metric"><div className="dashboard__metric-head"><span className="dashboard__metric-label">Invoice Sales</span><span className="dashboard__metric-icon"><Icon name="receipt_long" size={22} /></span></div><strong className="dashboard__metric-value">{formatUsd(summary.invoiceSales.totalSalesUsd)}</strong><div className="dashboard__metric-foot"><span>Completed invoices</span><strong>{summary.invoiceSales.completedInvoiceCount}</strong></div><p className="dashboard__metric-note">Based on completed invoices in the selected period.</p></Card>
        <Card className="dashboard__metric"><div className="dashboard__metric-head"><span className="dashboard__metric-label">Payment Collections</span><span className="dashboard__metric-icon"><Icon name="payments" size={22} /></span></div><strong className="dashboard__metric-value">{formatUsd(summary.paymentCollections.totalAmountUsdEquivalent)}</strong><div className="dashboard__metric-foot"><span>Payment records</span><strong>{summary.paymentCollections.recordCount}</strong></div><CurrencyBreakdown summary={summary.paymentCollections} /><p className="dashboard__metric-note">Based on payment record dates. Separate from invoice sales.</p></Card>
        <Card className="dashboard__metric"><div className="dashboard__metric-head"><span className="dashboard__metric-label">Tips</span><span className="dashboard__metric-icon"><Icon name="volunteer_activism" size={22} /></span></div><strong className="dashboard__metric-value">{formatUsd(summary.tips.totalAmountUsdEquivalent)}</strong><div className="dashboard__metric-foot"><span>Tip records</span><strong>{summary.tips.recordCount}</strong></div><CurrencyBreakdown summary={summary.tips} /><p className="dashboard__metric-note">Independent tip transactions. Never included in invoice totals.</p></Card>
      </section>
    </>}
    <Card className="dashboard__quick-actions"><div className="dashboard__section-title"><h2>Quick Actions</h2><Icon name="bolt" size={20} /></div><div className="dashboard__actions-grid">
      <ActionLink to="/products" icon="restaurant_menu" title="Product Management" detail="Manage the product catalog" tone="gold" />
      <ActionLink to="/tips" icon="volunteer_activism" title="Tips History" detail="Review tip transactions" tone="green" />
      <ActionLink to="/settings/exchange-rates" icon="currency_exchange" title="Exchange Rates" detail="View and manage current rates" tone="neutral" />
    </div></Card>
  </PageContainer>;
}

function ActionLink({ to, icon, title, detail, tone }: { to: string; icon: string; title: string; detail: string; tone: 'gold' | 'green' | 'neutral' }) {
  return <Link className="dashboard__action" to={to}><span className={`dashboard__action-icon dashboard__action-icon--${tone}`}><Icon name={icon} /></span><span className="dashboard__action-copy"><strong>{title}</strong><small>{detail}</small></span><Icon name="chevron_right" size={18} /></Link>;
}
