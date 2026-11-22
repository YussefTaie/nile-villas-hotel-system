import type { PropsWithChildren, ReactNode } from 'react';

export function Card({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return <section className={`ui-card${className ? ` ${className}` : ''}`}>{children}</section>;
}

export function MetricCard({ label, value, detail, icon }: { label: string; value: ReactNode; detail?: ReactNode; icon?: ReactNode }) {
  return <Card className="metric-card"><div className="metric-card__top"><span className="metric-card__label">{label}</span>{icon && <span className="metric-card__icon">{icon}</span>}</div><div className="metric-card__value">{value}</div>{detail && <div className="metric-card__detail">{detail}</div>}</Card>;
}
