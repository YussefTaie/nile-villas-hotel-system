import { useState, type FormEvent } from 'react';
import type { Category, Product, ProductDraft } from '../../domain/catalog';
import { Button } from '../../../../shared/ui/Button';
import { Dialog } from '../../../../shared/ui/Dialog';
import { Icon } from '../../../../shared/ui/Icon';
import { Chip } from '../../../../shared/ui/Chip';

interface ProductFormDialogProps {
  open: boolean;
  product: Product | null;
  categories: Category[];
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (productId: number | null, draft: ProductDraft) => Promise<boolean>;
  onManageCategories: () => void;
}

export function ProductFormDialog({ open, product, categories, pending, error, onClose, onSave, onManageCategories }: ProductFormDialogProps) {
  const [name, setName] = useState(product?.name ?? '');
  const [categoryId, setCategoryId] = useState(String(product?.categoryId ?? categories[0]?.id ?? ''));
  const [price, setPrice] = useState(product?.unitPriceUsd ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanedName = name.trim();
    const numericPrice = Number(price);
    if (cleanedName.length < 1 || cleanedName.length > 100) {
      setValidationMessage('Enter a product name between 1 and 100 characters.');
      return;
    }
    if (description.trim().length > 255) {
      setValidationMessage('Description must be 255 characters or fewer.');
      return;
    }
    if (!categoryId || !categories.some((category) => category.id === Number(categoryId))) {
      setValidationMessage('Choose a category for this product.');
      return;
    }
    if (!Number.isFinite(numericPrice) || numericPrice < 0 || !/^\d{1,8}(\.\d{1,2})?$/.test(price.trim())) {
      setValidationMessage('Enter a USD price from 0.00 to 99,999,999.99 with no more than two decimal places.');
      return;
    }
    setValidationMessage(null);
    const saved = await onSave(product?.id ?? null, {
      categoryId: Number(categoryId),
      name: cleanedName,
      description: description.trim() || null,
      unitPriceUsd: numericPrice.toFixed(2),
    });
    if (saved) onClose();
  }

  return (
    <Dialog
      open={open}
      title={product ? 'Edit Menu Product' : 'Add New Product'}
      description="Set product details and status for the menu catalog."
      onClose={onClose}
      size="medium"
    >
      <form className="catalog-form" onSubmit={(event) => void submit(event)} noValidate>
        <label className="catalog-form__field">
          <span className="catalog-form__label">Product Name <span aria-hidden="true">*</span></span>
          <input className="ui-input" autoFocus required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Pan-Roasted Sea Bass" />
        </label>

        <fieldset className="catalog-form__field catalog-form__fieldset">
          <legend className="catalog-form__label">Category <span aria-hidden="true">*</span></legend>
          {categories.length ? (
            <div className="category-choice-grid">
              {categories.map((category) => (
                <label className={`category-choice${Number(categoryId) === category.id ? ' category-choice--selected' : ''}`} key={category.id}>
                  <input type="radio" name="product-category" value={category.id} checked={Number(categoryId) === category.id} onChange={() => setCategoryId(String(category.id))} />
                  <Icon name="restaurant_menu" size={18} />
                  <span>{category.name}</span>
                  {!category.isActive && <Chip tone="neutral">Inactive</Chip>}
                </label>
              ))}
            </div>
          ) : (
            <div className="catalog-form__no-categories">
              <p>No categories are available yet.</p>
              <Button type="button" variant="secondary" onClick={onManageCategories}>Manage Categories</Button>
            </div>
          )}
        </fieldset>

        <label className="catalog-form__field">
          <span className="catalog-form__label">Base Price in USD ($) <span aria-hidden="true">*</span></span>
          <div className="price-input"><span aria-hidden="true">$</span><input className="ui-input" type="number" inputMode="decimal" min="0" max="99999999.99" step="0.01" required value={price} onChange={(event) => setPrice(event.target.value)} placeholder="0.00" /></div>
          <span className="catalog-form__hint">Prices use the USD base currency.</span>
        </label>

        <label className="catalog-form__field">
          <span className="catalog-form__label">Description</span>
          <textarea className="ui-input catalog-form__textarea" maxLength={255} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Product description or menu notes" />
        </label>

        {!product && <p className="catalog-form__hint">New products start active and available by default. You can change each status from the product list.</p>}

        {(validationMessage || error) && <p className="catalog-message catalog-message--error" role="alert">{validationMessage ?? error}</p>}

        <div className="catalog-form__actions">
          <Button type="button" variant="secondary" disabled={pending} onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={pending || categories.length === 0}>
            {pending ? 'Saving…' : product ? 'Save Product' : 'Add Product'}
          </Button>
        </div>
      </form>
      {categories.length > 0 && <button className="catalog-form__manage-categories" type="button" onClick={onManageCategories}>Manage categories</button>}
    </Dialog>
  );
}
