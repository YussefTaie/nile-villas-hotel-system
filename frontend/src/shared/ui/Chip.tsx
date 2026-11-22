import type { PropsWithChildren } from 'react';

type ChipTone = 'neutral' | 'success' | 'warning' | 'error' | 'info' | 'category';
export function Chip({ children, tone = 'neutral' }: PropsWithChildren<{ tone?: ChipTone }>) {
  return <span className={`ui-chip ui-chip--${tone}`}>{children}</span>;
}
