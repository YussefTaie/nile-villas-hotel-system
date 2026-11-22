import type { InputHTMLAttributes } from 'react';
import { Icon } from './Icon';

interface SearchFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

export function SearchField({ label = 'Search', className = '', ...props }: SearchFieldProps) {
  return <label className={`search-field${className ? ` ${className}` : ''}`}><Icon name="search" /><input type="search" aria-label={label} {...props} /></label>;
}
