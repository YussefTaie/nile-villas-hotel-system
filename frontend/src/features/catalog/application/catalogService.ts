import type { CatalogRepository } from './CatalogRepository';
import type { CategoryDraft, ProductDraft } from '../domain/catalog';

export function createCatalogService(repository: CatalogRepository) {
  return {
    async loadCatalog() {
      const [categories, products] = await Promise.all([
        repository.listCategories(),
        repository.listProducts(),
      ]);
      return { categories, products };
    },
    createCategory: (draft: CategoryDraft) => repository.createCategory(draft),
    updateCategory: (id: number, draft: CategoryDraft) => repository.updateCategory(id, draft),
    setCategoryActive: (id: number, active: boolean) => repository.setCategoryActive(id, active),
    createProduct: (draft: ProductDraft) => repository.createProduct(draft),
    updateProduct: (id: number, draft: ProductDraft) => repository.updateProduct(id, draft),
    setProductActive: (id: number, active: boolean) => repository.setProductActive(id, active),
    setProductAvailable: (id: number, available: boolean) => repository.setProductAvailable(id, available),
  };
}
