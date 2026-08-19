/**
 * @param {{
 *   icon?: import('react').ReactNode,
 *   title: string,
 *   action?: import('react').ReactNode,
 * }} props
 */
export function EmptyState({ icon, title, action }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      {icon ? <div className="text-muted-on-card">{icon}</div> : null}
      <p className="font-sans text-sm text-muted-on-card">{title}</p>
      {action}
    </div>
  );
}
