import type { Category, CategoryDraft, Product, ProductDraft } from '../domain/catalog';

export interface CatalogRepository {
  listCategories(): Promise<Category[]>;
  createCategory(draft: CategoryDraft): Promise<Category>;
  updateCategory(categoryId: number, draft: CategoryDraft): Promise<Category>;
  setCategoryActive(categoryId: number, isActive: boolean): Promise<Category>;
  listProducts(): Promise<Product[]>;
  createProduct(draft: ProductDraft): Promise<Product>;
  updateProduct(productId: number, draft: ProductDraft): Promise<Product>;
  setProductActive(productId: number, isActive: boolean): Promise<Product>;
  setProductAvailable(productId: number, isAvailable: boolean): Promise<Product>;
}
