import type { ButtonHTMLAttributes } from 'react';
import { Icon } from './Icon';

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  icon: string;
  label: string;
}

export function IconButton({ icon, label, className = '', ...props }: IconButtonProps) {
  return <button className={`ui-icon-button${className ? ` ${className}` : ''}`} aria-label={label} title={label} {...props}><Icon name={icon} /></button>;
}
