import { useRef, useState } from 'react';
import { ApiError } from '../../../../shared/api/ApiError';
import { createInvoiceService } from '../../application/invoiceService';
import { invoiceApi } from '../../infrastructure/invoiceApi';
import type { InvoiceDetail } from '../../domain/invoice';

const service = createInvoiceService(invoiceApi);

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (Array.isArray(error.details)) {
      const messages = error.details
        .map((item) => item && typeof item === 'object' && 'msg' in item ? String(item.msg) : '')
        .filter(Boolean);
      if (messages.length) return messages.join(' ');
    }
    return error.message;
  }
  return 'The invoice could not be updated. Please try again.';
}

export function useCreateInvoice() {
  const invoiceId = useRef<number | null>(null);
  const operationLock = useRef(false);
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function run(operation: (id: number) => Promise<InvoiceDetail>, success: string) {
    if (operationLock.current) return false;
    operationLock.current = true;
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      let id = invoiceId.current;
      if (id === null) {
        const created = await service.create();
        id = created.id;
        invoiceId.current = id;
      }
      const updated = await operation(id);
      setInvoice(updated);
      setNotice(success);
      return true;
    } catch (operationError) {
      const id = invoiceId.current;
      if (id !== null) {
        try { setInvoice(await service.get(id)); } catch { /* Keep the last confirmed screen state. */ }
      }
      setError(errorMessage(operationError));
      return false;
    } finally {
      operationLock.current = false;
      setPending(false);
    }
  }

  return {
    invoice, pending, error, notice,
    addProduct: (productId: number) => run((id) => {
      const current = invoice?.items.find((item) => item.productId === productId);
      return current
        ? service.updateItem(id, current.id, current.quantity + 1)
        : service.addItem(id, productId, 1);
    }, 'Invoice updated.'),
    updateQuantity: (itemId: number, quantity: number) => run((id) => service.updateItem(id, itemId, quantity), 'Quantity updated.'),
    removeItem: (itemId: number) => run((id) => service.removeItem(id, itemId), 'Item removed.'),
  };
}
