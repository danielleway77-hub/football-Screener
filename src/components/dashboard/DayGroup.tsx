/**
 * One day of the Upcoming tab (UI_BLUEPRINT §34): an h2-level heading styled like an h3 (17/600), a
 * mono count pill and a 1px hairline filling the rest of the row; 16px to the cards. A labelled
 * landmark-ish section so screen readers can jump between days.
 */
export function DayGroup({
  id,
  label,
  count,
  children,
}: {
  id: string;
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  const headingId = `day-group-${id}`;
  return (
    <section aria-labelledby={headingId} data-testid="day-group" data-day={id}>
      <div className="mb-4 flex items-center gap-3">
        <h2 id={headingId} className="text-h4 shrink-0">
          {label}
        </h2>
        <span
          data-testid="day-group-count"
          className="num shrink-0 rounded-full bg-surface-raised px-2 text-xs leading-5 text-foreground"
        >
          {count}
          <span className="sr-only"> {count === 1 ? "match" : "matches"}</span>
        </span>
        <span aria-hidden="true" className="h-px flex-1 bg-hairline" />
      </div>
      {children}
    </section>
  );
}
