import type { InvoiceRepository } from './InvoiceRepository';

export function createInvoiceService(repository: InvoiceRepository) {
  return {
    create: () => repository.create(),
    listInvoices: (query: Parameters<typeof repository.listInvoices>[0]) => repository.listInvoices(query),
    get: (invoiceId: number) => repository.get(invoiceId),
    listPayments: (invoiceId: number) => repository.listPayments(invoiceId),
    listTips: (invoiceId: number) => repository.listTips(invoiceId),
    checkout: (invoiceId: number, payments: Parameters<typeof repository.checkout>[1]) => repository.checkout(invoiceId, payments),
    addItem: (invoiceId: number, productId: number, quantity: number) => repository.addItem(invoiceId, productId, quantity),
    updateItem: (invoiceId: number, itemId: number, quantity: number) => repository.updateItem(invoiceId, itemId, quantity),
    removeItem: (invoiceId: number, itemId: number) => repository.removeItem(invoiceId, itemId),
  };
}
