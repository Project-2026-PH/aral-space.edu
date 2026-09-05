import type { HTMLAttributes } from 'react';

export default function Skeleton({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      data-slot="skeleton"
      {...props}
      className={`animate-pulse rounded-md bg-muted/50 ${className}`}
    />
  );
}
