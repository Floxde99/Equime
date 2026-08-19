import { cn } from '@/lib/utils.js';

const CARD_TEXT =
  '[&_.text-text]:text-on-card [&_.text-muted]:text-muted-on-card [&_.border-border]:border-border-on-card';

/** @param {{ children: import('react').ReactNode, className?: string, title?: string }} props */
export function Card({ children, className, title }) {
  return (
    <section
      className={cn(
        'rounded-xl border border-border-on-card bg-card p-5 text-on-card shadow-[0_12px_32px_rgba(26,28,28,0.06)]',
        CARD_TEXT,
        className
      )}
    >
      {title ? (
        <h3 className="mb-4 font-sans text-lg font-semibold text-on-card">{title}</h3>
      ) : null}
      {children}
    </section>
  );
}
