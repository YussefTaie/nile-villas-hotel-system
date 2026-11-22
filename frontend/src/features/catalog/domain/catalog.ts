export interface Category {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: number;
  categoryId: number;
  name: string;
  description: string | null;
  unitPriceUsd: string;
  isAvailable: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryDraft {
  name: string;
  description: string | null;
  displayOrder?: number;
}

export interface ProductDraft {
  categoryId: number;
  name: string;
  description: string | null;
  unitPriceUsd: string;
}
