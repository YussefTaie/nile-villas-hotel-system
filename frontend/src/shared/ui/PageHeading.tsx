import type { ReactNode } from 'react';

export function PageHeading({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="page-heading">
      <div>
        <h1 className="page-heading__title">{title}</h1>
        {description && <p className="page-heading__description">{description}</p>}
      </div>
      {actions && <div className="page-heading__actions">{actions}</div>}
    </div>
  );
}
