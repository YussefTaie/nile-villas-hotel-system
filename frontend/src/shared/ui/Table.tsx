import type { PropsWithChildren, ReactNode, TableHTMLAttributes, ThHTMLAttributes, TdHTMLAttributes } from 'react';

export function DataTable({ children, className = '', ...props }: PropsWithChildren<TableHTMLAttributes<HTMLTableElement>>) {
  return <div className="table-scroll"><table className={`ui-table${className ? ` ${className}` : ''}`} {...props}>{children}</table></div>;
}

export function TableHeader({ children, ...props }: PropsWithChildren<ThHTMLAttributes<HTMLTableCellElement>>) {
  return <th scope="col" {...props}>{children}</th>;
}

export function TableCell({ children, ...props }: PropsWithChildren<TdHTMLAttributes<HTMLTableCellElement>>) {
  return <td {...props}>{children}</td>;
}

export function TableEmptyRow({ columns, children }: { columns: number; children: ReactNode }) {
  return <tr><td className="ui-table__empty" colSpan={columns}>{children}</td></tr>;
}
