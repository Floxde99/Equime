import { formatCentsForInput, parseEurosToCents } from '@equime/shared';
import { forwardRef, useEffect, useState } from 'react';

import { cn } from '@/lib/utils.js';

/**
 * Saisie d'un montant en euros (« 49 », « 49,90 ») stocké en centimes.
 *
 * L'API et les schémas restent en centimes entiers (jamais de flottant pour
 * l'argent) ; seul ce champ parle en euros. Se branche via `Controller` :
 * `value` / `onChange` en centimes. Une saisie invalide remonte `NaN`, que le
 * schéma Zod refuse avec « Saisissez un nombre valide ».
 */
export const MoneyInput = forwardRef(
  /**
   * @param {{
   *   value: number | null | undefined,
   *   onChange: (cents: number | undefined) => void,
   *   onBlur?: () => void,
   *   invalid?: boolean,
   *   className?: string,
   * } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>} props
   * @param {React.Ref<HTMLInputElement>} ref
   */
  function MoneyInput({ value, onChange, onBlur, invalid = false, className, ...rest }, ref) {
    const [text, setText] = useState(() => formatCentsForInput(value));

    // Resynchronise quand la valeur change de l'extérieur (reset du formulaire, édition)
    useEffect(() => {
      setText((current) =>
        parseEurosToCents(current) === value ? current : formatCentsForInput(value)
      );
    }, [value]);

    return (
      <div className="relative">
        <input
          ref={ref}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          aria-invalid={invalid || undefined}
          value={text}
          onChange={(event) => {
            const next = event.target.value;
            setText(next);
            if (next.trim() === '') {
              onChange(undefined);
              return;
            }
            const cents = parseEurosToCents(next);
            onChange(cents ?? Number.NaN);
          }}
          onBlur={() => {
            const cents = parseEurosToCents(text);
            if (cents != null) setText(formatCentsForInput(cents));
            onBlur?.();
          }}
          className={cn(
            'h-11 w-full rounded-lg border border-border-on-card bg-card pl-4 pr-10 font-sans text-sm text-on-card placeholder:text-muted-on-card',
            'focus-visible:border-primary',
            invalid && 'border-danger',
            className
          )}
          {...rest}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-sans text-sm text-muted-on-card"
        >
          €
        </span>
      </div>
    );
  }
);
