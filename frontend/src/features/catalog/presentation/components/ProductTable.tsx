import type { ReactNode } from 'react';
import type { Category, Product } from '../../domain/catalog';
import { Button } from '../../../../shared/ui/Button';
import { Chip } from '../../../../shared/ui/Chip';
import { Icon } from '../../../../shared/ui/Icon';
import { IconButton } from '../../../../shared/ui/IconButton';
import { DataTable, TableCell, TableEmptyRow, TableHeader } from '../../../../shared/ui/Table';
import { ToggleSwitch } from '../../../../shared/ui/ToggleSwitch';

const usdFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function formatUpdatedAt(value: string): string {
  const updatedAt = new Date(value);
  if (Number.isNaN(updatedAt.valueOf())) return '—';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const updateDay = new Date(updatedAt.getFullYear(), updatedAt.getMonth(), updatedAt.getDate());
  const dayDifference = Math.round((today.valueOf() - updateDay.valueOf()) / 86_400_000);
  const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(updatedAt);
  if (dayDifference === 0) return `Today, ${time}`;
  if (dayDifference === 1) return `Yesterday, ${time}`;
  if (dayDifference > 1 && dayDifference < 7) return `${dayDifference} days ago`;
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: '2-digit' }).format(updatedAt);
}

interface ProductTableProps {
  products: Product[];
  categories: Category[];
  page: number;
  pageSize: number;
  pending: boolean;
  onPageChange: (page: number) => void;
  onEdit: (product: Product) => void;
  onToggleActive: (product: Product) => void;
  onToggleAvailable: (product: Product, available: boolean) => void;
  emptyMessage?: ReactNode;
}

export function ProductTable({ products, categories, page, pageSize, pending, onPageChange, onEdit, onToggleActive, onToggleAvailable, emptyMessage = 'No products match this view.' }: ProductTableProps) {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const pageCount = Math.max(1, Math.ceil(products.length / pageSize));
  const visibleProducts = products.slice((page - 1) * pageSize, page * pageSize);
  const firstItem = products.length ? (page - 1) * pageSize + 1 : 0;
  const lastItem = Math.min(page * pageSize, products.length);

  return (
    <section className="product-table-panel" aria-label="Product catalog">
      <DataTable className="product-table">
        <thead><tr>
          <TableHeader>Product Name</TableHeader>
          <TableHeader>Category</TableHeader>
          <TableHeader className="product-table__price-header">Price (USD)</TableHeader>
          <TableHeader>Status</TableHeader>
          <TableHeader>Availability</TableHeader>
          <TableHeader>Last Updated</TableHeader>
          <TableHeader className="product-table__actions-header">Actions</TableHeader>
        </tr></thead>
        <tbody>
          {visibleProducts.length ? visibleProducts.map((product) => {
            const category = categoryById.get(product.categoryId);
            return (
              <tr key={product.id}>
                <TableCell>
                  <div className="product-row__name-cell">
                    <span className="product-row__icon" aria-hidden="true"><Icon name="restaurant_menu" /></span>
                    <span className="product-row__copy">
                      <span className="product-row__name">{product.name}</span>
                      {product.description && <span className="product-row__description" title={product.description}>{product.description}</span>}
                    </span>
                  </div>
                </TableCell>
                <TableCell>{category ? <Chip tone={category.isActive ? 'category' : 'neutral'}>{category.name}</Chip> : <span className="product-table__muted">Unknown category</span>}</TableCell>
                <TableCell className="product-table__price">{usdFormatter.format(Number(product.unitPriceUsd))}</TableCell>
                <TableCell><Chip tone={product.isActive ? 'success' : 'neutral'}><span className="status-dot" />{product.isActive ? 'Active' : 'Inactive'}</Chip></TableCell>
                <TableCell>
                  <ToggleSwitch compact checked={product.isAvailable} label={product.isAvailable ? 'Available' : 'Unavailable'} disabled={pending} onChange={(available) => onToggleAvailable(product, available)} />
                </TableCell>
                <TableCell className="product-table__updated">{formatUpdatedAt(product.updatedAt)}</TableCell>
                <TableCell className="product-table__actions">
                  <IconButton icon="edit" label={`Edit ${product.name}`} disabled={pending} onClick={() => onEdit(product)} />
                  <Button className="product-table__status-action" variant="quiet" disabled={pending} onClick={() => onToggleActive(product)}>
                    <Icon name={product.isActive ? 'toggle_on' : 'toggle_off'} />
                    <span className="visually-hidden">{product.isActive ? 'Deactivate' : 'Activate'} product</span>
                  </Button>
                </TableCell>
              </tr>
            );
          }) : <TableEmptyRow columns={7}>{emptyMessage}</TableEmptyRow>}
        </tbody>
      </DataTable>

      <div className="product-table-footer">
        <span>Displaying {firstItem}–{lastItem} of {products.length} menu items</span>
        {products.length > pageSize && <nav className="product-pagination" aria-label="Product pages">
          <Button variant="quiet" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Previous</Button>
          {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
            <button key={pageNumber} type="button" className={`product-pagination__page${pageNumber === page ? ' product-pagination__page--active' : ''}`} aria-current={pageNumber === page ? 'page' : undefined} onClick={() => onPageChange(pageNumber)}>{pageNumber}</button>
          ))}
          <Button variant="quiet" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>Next</Button>
        </nav>}
      </div>
    </section>
  );
}
