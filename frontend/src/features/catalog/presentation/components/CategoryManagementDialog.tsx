import { useState, type FormEvent } from 'react';
import type { Category, CategoryDraft } from '../../domain/catalog';
import { Button } from '../../../../shared/ui/Button';
import { Chip } from '../../../../shared/ui/Chip';
import { Dialog } from '../../../../shared/ui/Dialog';
import { IconButton } from '../../../../shared/ui/IconButton';

interface CategoryManagementDialogProps {
  open: boolean;
  categories: Category[];
  pending: boolean;
  error: string | null;
  notice: string | null;
  onClose: () => void;
  onSave: (categoryId: number | null, draft: CategoryDraft) => Promise<boolean>;
  onToggleActive: (category: Category) => void;
}

export function CategoryManagementDialog({ open, categories, pending, error, notice, onClose, onSave, onToggleActive }: CategoryManagementDialogProps) {
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [displayOrder, setDisplayOrder] = useState('');
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  function resetForm() {
    setEditing(null);
    setName('');
    setDescription('');
    setDisplayOrder('');
    setValidationMessage(null);
  }

  function startEditing(category: Category) {
    setEditing(category);
    setName(category.name);
    setDescription(category.description ?? '');
    setDisplayOrder(String(category.displayOrder));
    setValidationMessage(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanedName = name.trim();
    if (!cleanedName || cleanedName.length > 50) {
      setValidationMessage('Enter a category name between 1 and 50 characters.');
      return;
    }
    if (description.length > 255) {
      setValidationMessage('Description must be 255 characters or fewer.');
      return;
    }
    const draft: CategoryDraft = { name: cleanedName, description: description.trim() || null };
    if (displayOrder.trim()) {
      const order = Number(displayOrder);
      if (!Number.isInteger(order) || order < -2_147_483_648 || order > 2_147_483_647) {
        setValidationMessage('Display order must be a whole number in the supported range.');
        return;
      }
      draft.displayOrder = order;
    }
    setValidationMessage(null);
    const saved = await onSave(editing?.id ?? null, draft);
    if (saved) resetForm();
  }

  return (
    <Dialog open={open} title="Manage Categories" description="Create, edit, and activate menu categories." onClose={onClose} size="large">
      <div className="category-manager">
        <div className="category-manager__list">
          <div className="category-manager__list-heading"><h3>Menu Categories</h3><span>{categories.length} total</span></div>
          {notice && <p className="catalog-message catalog-message--success" role="status">{notice}</p>}
          {categories.length ? categories.map((category) => (
            <div className="category-manager__row" key={category.id}>
              <div className="category-manager__info">
                <span className="category-manager__name">{category.name}</span>
                {category.description && <span className="category-manager__description">{category.description}</span>}
                <span className="category-manager__order">Display order {category.displayOrder}</span>
              </div>
              <Chip tone={category.isActive ? 'success' : 'neutral'}>{category.isActive ? 'Active' : 'Inactive'}</Chip>
              <IconButton icon="edit" label={`Edit ${category.name}`} disabled={pending} onClick={() => startEditing(category)} />
              <Button type="button" variant="quiet" disabled={pending} onClick={() => onToggleActive(category)}>
                {category.isActive ? 'Deactivate' : 'Activate'}
              </Button>
            </div>
          )) : <p className="category-manager__empty">No categories yet. Add the first category below.</p>}
        </div>

        <form className="category-form" onSubmit={(event) => void submit(event)} noValidate>
          <div className="category-form__heading"><h3>{editing ? 'Edit Category' : 'Add Category'}</h3>{editing && <Button type="button" variant="quiet" disabled={pending} onClick={resetForm}>Cancel edit</Button>}</div>
          <label className="catalog-form__field">
            <span className="catalog-form__label">Name <span aria-hidden="true">*</span></span>
            <input className="ui-input" autoFocus required maxLength={50} value={name} onChange={(event) => setName(event.target.value)} placeholder="Category name" />
          </label>
          <label className="catalog-form__field">
            <span className="catalog-form__label">Description</span>
            <textarea className="ui-input catalog-form__textarea" maxLength={255} rows={2} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optional description" />
          </label>
          <label className="catalog-form__field">
            <span className="catalog-form__label">Display Order</span>
            <input className="ui-input" type="number" step="1" value={displayOrder} onChange={(event) => setDisplayOrder(event.target.value)} placeholder="Optional" />
          </label>
          {(validationMessage || error) && <p className="catalog-message catalog-message--error" role="alert">{validationMessage ?? error}</p>}
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? 'Saving…' : editing ? 'Save Category' : 'Add Category'}
          </Button>
        </form>
      </div>
    </Dialog>
  );
}
