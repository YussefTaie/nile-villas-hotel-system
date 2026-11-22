import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState } from '../../../shared/ui/AsyncState';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { Chip } from '../../../shared/ui/Chip';
import { Icon } from '../../../shared/ui/Icon';
import { PageContainer } from '../../../shared/ui/PageContainer';
import { PageHeading } from '../../../shared/ui/PageHeading';
import { SearchField } from '../../../shared/ui/SearchField';
import type { Product } from '../../catalog/domain/catalog';
import { useCatalog } from '../../catalog/presentation/hooks/useCatalog';
import { formatUsd } from '../domain/invoice';
import { useCreateInvoice } from './hooks/useCreateInvoice';
import './createInvoice.css';

export function CreateInvoicePage() {
  const catalog = useCatalog();
  const ticket = useCreateInvoice();
  const navigate = useNavigate();
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  const activeCategories = useMemo(() => catalog.categories.filter((category) => category.isActive), [catalog.categories]);
  const eligibleProducts = useMemo(() => {
    const categoryIds = new Set(activeCategories.map((category) => category.id));
    return catalog.products.filter((product) => product.isActive && product.isAvailable && categoryIds.has(product.categoryId));
  }, [activeCategories, catalog.products]);
  const filteredProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return eligibleProducts.filter((product) =>
      (categoryId === null || product.categoryId === categoryId) &&
      (!query || `${product.name} ${product.description ?? ''}`.toLocaleLowerCase().includes(query))
    );
  }, [categoryId, eligibleProducts, search]);
  const categoryNames = useMemo(() => new Map(activeCategories.map((category) => [category.id, category.name])), [activeCategories]);
  const items = ticket.invoice?.items ?? [];
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  function addProduct(product: Product) {
    void ticket.addProduct(product.id);
  }

  return (
    <PageContainer>
      <PageHeading title="Create Invoice" description="Select menu items to build a guest invoice." />
      <div className="invoice-workspace">
        <section className="invoice-catalog" aria-label="Product catalog">
          <Card className="invoice-catalog__toolbar">
            <SearchField label="Search products" placeholder="Search products…" value={search} onChange={(event) => setSearch(event.target.value)} />
            <div className="invoice-categories" role="group" aria-label="Filter by category">
              <button type="button" className={`invoice-category${categoryId === null ? ' invoice-category--active' : ''}`} aria-pressed={categoryId === null} onClick={() => setCategoryId(null)}>
                All Items <span>{eligibleProducts.length}</span>
              </button>
              {activeCategories.map((category) => <button type="button" className={`invoice-category${categoryId === category.id ? ' invoice-category--active' : ''}`} key={category.id} aria-pressed={categoryId === category.id} onClick={() => setCategoryId(category.id)}>
                {category.name}<span>{eligibleProducts.filter((product) => product.categoryId === category.id).length}</span>
              </button>)}
            </div>
          </Card>

          {catalog.loading ? <Card><LoadingState label="Loading available products…" /></Card> : catalog.loadFailed ? (
            <Card><ErrorState message={catalog.error ?? 'Unable to load the catalog.'} action={<Button onClick={() => void catalog.refresh()}>Try Again</Button>} /></Card>
          ) : eligibleProducts.length === 0 ? (
            <Card className="invoice-empty"><EmptyState><Icon name="restaurant_menu" size={30} /><strong>No products are available to sell.</strong><span>Active products marked available will appear here.</span></EmptyState></Card>
          ) : filteredProducts.length === 0 ? (
            <Card className="invoice-empty"><EmptyState><Icon name="search_off" size={28} /><strong>No products match this selection.</strong><span>Try another category or search.</span></EmptyState></Card>
          ) : (
            <div className="invoice-products" aria-label="Available products">
              {filteredProducts.map((product) => <ProductCard key={product.id} product={product} category={categoryNames.get(product.categoryId) ?? ''} pending={ticket.pending} onAdd={() => addProduct(product)} />)}
            </div>
          )}
        </section>

        <aside className="invoice-ticket" aria-label="Current invoice">
          <Card className="invoice-ticket__card">
            <header className="invoice-ticket__header">
              <div><h2>Current Ticket</h2><p>{ticket.invoice ? ticket.invoice.invoiceNumber : 'No invoice started'}</p></div>
              <Chip tone="neutral">{itemCount} {itemCount === 1 ? 'item' : 'items'}</Chip>
            </header>

            {ticket.error && <p className="invoice-message invoice-message--error" role="alert">{ticket.error} {ticket.invoice && items.length === 0 && 'The open invoice is retained; retry by adding a product.'}</p>}
            {ticket.notice && <p className="invoice-message invoice-message--success" role="status">{ticket.notice}</p>}

            {items.length === 0 ? <div className="invoice-ticket__empty"><EmptyState><Icon name="receipt_long" size={30} /><strong>Your ticket is empty</strong><span>Choose a product to start an invoice.</span></EmptyState></div> : (
              <ul className="invoice-line-items">
                {items.map((item) => <li className="invoice-line" key={item.id}>
                  <div className="invoice-line__top"><div><strong>{item.productNameSnapshot}</strong><span>{formatUsd(item.unitPriceUsd)} each</span></div><strong>{formatUsd(item.lineTotalUsd)}</strong></div>
                  <div className="invoice-line__controls">
                    <div className="invoice-quantity" aria-label={`Quantity for ${item.productNameSnapshot}`}>
                      <button type="button" aria-label="Decrease quantity" disabled={ticket.pending || (item.quantity === 1 && items.length === 1)} title={item.quantity === 1 && items.length === 1 ? 'An open invoice must keep one item.' : undefined} onClick={() => item.quantity > 1 ? void ticket.updateQuantity(item.id, item.quantity - 1) : void ticket.removeItem(item.id)}><Icon name="remove" size={18} /></button>
                      <span>{item.quantity}</span>
                      <button type="button" aria-label="Increase quantity" disabled={ticket.pending} onClick={() => void ticket.updateQuantity(item.id, item.quantity + 1)}><Icon name="add" size={18} /></button>
                    </div>
                    <button className="invoice-remove" type="button" aria-label={`Remove ${item.productNameSnapshot}`} disabled={ticket.pending || items.length === 1} title={items.length === 1 ? 'An open invoice must keep one item.' : 'Remove item'} onClick={() => void ticket.removeItem(item.id)}><Icon name="delete" size={18} /></button>
                  </div>
                </li>)}
              </ul>
            )}

            <footer className="invoice-ticket__footer">
              <div className="invoice-total-row"><span>Subtotal ({itemCount} {itemCount === 1 ? 'item' : 'items'})</span><span>{formatUsd(ticket.invoice?.totalAmountUsd ?? '0.00')}</span></div>
              <div className="invoice-total-row invoice-total-row--grand"><span>Total Due <small>USD</small></span><strong>{formatUsd(ticket.invoice?.totalAmountUsd ?? '0.00')}</strong></div>
              <Button variant="primary" fullWidth disabled={ticket.pending || !ticket.invoice || items.length === 0} onClick={() => ticket.invoice && navigate(`/invoices/review?invoiceId=${ticket.invoice.id}`)}>
                Proceed to Checkout <Icon name="arrow_forward" />
              </Button>
            </footer>
          </Card>
        </aside>
      </div>
    </PageContainer>
  );
}

function ProductCard({ product, category, pending, onAdd }: { product: Product; category: string; pending: boolean; onAdd: () => void }) {
  return <Card className="invoice-product-card">
    <div className="invoice-product-card__image" aria-hidden="true"><Icon name="restaurant_menu" size={34} /></div>
    <div className="invoice-product-card__body">
      <Chip tone="category">{category}</Chip>
      <h3>{product.name}</h3>
      {product.description && <p>{product.description}</p>}
      <div className="invoice-product-card__bottom"><strong>{formatUsd(product.unitPriceUsd)}</strong><Button variant="primary" disabled={pending} onClick={onAdd}><Icon name="add" size={18} />Add</Button></div>
    </div>
  </Card>;
}
