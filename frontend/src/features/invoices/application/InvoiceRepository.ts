import type { CheckoutPaymentInput, InvoiceDetail, InvoiceListQuery, InvoicePage, InvoicePayment, InvoiceTip } from '../domain/invoice';

export interface InvoiceRepository {
  create(): Promise<{ id: number; invoiceNumber: string }>;
  listInvoices(query: InvoiceListQuery): Promise<InvoicePage>;
  get(invoiceId: number): Promise<InvoiceDetail>;
  listPayments(invoiceId: number): Promise<InvoicePayment[]>;
  listTips(invoiceId: number): Promise<InvoiceTip[]>;
  checkout(invoiceId: number, payments: CheckoutPaymentInput[]): Promise<InvoiceDetail['status']>;
  addItem(invoiceId: number, productId: number, quantity: number): Promise<InvoiceDetail>;
  updateItem(invoiceId: number, itemId: number, quantity: number): Promise<InvoiceDetail>;
  removeItem(invoiceId: number, itemId: number): Promise<InvoiceDetail>;
}
