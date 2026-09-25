import { Loader2, Search, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { cn } from '@/lib/utils.js';

const DEBOUNCE_MS = 250;

/**
 * Champ de recherche avec liste de suggestions (motif WAI-ARIA « combobox »).
 *
 * - Clavier : ↓ / ↑ pour parcourir, Entrée pour choisir, Échap pour fermer.
 * - Les options sont chargées à la frappe (`loadOptions`, temporisé) : la liste
 *   reste courte même avec des centaines de familles.
 * - Contrôlé : `value` est l'option choisie (ou `null`), `onChange` la reçoit.
 *   Se branche à react-hook-form via `Controller`.
 *
 * @template T
 * @param {{
 *   id: string,
 *   value: T | null,
 *   onChange: (option: T | null) => void,
 *   loadOptions: (query: string) => Promise<T[]>,
 *   getOptionKey: (option: T) => string,
 *   getOptionLabel: (option: T) => string,
 *   renderOption?: (option: T) => React.ReactNode,
 *   placeholder?: string,
 *   minChars?: number,
 *   invalid?: boolean,
 *   disabled?: boolean,
 *   emptyMessage?: string,
 *   'aria-describedby'?: string,
 *   'aria-invalid'?: boolean,
 *   onBlur?: () => void,
 * }} props
 */
export function Combobox({
  id,
  value,
  onChange,
  loadOptions,
  getOptionKey,
  getOptionLabel,
  renderOption,
  placeholder = 'Rechercher…',
  minChars = 2,
  invalid = false,
  disabled = false,
  emptyMessage = 'Aucun résultat',
  onBlur,
  ...aria
}) {
  const listboxId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState(/** @type {T[]} */ ([]));
  const [status, setStatus] = useState(/** @type {'idle' | 'loading' | 'error'} */ ('idle'));
  const [activeIndex, setActiveIndex] = useState(-1);
  const requestRef = useRef(0);
  // Dernière fonction de chargement reçue : une nouvelle référence à chaque rendu
  // ne doit pas relancer la recherche.
  const loadOptionsRef = useRef(loadOptions);
  useEffect(() => {
    loadOptionsRef.current = loadOptions;
  }, [loadOptions]);
  const containerRef = useRef(/** @type {HTMLDivElement | null} */ (null));

  const trimmed = query.trim();
  const tooShort = trimmed.length < minChars;

  // Chargement temporisé ; seule la dernière requête lancée peut mettre à jour la liste.
  useEffect(() => {
    if (!open || tooShort) return undefined;
    const requestId = ++requestRef.current;
    const timer = setTimeout(() => {
      setStatus('loading');
      loadOptionsRef
        .current(trimmed)
        .then((result) => {
          if (requestRef.current !== requestId) return;
          setOptions(result);
          setActiveIndex(result.length > 0 ? 0 : -1);
          setStatus('idle');
        })
        .catch(() => {
          if (requestRef.current === requestId) setStatus('error');
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [open, trimmed, tooShort]);

  // Fermeture au clic en dehors
  useEffect(() => {
    if (!open) return undefined;
    /** @param {MouseEvent} event */
    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(/** @type {Node} */ (event.target))) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  /** @param {T} option */
  const select = (option) => {
    onChange(option);
    setQuery('');
    setOptions([]);
    setOpen(false);
  };

  /** @param {React.KeyboardEvent<HTMLInputElement>} event */
  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, options.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      if (open && activeIndex >= 0 && options[activeIndex]) {
        event.preventDefault();
        select(options[activeIndex]);
      }
    } else if (event.key === 'Escape') {
      if (open) {
        event.preventDefault();
        setOpen(false);
      }
    }
  };

  // Option choisie : affichée comme une « puce » avec un bouton pour changer.
  if (value) {
    return (
      <div
        className={cn(
          'flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-border-on-card bg-paper px-4 py-2 font-sans text-sm text-on-card',
          invalid && 'border-danger'
        )}
      >
        <span className="min-w-0">
          {renderOption ? renderOption(value) : getOptionLabel(value)}
        </span>
        {disabled ? null : (
          <button
            type="button"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-on-card hover:bg-surface-raised hover:text-on-card focus-visible:ring-2 focus-visible:ring-primary/60"
            aria-label={`Changer : ${getOptionLabel(value)}`}
            onClick={() => {
              onChange(null);
              requestAnimationFrame(() => document.getElementById(id)?.focus());
            }}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>
    );
  }

  const activeId = activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined;
  const showList = open && !disabled;

  return (
    <div ref={containerRef} className="relative">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-on-card"
        aria-hidden="true"
      />
      <input
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listboxId}
        aria-activedescendant={showList ? activeId : undefined}
        aria-describedby={aria['aria-describedby']}
        aria-invalid={invalid || aria['aria-invalid'] || undefined}
        disabled={disabled}
        placeholder={placeholder}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        className={cn(
          'h-11 w-full rounded-lg border border-border-on-card bg-card pl-9 pr-9 font-sans text-sm text-on-card placeholder:text-muted-on-card',
          'focus-visible:border-primary',
          invalid && 'border-danger'
        )}
      />
      {status === 'loading' && !tooShort ? (
        <Loader2
          className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-on-card motion-reduce:animate-none"
          aria-hidden="true"
        />
      ) : null}

      {showList ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border-on-card bg-card p-1 shadow-lg"
        >
          {tooShort ? (
            <li className="px-3 py-2 font-sans text-sm text-muted-on-card">
              Tapez au moins {minChars} caractères
            </li>
          ) : status === 'error' ? (
            <li className="px-3 py-2 font-sans text-sm text-danger">
              La recherche a échoué, réessayez.
            </li>
          ) : status === 'loading' && options.length === 0 ? (
            <li className="px-3 py-2 font-sans text-sm text-muted-on-card">Recherche…</li>
          ) : options.length === 0 ? (
            <li className="px-3 py-2 font-sans text-sm text-muted-on-card">{emptyMessage}</li>
          ) : (
            options.map((option, index) => (
              <li
                key={getOptionKey(option)}
                id={`${listboxId}-option-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                className={cn(
                  'cursor-pointer rounded-md px-3 py-2 font-sans text-sm text-on-card',
                  index === activeIndex && 'bg-surface-raised'
                )}
                // mousedown plutôt que click : le champ ne perd pas le focus avant le choix
                onMouseDown={(event) => {
                  event.preventDefault();
                  select(option);
                }}
                onMouseEnter={() => setActiveIndex(index)}
              >
                {renderOption ? renderOption(option) : getOptionLabel(option)}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
