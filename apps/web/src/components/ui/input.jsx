import { forwardRef } from 'react';

import { cn } from '@/lib/utils.js';

/**
 * Champ texte du design system — fond carte, focus vert.
 * `forwardRef` requis par react-hook-form (register).
 */
export const Input = forwardRef(
  /**
   * @param {{ className?: string, invalid?: boolean } & Record<string, any>} props
   * @param {React.Ref<HTMLInputElement>} ref
   */
  function Input({ className, invalid = false, ...rest }, ref) {
    return (
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          'h-11 w-full rounded-lg border border-border-on-card bg-card px-4 font-sans text-sm text-on-card placeholder:text-muted-on-card',
          'focus-visible:border-primary',
          invalid && 'border-danger',
          className
        )}
        {...rest}
      />
    );
  }
);
