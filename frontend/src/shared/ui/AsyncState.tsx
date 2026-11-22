import type { PropsWithChildren, ReactNode } from 'react';

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return <div className="async-state" role="status"><span className="async-state__spinner" aria-hidden="true" />{label}</div>;
}

export function EmptyState({ children }: PropsWithChildren) {
  return <div className="async-state">{children}</div>;
}

export function ErrorState({ message, action }: { message: string; action?: ReactNode }) {
  return <div className="async-state async-state--error" role="alert"><span>{message}</span>{action}</div>;
}
