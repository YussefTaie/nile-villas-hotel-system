import { request } from '../../../shared/api/apiClient';
import type { InvoiceDetail } from '../domain/invoice';
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

function mapDetail(value: DetailResponse): InvoiceDetail {
  return {
    id: value.id, invoiceNumber: value.invoice_number, status: value.status,
    totalAmountUsd: value.total_amount_usd, createdAt: value.created_at,
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
  async get(invoiceId) { return mapDetail(await request<DetailResponse>(`/invoices/${invoiceId}`)); },
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
