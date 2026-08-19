/**
 * En-tête de page desktop (Stitch) : kicker + titre + description.
 *
 * @param {{
 *   eyebrow?: string,
 *   title: import('react').ReactNode,
 *   description?: import('react').ReactNode,
 *   action?: import('react').ReactNode,
 * }} props
 */
export function PageHeader({ eyebrow, title, description, action }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="font-sans text-xs font-semibold uppercase tracking-wide text-muted">{eyebrow}</p>
        ) : null}
        <h1 className="mt-1 font-display text-3xl text-on-card md:text-4xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl font-sans text-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
