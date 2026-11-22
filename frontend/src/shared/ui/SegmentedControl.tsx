import type { ReactNode } from 'react';

export interface Segment<T extends string> { value: T; label: ReactNode; }
export function SegmentedControl<T extends string>({ value, options, onChange, label }: { value: T; options: Segment<T>[]; onChange: (value: T) => void; label: string }) {
  return <div className="segmented-control" role="group" aria-label={label}>{options.map((option) => <button key={option.value} type="button" className={`segmented-control__option${value === option.value ? ' segmented-control__option--active' : ''}`} aria-pressed={value === option.value} onClick={() => onChange(option.value)}>{option.label}</button>)}</div>;
}
