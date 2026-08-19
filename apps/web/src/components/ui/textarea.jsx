import { forwardRef } from 'react';

import { cn } from '@/lib/utils.js';

/**
 * Zone de texte du design system — mêmes tokens que `Input`.
 * `forwardRef` requis par react-hook-form (register).
 */
export const Textarea = forwardRef(
  /**
   * @param {{ className?: string, invalid?: boolean } & Record<string, any>} props
   * @param {React.Ref<HTMLTextAreaElement>} ref
   */
  function Textarea({ className, invalid = false, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          'w-full rounded-lg border border-border-on-card bg-card px-4 py-3 font-sans text-sm text-on-card placeholder:text-muted-on-card',
          'focus-visible:border-primary',
          invalid && 'border-danger',
          className
        )}
        {...rest}
      />
    );
  }
);
