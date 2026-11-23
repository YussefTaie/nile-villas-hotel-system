import { request } from '../../../shared/api/apiClient';
import type { TipCreateInput, TipListQuery, Tip, TipPage } from '../domain/tip';
import type { TipRepository } from '../application/TipRepository';

interface TipResponse {
  id: number; invoice_id: number | null; currency: Tip['currency']; amount_received: string;
  exchange_rate: string; amount_usd_equivalent: string; rate_source: Tip['rateSource'];
  payment_method: Tip['paymentMethod']; created_at: string;
}
interface TipPageResponse { items: TipResponse[]; total: number; offset: number; limit: number }
interface InvoiceNumberResponse { invoice_number: string }

function mapTip(value: TipResponse, invoiceNumber: string | null = null): Tip {
  return {
    id: value.id, invoiceId: value.invoice_id, invoiceNumber, currency: value.currency,
    amountReceived: value.amount_received, exchangeRate: value.exchange_rate,
    amountUsdEquivalent: value.amount_usd_equivalent, rateSource: value.rate_source,
    paymentMethod: value.payment_method, createdAt: value.created_at,
  };
}

function mapCreate(input: TipCreateInput) {
  return {
    ...(input.invoiceId === null ? {} : { invoice_id: input.invoiceId }),
    currency: input.currency, amount_received: input.amountReceived,
    exchange_rate: input.exchangeRate, amount_usd_equivalent: input.amountUsdEquivalent,
    rate_source: input.rateSource, payment_method: input.paymentMethod,
  };
}

export const tipApi: TipRepository = {
  async list(query: TipListQuery): Promise<TipPage> {
    const params = new URLSearchParams({ offset: String(query.offset), limit: String(query.limit) });
    if (query.invoiceId !== undefined) params.set('invoice_id', String(query.invoiceId));
    if (query.currency) params.set('currency', query.currency);
    if (query.paymentMethod) params.set('payment_method', query.paymentMethod);
    if (query.createdFrom) params.set('created_from', query.createdFrom);
    if (query.createdTo) params.set('created_to', query.createdTo);
    const page = await request<TipPageResponse>(`/tips?${params.toString()}`);
    const invoiceIds = [...new Set(page.items.flatMap((tip) => tip.invoice_id === null ? [] : [tip.invoice_id]))];
    const invoiceNumbers = new Map<number, string>();
    await Promise.all(invoiceIds.map(async (id) => {
      try {
        const invoice = await request<InvoiceNumberResponse>(`/invoices/${id}`);
        invoiceNumbers.set(id, invoice.invoice_number);
      } catch { /* Preserve the tip row even if its optional invoice label cannot load. */ }
    }));
    return { ...page, items: page.items.map((tip) => mapTip(tip, tip.invoice_id === null ? null : invoiceNumbers.get(tip.invoice_id) ?? null)) };
  },
  async create(input) {
    const tip = await request<TipResponse>('/tips', { method: 'POST', body: JSON.stringify(mapCreate(input)) });
    let invoiceNumber: string | null = null;
    if (tip.invoice_id !== null) {
      try { invoiceNumber = (await request<InvoiceNumberResponse>(`/invoices/${tip.invoice_id}`)).invoice_number; } catch { /* Creation is authoritative; the optional label can be reloaded later. */ }
    }
    return mapTip(tip, invoiceNumber);
  },
};
