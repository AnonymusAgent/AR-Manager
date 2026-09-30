'use client';

import React from 'react';

interface TableProps {
  children: React.ReactNode;
  className?: string;
}

export function Table({ children, className = '' }: TableProps) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="min-w-full divide-y divide-slate-200">
        {children}
      </table>
    </div>
  );
}

export function TableHead({ children }: { children: React.ReactNode }) {
  return <thead className="bg-slate-50">{children}</thead>;
}

export function TableBody({ children }: { children: React.ReactNode }) {
  return <tbody className="bg-white divide-y divide-slate-200">{children}</tbody>;
}

export function TableRow({
  children,
  onClick,
  selected,
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  selected?: boolean;
  className?: string;
}) {
  return (
    <tr
      onClick={onClick}
      className={`
        ${onClick ? 'cursor-pointer hover:bg-slate-50' : ''}
        ${selected ? 'bg-blue-50' : ''}
        ${className}
      `}
    >
      {children}
    </tr>
  );
}

export function TableHeader({
  children,
  className = '',
  sortable,
  sorted,
  sortDirection,
  onSort,
}: {
  children: React.ReactNode;
  className?: string;
  sortable?: boolean;
  sorted?: boolean;
  sortDirection?: 'asc' | 'desc';
  onSort?: () => void;
}) {
  return (
    <th
      onClick={sortable ? onSort : undefined}
      className={`
        px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider
        ${sortable ? 'cursor-pointer hover:bg-slate-100' : ''}
        ${className}
      `}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortable && sorted && (
          <span className="text-blue-600">
            {sortDirection === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </div>
    </th>
  );
}

export function TableCell({
  children,
  className = '',
  colSpan,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  colSpan?: number;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <td 
      className={`px-4 py-3 text-sm text-slate-900 ${className}`}
      colSpan={colSpan}
      onClick={onClick}
    >
      {children}
    </td>
  );
}

export function TableEmpty({ message = 'No data available' }: { message?: string }) {
  return (
    <tr>
      <td colSpan={100} className="px-4 py-12 text-center text-slate-500">
        {message}
      </td>
    </tr>
  );
}
