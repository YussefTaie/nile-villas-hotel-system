import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../../../shared/api/ApiError';
import { catalogApi } from '../../infrastructure/catalogApi';
import { createCatalogService } from '../../application/catalogService';
import type { Category, CategoryDraft, Product, ProductDraft } from '../../domain/catalog';

const catalogService = createCatalogService(catalogApi);

function messageFrom(error: unknown): string {
  if (error instanceof ApiError) {
    if (Array.isArray(error.details)) {
      const messages = error.details
        .map((detail) => detail && typeof detail === 'object' && 'msg' in detail ? String(detail.msg) : '')
        .filter(Boolean);
      if (messages.length) return messages.join(' ');
    }
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}

export function useCatalog() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const refresh = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setLoadFailed(false);
    try {
      const catalog = await catalogService.loadCatalog();
      setCategories(catalog.categories);
      setProducts(catalog.products);
      setError(null);
      return true;
    } catch (loadError) {
      setLoadFailed(true);
      setError(messageFrom(loadError));
      return false;
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const mutate = useCallback(async (operation: () => Promise<unknown>, successMessage: string) => {
    if (pending) return false;
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      await operation();
      setNotice(successMessage);
      const refreshed = await refresh(false);
      if (!refreshed) setNotice(`${successMessage} The latest catalog could not be reloaded.`);
      return true;
    } catch (mutationError) {
      setError(messageFrom(mutationError));
      return false;
    } finally {
      setPending(false);
    }
  }, [pending, refresh]);

  return {
    categories, products, loading, loadFailed, error, notice, pending,
    refresh: () => refresh(), clearMessages: () => { setError(null); setNotice(null); },
    createCategory: (draft: CategoryDraft) => mutate(() => catalogService.createCategory(draft), 'Category created.'),
    updateCategory: (id: number, draft: CategoryDraft) => mutate(() => catalogService.updateCategory(id, draft), 'Category updated.'),
    setCategoryActive: (id: number, active: boolean) => mutate(() => catalogService.setCategoryActive(id, active), `Category ${active ? 'activated' : 'deactivated'}.`),
    createProduct: (draft: ProductDraft) => mutate(() => catalogService.createProduct(draft), 'Product created.'),
    updateProduct: (id: number, draft: ProductDraft) => mutate(() => catalogService.updateProduct(id, draft), 'Product updated.'),
    setProductActive: (id: number, active: boolean) => mutate(() => catalogService.setProductActive(id, active), `Product ${active ? 'activated' : 'deactivated'}.`),
    setProductAvailable: (id: number, available: boolean) => mutate(() => catalogService.setProductAvailable(id, available), `Product marked ${available ? 'available' : 'unavailable'}.`),
  };
}
