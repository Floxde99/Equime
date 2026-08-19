import { cn } from '@/lib/utils.js';

/** @param {{ children: import('react').ReactNode, className?: string, title?: string }} props */
export function Card({ children, className, title }) {
  return (
    <section className={cn('rounded-xl border border-border bg-surface p-5', className)}>
      {title ? <h3 className="mb-4 font-sans text-lg font-semibold text-text">{title}</h3> : null}
      {children}
    </section>
  );
}
