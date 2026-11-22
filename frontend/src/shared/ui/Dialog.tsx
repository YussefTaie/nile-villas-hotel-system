import { useEffect, useId, useRef, type PropsWithChildren, type ReactNode } from 'react';
import { IconButton } from './IconButton';

export function Dialog({ open, title, description, onClose, children, size = 'medium' }: PropsWithChildren<{
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  size?: 'medium' | 'large';
}>) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const id = useId();
  const titleId = `${id}-title`;
  const descriptionId = description ? `${id}-description` : undefined;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    return () => { if (dialog.open) dialog.close(); };
  }, [open]);

  if (!open) return null;
  return (
    <dialog
      ref={dialogRef}
      className={`ui-dialog ui-dialog--${size}`}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
    >
      <div className="ui-dialog__header">
        <div>
          <h2 id={titleId} className="ui-dialog__title">{title}</h2>
          {description && <p id={descriptionId} className="ui-dialog__description">{description}</p>}
        </div>
        <IconButton icon="close" label="Close dialog" onClick={onClose} />
      </div>
      <div className="ui-dialog__content">{children}</div>
    </dialog>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel, destructive = false, pending = false, onCancel, onConfirm }: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} title={title} onClose={onCancel} size="medium">
      <div className="confirm-dialog__body">{message}</div>
      <div className="confirm-dialog__actions">
        <button className="ui-button ui-button--secondary" type="button" disabled={pending} onClick={onCancel}>Cancel</button>
        <button className={`ui-button ui-button--${destructive ? 'destructive' : 'primary'}`} type="button" disabled={pending} onClick={onConfirm}>
          {pending ? 'Saving…' : confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
