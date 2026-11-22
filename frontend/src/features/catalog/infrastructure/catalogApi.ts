import { request } from '../../../shared/api/apiClient';
import type { Category, CategoryDraft, Product, ProductDraft } from '../domain/catalog';
import type { CatalogRepository } from '../application/CatalogRepository';

interface CategoryResponse {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

interface ProductResponse {
  id: number;
  category_id: number;
  name: string;
  description: string | null;
  unit_price_usd: string;
  is_available: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function mapCategory(response: CategoryResponse): Category {
  return {
    id: response.id,
    name: response.name,
    description: response.description,
    isActive: response.is_active,
    displayOrder: response.display_order,
    createdAt: response.created_at,
    updatedAt: response.updated_at,
  };
}

function mapProduct(response: ProductResponse): Product {
  return {
    id: response.id,
    categoryId: response.category_id,
    name: response.name,
    description: response.description,
    unitPriceUsd: response.unit_price_usd,
    isAvailable: response.is_available,
    isActive: response.is_active,
    createdAt: response.created_at,
    updatedAt: response.updated_at,
  };
}

function categoryRequest(draft: CategoryDraft) {
  return {
    name: draft.name,
    description: draft.description,
    ...(draft.displayOrder === undefined ? {} : { display_order: draft.displayOrder }),
  };
}

function productRequest(draft: ProductDraft) {
  return {
    category_id: draft.categoryId,
    name: draft.name,
    description: draft.description,
    unit_price_usd: draft.unitPriceUsd,
  };
}

export const catalogApi: CatalogRepository = {
  async listCategories() {
    const response = await request<CategoryResponse[]>('/categories');
    return response.map(mapCategory);
  },
  async createCategory(draft) {
    return mapCategory(await request<CategoryResponse>('/categories', {
      method: 'POST', body: JSON.stringify(categoryRequest(draft)),
    }));
  },
  async updateCategory(categoryId, draft) {
    return mapCategory(await request<CategoryResponse>(`/categories/${categoryId}`, {
      method: 'PATCH', body: JSON.stringify(categoryRequest(draft)),
    }));
  },
  async setCategoryActive(categoryId, isActive) {
    return mapCategory(await request<CategoryResponse>(`/categories/${categoryId}/activation`, {
      method: 'PATCH', body: JSON.stringify({ is_active: isActive }),
    }));
  },
  async listProducts() {
    const response = await request<ProductResponse[]>('/products');
    return response.map(mapProduct);
  },
  async createProduct(draft) {
    return mapProduct(await request<ProductResponse>('/products', {
      method: 'POST', body: JSON.stringify(productRequest(draft)),
    }));
  },
  async updateProduct(productId, draft) {
    return mapProduct(await request<ProductResponse>(`/products/${productId}`, {
      method: 'PATCH', body: JSON.stringify(productRequest(draft)),
    }));
  },
  async setProductActive(productId, isActive) {
    return mapProduct(await request<ProductResponse>(`/products/${productId}/activation`, {
      method: 'PATCH', body: JSON.stringify({ is_active: isActive }),
    }));
  },
  async setProductAvailable(productId, isAvailable) {
    return mapProduct(await request<ProductResponse>(`/products/${productId}/availability`, {
      method: 'PATCH', body: JSON.stringify({ is_available: isAvailable }),
    }));
  },
};
