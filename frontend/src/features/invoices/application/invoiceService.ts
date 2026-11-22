import type { InvoiceRepository } from './InvoiceRepository';

export function createInvoiceService(repository: InvoiceRepository) {
  return {
    create: () => repository.create(),
    get: (invoiceId: number) => repository.get(invoiceId),
    addItem: (invoiceId: number, productId: number, quantity: number) => repository.addItem(invoiceId, productId, quantity),
    updateItem: (invoiceId: number, itemId: number, quantity: number) => repository.updateItem(invoiceId, itemId, quantity),
    removeItem: (invoiceId: number, itemId: number) => repository.removeItem(invoiceId, itemId),
  };
}
