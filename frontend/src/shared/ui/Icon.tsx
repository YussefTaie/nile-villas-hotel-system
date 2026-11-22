import type { ReactNode } from 'react';

interface IconProps {
  name: string;
  size?: number;
  label?: string;
}

export function Icon({ name, size = 20, label }: IconProps): ReactNode {
  return (
    <span className="material-symbols-outlined" style={{ fontSize: size }} aria-hidden={label ? undefined : true} aria-label={label}>
      {name}
    </span>
  );
}
