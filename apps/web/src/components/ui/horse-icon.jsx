import { cn } from '@/lib/utils.js';

/**
 * Pictogramme équestre (fer à cheval).
 * lucide-react 1.x n’exporte pas `Horse` dans la version du projet.
 *
 * @param {{ className?: string } & import('react').SVGProps<SVGSVGElement>} props
 */
export function HorseIcon({ className, ...rest }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn('shrink-0', className)}
      {...rest}
    >
      <path
        d="M8 20.8 6.6 22C4.2 19.6 3 16.2 3 12.2 3 7 7 3.2 12 3.2s9 3.8 9 9c0 4-1.2 7.4-3.6 9.8L16 20.8c1.7-1.9 2.7-4.8 2.7-8.6 0-4.1-3-6.9-6.7-6.9S5.3 8.1 5.3 12.2c0 3.8 1 6.7 2.7 8.6Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.1 20.8h1.3M14.6 20.8h1.3M7.1 13.2h1.1M15.8 13.2h1.1M7.4 9.6h1.1M15.5 9.6h1.1"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}
