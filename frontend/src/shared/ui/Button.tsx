import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'quiet';
  fullWidth?: boolean;
  children: ReactNode;
}

export function Button({ variant = 'secondary', fullWidth = false, className = '', children, type = 'button', ...props }: ButtonProps) {
  return (
    <button type={type} className={`ui-button ui-button--${variant}${fullWidth ? ' ui-button--full' : ''}${className ? ` ${className}` : ''}`} {...props}>
      {children}
    </button>
  );
}
