import { useMemo, useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '../../../shared/ui/AsyncState';
import { Button } from '../../../shared/ui/Button';
import { Card, MetricCard } from '../../../shared/ui/Card';
import { ConfirmDialog } from '../../../shared/ui/Dialog';
import { Icon } from '../../../shared/ui/Icon';
import { PageContainer } from '../../../shared/ui/PageContainer';
import { PageHeading } from '../../../shared/ui/PageHeading';
import { SearchField } from '../../../shared/ui/SearchField';
import type { Category, CategoryDraft, Product as ProductEntity, ProductDraft } from '../domain/catalog';
import { useCatalog } from './hooks/useCatalog';
import { CategoryManagementDialog } from './components/CategoryManagementDialog';
import { ProductFormDialog } from './components/ProductFormDialog';
import { ProductTable } from './components/ProductTable';
import './productManagement.css';

const PAGE_SIZE = 10;
type FilterValue = 'all' | `category-${number}`;
type ConfirmationTarget =
  | { type: 'product'; id: number; name: string; nextActive: boolean }
  | { type: 'category'; id: number; name: string; nextActive: boolean };

export function ProductManagementPage() {
  const catalog = useCatalog();
  const [filter, setFilter] = useState<FilterValue>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductEntity | null>(null);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationTarget | null>(null);

  const productCounts = useMemo(() => {
    const counts = new Map<number, { total: number; active: number; available: number }>();
    catalog.products.forEach((product) => {
      const count = counts.get(product.categoryId) ?? { total: 0, active: 0, available: 0 };
      count.total += 1;
      if (product.isActive) count.active += 1;
      if (product.isAvailable) count.available += 1;
      counts.set(product.categoryId, count);
    });
    return counts;
  }, [catalog.products]);
  const activeCount = catalog.products.filter((product) => product.isActive).length;
  const availableCount = catalog.products.filter((product) => product.isAvailable).length;

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return catalog.products.filter((product) => {
      const matchesCategory = filter === 'all' || product.categoryId === Number(filter.slice('category-'.length));
      const matchesSearch = !query || `${product.name} ${product.description ?? ''}`.toLocaleLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [catalog.products, filter, search]);

  function openCreateProduct() {
    catalog.clearMessages();
    setEditingProduct(null);
    setProductDialogOpen(true);
  }

  function openEditProduct(product: ProductEntity) {
    catalog.clearMessages();
    setEditingProduct(product);
    setProductDialogOpen(true);
  }

  async function saveProduct(productId: number | null, draft: ProductDraft) {
    return productId === null
      ? catalog.createProduct(draft)
      : catalog.updateProduct(productId, draft);
  }

  async function saveCategory(categoryId: number | null, draft: CategoryDraft) {
    return categoryId === null
      ? catalog.createCategory(draft)
      : catalog.updateCategory(categoryId, draft);
  }

  async function confirmStatusChange() {
    if (!confirmation) return;
    const result = confirmation.type === 'product'
      ? await catalog.setProductActive(confirmation.id, confirmation.nextActive)
      : await catalog.setCategoryActive(confirmation.id, confirmation.nextActive);
    if (result) setConfirmation(null);
  }

  function requestProductStatusChange(product: ProductEntity) {
    setConfirmation({ type: 'product', id: product.id, name: product.name, nextActive: !product.isActive });
  }

  function requestCategoryStatusChange(category: Category) {
    setConfirmation({ type: 'category', id: category.id, name: category.name, nextActive: !category.isActive });
  }

  function closeProductDialog() {
    setProductDialogOpen(false);
    setEditingProduct(null);
  }

  function openCategoryManager() {
    closeProductDialog();
    catalog.clearMessages();
    setCategoryDialogOpen(true);
  }

  const searchQuery = search.trim();

  return (
    <PageContainer>
      <PageHeading
        title="Product Management"
        description="Manage menu items and their USD base pricing."
        actions={<Button variant="primary" onClick={openCreateProduct}><Icon name="add" />Add New Product</Button>}
      />

      {!catalog.loading && !catalog.loadFailed && <section className="catalog-metrics" aria-label="Catalog summary">
        <MetricCard label="Total Menu Items" value={catalog.products.length} detail={`${activeCount} active · ${availableCount} available`} icon={<Icon name="restaurant_menu" />} />
        {catalog.categories.map((category) => {
          const count = productCounts.get(category.id) ?? { total: 0, active: 0, available: 0 };
          return <MetricCard key={category.id} label={category.name} value={count.total} detail={`${count.active} active · ${count.available} available`} icon={<Icon name="restaurant" />} />;
        })}
      </section>}

      <Card className="catalog-toolbar-card">
        <div className="catalog-toolbar">
          <div className="catalog-filters" role="group" aria-label="Filter products by category">
            <button type="button" className={`catalog-filter${filter === 'all' ? ' catalog-filter--active' : ''}`} aria-pressed={filter === 'all'} onClick={() => { setFilter('all'); setPage(1); }}>
              All Items <span>{catalog.products.length}</span>
            </button>
            {catalog.categories.map((category) => {
              const value: FilterValue = `category-${category.id}`;
              return <button type="button" className={`catalog-filter${filter === value ? ' catalog-filter--active' : ''}`} key={category.id} aria-pressed={filter === value} onClick={() => { setFilter(value); setPage(1); }}>
                {category.name} <span>{productCounts.get(category.id)?.total ?? 0}</span>
              </button>;
            })}
          </div>
          <div className="catalog-toolbar__right">
            <SearchField label="Search products by name or description" placeholder="Search products by name or description…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
            <Button variant="secondary" className="catalog-manage-button" onClick={() => { catalog.clearMessages(); setCategoryDialogOpen(true); }}><Icon name="tune" />Manage Categories</Button>
          </div>
        </div>
      </Card>

      {catalog.error && !catalog.loadFailed && <p className="catalog-message catalog-message--error" role="alert">{catalog.error}</p>}
      {catalog.notice && !catalog.loadFailed && <p className="catalog-message catalog-message--success" role="status">{catalog.notice}</p>}

      {catalog.loading ? <Card><LoadingState label="Loading catalog…" /></Card> : catalog.loadFailed ? (
        <Card><ErrorState message={catalog.error ?? 'Unable to load the catalog.'} action={<Button variant="secondary" onClick={() => void catalog.refresh()}>Try Again</Button>} /></Card>
      ) : catalog.products.length === 0 ? (
        <Card className="catalog-empty"><EmptyState>
          <Icon name="restaurant_menu" size={28} />
          <strong>No products in the catalog yet.</strong>
          <span>{catalog.categories.length ? 'Add a product to begin managing the menu.' : 'Create a category before adding your first product.'}</span>
          {!catalog.categories.length && <Button variant="secondary" onClick={() => setCategoryDialogOpen(true)}>Manage Categories</Button>}
        </EmptyState></Card>
      ) : (
        <ProductTable
          products={filteredProducts}
          categories={catalog.categories}
          page={page}
          pageSize={PAGE_SIZE}
          pending={catalog.pending}
          onPageChange={setPage}
          onEdit={openEditProduct}
          onToggleActive={requestProductStatusChange}
          onToggleAvailable={(product, available) => void catalog.setProductAvailable(product.id, available)}
          emptyMessage={searchQuery
            ? <>No products match “{searchQuery}”. <button className="inline-clear-button" type="button" onClick={() => { setSearch(''); setPage(1); }}>Clear search</button></>
            : 'No products match this category.'}
        />
      )}

      {productDialogOpen && <ProductFormDialog
        key={editingProduct?.id ?? 'new-product'}
        open={productDialogOpen}
        product={editingProduct}
        categories={catalog.categories}
        pending={catalog.pending}
        error={catalog.error}
        onClose={closeProductDialog}
        onSave={saveProduct}
        onManageCategories={openCategoryManager}
      />}

      {categoryDialogOpen && <CategoryManagementDialog
        open={categoryDialogOpen}
        categories={catalog.categories}
        pending={catalog.pending}
        error={catalog.error}
        notice={catalog.notice}
        onClose={() => setCategoryDialogOpen(false)}
        onSave={saveCategory}
        onToggleActive={requestCategoryStatusChange}
      />}

      <ConfirmDialog
        open={confirmation !== null}
        title={`${confirmation?.nextActive ? 'Activate' : 'Deactivate'} ${confirmation?.type ?? 'item'}?`}
        message={confirmation?.type === 'product'
          ? <span>Change the catalog status for <strong>{confirmation.name}</strong>? Product activation is separate from its POS availability setting.</span>
          : <span>Change the status of category <strong>{confirmation?.name}</strong>?</span>}
        confirmLabel={confirmation?.nextActive ? 'Activate' : 'Deactivate'}
        destructive={confirmation ? !confirmation.nextActive : false}
        pending={catalog.pending}
        onCancel={() => setConfirmation(null)}
        onConfirm={() => void confirmStatusChange()}
      />
    </PageContainer>
  );
}
