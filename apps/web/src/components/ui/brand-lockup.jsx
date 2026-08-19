import { HorseIcon } from '@/components/ui/horse-icon.jsx';
import { cn } from '@/lib/utils.js';

/**
 * Marque Equime (fer à cheval + wordmark serif Stitch).
 *
 * @param {{
 *   tone?: 'dark' | 'light' | 'on-primary',
 *   size?: 'sm' | 'md' | 'lg',
 *   showMark?: boolean,
 *   className?: string,
 * }} props
 */
export function BrandLockup({ tone = 'dark', size = 'md', showMark = true, className }) {
  const sizes = {
    sm: { icon: 'size-5', text: 'text-lg' },
    md: { icon: 'size-7', text: 'text-2xl' },
    lg: { icon: 'size-10', text: 'text-4xl' },
  };
  const current = sizes[size];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2',
        tone === 'on-primary' ? 'text-primary-fg' : tone === 'light' ? 'text-on-card' : 'text-text',
        className
      )}
    >
      {showMark ? <HorseIcon className={current.icon} /> : null}
      <span className={cn('font-display tracking-tight', current.text)}>Equime</span>
    </span>
  );
}
