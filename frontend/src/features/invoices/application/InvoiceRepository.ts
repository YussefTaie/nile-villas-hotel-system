import type { InvoiceDetail } from '../domain/invoice';

export interface InvoiceRepository {
  create(): Promise<{ id: number; invoiceNumber: string }>;
  get(invoiceId: number): Promise<InvoiceDetail>;
  addItem(invoiceId: number, productId: number, quantity: number): Promise<InvoiceDetail>;
  updateItem(invoiceId: number, itemId: number, quantity: number): Promise<InvoiceDetail>;
  removeItem(invoiceId: number, itemId: number): Promise<InvoiceDetail>;
}
