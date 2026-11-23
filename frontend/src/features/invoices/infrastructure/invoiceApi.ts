import { request } from '../../../shared/api/apiClient';
import type { CheckoutPaymentInput, InvoiceDetail, InvoiceListQuery, InvoicePage, InvoicePayment, InvoiceTip } from '../domain/invoice';
import type { InvoiceRepository } from '../application/InvoiceRepository';

interface InvoiceResponse {
  id: number; invoice_number: string; status: InvoiceDetail['status']; total_amount_usd: string;
  created_at: string; updated_at: string; completed_at: string | null; cancelled_at: string | null;
}
interface ItemResponse {
  id: number; invoice_id: number; product_id: number | null; product_name_snapshot: string;
  category_name_snapshot: string; unit_price_usd: string; quantity: number; line_total_usd: string; created_at: string;
}
interface DetailResponse extends InvoiceResponse { items: ItemResponse[] }
interface TipResponse {
  id: number; invoice_id: number | null; currency: InvoiceTip['currency']; amount_received: string;
  exchange_rate: string; amount_usd_equivalent: string; rate_source: InvoiceTip['rateSource'];
  payment_method: InvoiceTip['paymentMethod']; created_at: string;
}
interface InvoicePageResponse {
  items: InvoiceResponse[]; total: number; offset: number; limit: number;
}
interface PaymentResponse {
  id: number; invoice_id: number; currency: InvoicePayment['currency']; amount_applied: string;
  exchange_rate: string; amount_usd_equivalent: string; rate_source: InvoicePayment['rateSource'];
  payment_method: InvoicePayment['paymentMethod']; created_at: string;
}

function mapInvoice(value: InvoiceResponse) {
  return {
    id: value.id, invoiceNumber: value.invoice_number, status: value.status,
    totalAmountUsd: value.total_amount_usd, createdAt: value.created_at,
    updatedAt: value.updated_at, completedAt: value.completed_at, cancelledAt: value.cancelled_at,
  };
}

function mapDetail(value: DetailResponse): InvoiceDetail {
  return {
    ...mapInvoice(value),
    items: value.items.map((item) => ({
      id: item.id, invoiceId: item.invoice_id, productId: item.product_id,
      productNameSnapshot: item.product_name_snapshot, categoryNameSnapshot: item.category_name_snapshot,
      unitPriceUsd: item.unit_price_usd, quantity: item.quantity, lineTotalUsd: item.line_total_usd,
    })),
  };
}

export const invoiceApi: InvoiceRepository = {
  async create() {
    const value = await request<InvoiceResponse>('/invoices', { method: 'POST' });
    return { id: value.id, invoiceNumber: value.invoice_number };
  },
  async listInvoices(query: InvoiceListQuery) {
    const params = new URLSearchParams({ offset: String(query.offset), limit: String(query.limit) });
    if (query.status) params.set('status', query.status);
    if (query.invoiceNumber) params.set('invoice_number', query.invoiceNumber);
    if (query.createdFrom) params.set('created_from', query.createdFrom);
    if (query.createdTo) params.set('created_to', query.createdTo);
    const page = await request<InvoicePageResponse>(`/invoices?${params.toString()}`);
    return { ...page, items: page.items.map(mapInvoice) } satisfies InvoicePage;
  },
  async get(invoiceId) { return mapDetail(await request<DetailResponse>(`/invoices/${invoiceId}`)); },
  async listPayments(invoiceId) {
    const payments = await request<PaymentResponse[]>(`/invoices/${invoiceId}/payments`);
    return payments.map((payment) => ({
      id: payment.id, invoiceId: payment.invoice_id, currency: payment.currency,
      amountApplied: payment.amount_applied, exchangeRate: payment.exchange_rate,
      amountUsdEquivalent: payment.amount_usd_equivalent, rateSource: payment.rate_source,
      paymentMethod: payment.payment_method, createdAt: payment.created_at,
    }));
  },
  async listTips(invoiceId) {
    const tips = await request<TipResponse[]>(`/invoices/${invoiceId}/tips`);
    return tips.map((tip) => ({
      id: tip.id, invoiceId: tip.invoice_id, currency: tip.currency,
      amountReceived: tip.amount_received, exchangeRate: tip.exchange_rate,
      amountUsdEquivalent: tip.amount_usd_equivalent, rateSource: tip.rate_source,
      paymentMethod: tip.payment_method, createdAt: tip.created_at,
    }));
  },
  async checkout(invoiceId, payments: CheckoutPaymentInput[]) {
    const value = await request<InvoiceResponse>(`/invoices/${invoiceId}/checkout`, {
      method: 'POST', body: JSON.stringify({ payments }),
    });
    return value.status;
  },
  async addItem(invoiceId, productId, quantity) {
    return mapDetail(await request<DetailResponse>(`/invoices/${invoiceId}/items`, {
      method: 'POST', body: JSON.stringify({ product_id: productId, quantity }),
    }));
  },
  async updateItem(invoiceId, itemId, quantity) {
    return mapDetail(await request<DetailResponse>(`/invoices/${invoiceId}/items/${itemId}`, {
      method: 'PATCH', body: JSON.stringify({ quantity }),
    }));
  },
  async removeItem(invoiceId, itemId) {
    return mapDetail(await request<DetailResponse>(`/invoices/${invoiceId}/items/${itemId}`, { method: 'DELETE' }));
  },
};
