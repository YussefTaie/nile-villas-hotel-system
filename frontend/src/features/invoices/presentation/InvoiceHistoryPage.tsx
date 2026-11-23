import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ErrorState, EmptyState, LoadingState } from '../../../shared/ui/AsyncState';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { Chip } from '../../../shared/ui/Chip';
import { PageContainer } from '../../../shared/ui/PageContainer';
import { PageHeading } from '../../../shared/ui/PageHeading';
import { SearchField } from '../../../shared/ui/SearchField';
import { formatOperationalDateTime, reportingDateBoundary } from '../../../shared/date/reportingDate';
import type { Invoice, InvoiceListQuery } from '../domain/invoice';
import { formatUsd } from '../domain/invoice';
import { useInvoiceHistory } from './hooks/useInvoiceHistory';
import './invoiceHistory.css';

const PAGE_SIZE = 10;
const statusOptions = ['ALL', 'PAID', 'OPEN', 'CANCELLED'] as const;
type StatusFilter = typeof statusOptions[number];

function tone(status: Invoice['status']) {
  return status === 'PAID' ? 'success' : status === 'OPEN' ? 'warning' : 'neutral';
}

export function InvoiceHistoryPage() {
  const [params, setParams] = useSearchParams();
  const statusParam = params.get('status') as StatusFilter | null;
  const status: StatusFilter = statusOptions.includes(statusParam ?? 'ALL') ? statusParam ?? 'ALL' : 'ALL';
  const [searchDraft, setSearchDraft] = useState(params.get('invoice_number') ?? '');
  useEffect(() => setSearchDraft(params.get('invoice_number') ?? ''), [params]);
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const offset = Math.max(0, Number(params.get('offset')) || 0);
  const query: InvoiceListQuery = useMemo(() => ({
    status: status === 'ALL' ? undefined : status,
    invoiceNumber: params.get('invoice_number')?.trim() || undefined,
    createdFrom: from ? reportingDateBoundary(from, false) : undefined,
    createdTo: to ? reportingDateBoundary(to, true) : undefined,
    offset, limit: PAGE_SIZE,
  }), [status, params, from, to, offset]);
  const { page, loading, error, reload } = useInvoiceHistory(query);

  const update = (values: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values)) value ? next.set(key, value) : next.delete(key);
    next.set('offset', '0');
    setParams(next);
  };
  const applySearch = (event: FormEvent) => {
    event.preventDefault();
    update({ invoice_number: searchDraft.trim() || null });
  };
  const returnTo = `${location.pathname}${location.search}`;

  return <PageContainer>
    <PageHeading title="Invoice History" description="Find invoices and review their details." />
    <Card className="invoice-history__filters">
      <form className="invoice-history__search" onSubmit={applySearch}>
        <SearchField label="Search by invoice number" placeholder="Search invoice number" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} />
        <Button type="submit" variant="primary">Search</Button>
      </form>
      <label className="invoice-history__date">From<input type="date" value={from} max={to || undefined} onChange={(event) => update({ from: event.target.value || null })} /></label>
      <label className="invoice-history__date">To<input type="date" value={to} min={from || undefined} onChange={(event) => update({ to: event.target.value || null })} /></label>
      <div className="invoice-history__statuses" aria-label="Filter by status">
        {statusOptions.map((value) => <button type="button" key={value} className={`invoice-history__status${status === value ? ' is-active' : ''}`} onClick={() => update({ status: value === 'ALL' ? null : value })}>{value === 'ALL' ? 'All statuses' : value}</button>)}
      </div>
    </Card>
    <Card className="invoice-history__results">
      {loading ? <LoadingState label="Loading invoices…" /> : error ? <ErrorState message={error} action={<Button onClick={reload}>Try again</Button>} /> : page && page.items.length === 0 ? <EmptyState>{page.total === 0 ? 'No invoices match these filters.' : 'No invoices on this page.'}</EmptyState> : page && <>
        <div className="invoice-history__table-wrap"><table className="invoice-history__table"><thead><tr><th>Invoice</th><th>Created</th><th>Completed</th><th>Status</th><th className="numeric">Total (USD)</th><th>Actions</th></tr></thead><tbody>
          {page.items.map((invoice) => <tr key={invoice.id}><td><Link className="invoice-history__number" to={`/invoices/${invoice.id}?returnTo=${encodeURIComponent(returnTo)}`}>{invoice.invoiceNumber}</Link></td><td>{formatOperationalDateTime(invoice.createdAt)}</td><td>{formatOperationalDateTime(invoice.completedAt)}</td><td><Chip tone={tone(invoice.status)}>{invoice.status}</Chip></td><td className="numeric">{formatUsd(invoice.totalAmountUsd)}</td><td><div className="invoice-history__actions"><Link to={`/invoices/${invoice.id}?returnTo=${encodeURIComponent(returnTo)}`}>View</Link>{invoice.status === 'OPEN' && <Link to={`/invoices/${invoice.id}?print=bill&returnTo=${encodeURIComponent(returnTo)}`}>Print bill</Link>}{invoice.status === 'PAID' && <Link to={`/invoices/${invoice.id}?print=receipt&returnTo=${encodeURIComponent(returnTo)}`}>Print receipt</Link>}</div></td></tr>)}
        </tbody></table></div>
        <div className="invoice-history__pagination"><span>{page.total ? `${offset + 1}–${Math.min(offset + page.items.length, page.total)} of ${page.total}` : '0 results'}</span><div><Button disabled={offset <= 0} onClick={() => setParams((current) => { const next = new URLSearchParams(current); next.set('offset', String(Math.max(0, offset - PAGE_SIZE))); return next; })}>Previous</Button><Button disabled={offset + PAGE_SIZE >= page.total} onClick={() => setParams((current) => { const next = new URLSearchParams(current); next.set('offset', String(offset + PAGE_SIZE)); return next; })}>Next</Button></div></div>
      </>}
    </Card>
  </PageContainer>;
}
