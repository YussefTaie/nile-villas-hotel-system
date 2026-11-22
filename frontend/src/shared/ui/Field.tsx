import type { InputHTMLAttributes, SelectHTMLAttributes } from 'react';

interface CommonFieldProps {
  label?: string;
  className?: string;
}

type InputFieldProps = CommonFieldProps & InputHTMLAttributes<HTMLInputElement>;
export function InputField({ label, className = '', id, ...props }: InputFieldProps) {
  const inputId = id ?? props.name;
  return <label className={`ui-field${className ? ` ${className}` : ''}`} htmlFor={inputId}>{label && <span className="ui-field__label">{label}</span>}<input id={inputId} className="ui-input" {...props} /></label>;
}

type SelectFieldProps = CommonFieldProps & SelectHTMLAttributes<HTMLSelectElement>;
export function SelectField({ label, className = '', id, children, ...props }: SelectFieldProps) {
  const selectId = id ?? props.name;
  return <label className={`ui-field${className ? ` ${className}` : ''}`} htmlFor={selectId}>{label && <span className="ui-field__label">{label}</span>}<select id={selectId} className="ui-select" {...props}>{children}</select></label>;
}
