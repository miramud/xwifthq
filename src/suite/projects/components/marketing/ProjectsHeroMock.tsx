/**
 * The drawn board used as the Projects example (the module preview page shows
 * it inside an "Example" figure).
 *
 * It draws a board rather than describing one, because the claim is about
 * what the interface looks like, and a page that only says "easier" has
 * already lost the argument.
 *
 * The board is a white card floating on a purple gradient, so it reads the
 * same on a white page or a pale grey figure. Columns are pale tiles, cards
 * are white with a hairline, and the module's sky hue appears only as the
 * small column dots.
 */

const COLUMNS = [
  {
    title: "To do",
    count: 5,
    cards: [
      { title: "Migrate media library", initials: "AO", priority: "High" },
      { title: "Draft redirect map", initials: "NB", priority: "Normal" },
    ],
  },
  {
    title: "In progress",
    count: 3,
    cards: [
      { title: "Rebuild pricing page", initials: "CE", priority: "Urgent" },
      { title: "Search indexing", initials: "AO", priority: "Normal" },
    ],
  },
  {
    title: "Review",
    count: 2,
    cards: [{ title: "Accessibility pass", initials: "TK", priority: "High" }],
  },
] as const;

const PRIORITY_STYLE: Record<string, string> = {
  Urgent: "bg-coral-100 text-coral-700",
  High: "bg-primary-100 text-primary-700",
  Normal: "bg-neutral-100 text-neutral-600",
};

export function ProjectsHeroMock() {
  return (
    <div className="mx-auto max-w-md overflow-hidden rounded-[1.25rem] bg-gradient-to-br from-primary-400 via-primary-500 to-primary-700 p-3 sm:p-5">
      <div className="rounded-2xl bg-white p-4 shadow-[0_24px_48px_-24px_rgb(16_18_31/0.45)] sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate font-heading text-base font-bold tracking-[-0.01em] text-neutral-900">
            Website rebuild
          </p>
          <span className="tnum shrink-0 rounded-full bg-primary-50 px-2.5 py-1 text-[11px] font-semibold text-primary-700">
            Sprint 14
          </span>
        </div>

        <p className="mt-1 text-xs text-neutral-500">
          Delivery <span aria-hidden="true">/</span> Website rebuild
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {COLUMNS.map((column) => (
            <div key={column.title} className="min-w-0 rounded-xl bg-neutral-100 p-1.5 sm:p-2">
              <div className="flex items-center justify-between gap-1 px-0.5">
                <p className="flex min-w-0 items-center gap-1.5 text-[10px] font-semibold text-neutral-700 sm:text-[11px]">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-info-500" aria-hidden="true" />
                  <span className="truncate">{column.title}</span>
                </p>
                <span className="tnum shrink-0 text-[10px] font-medium text-neutral-500">
                  {column.count}
                </span>
              </div>

              <div className="mt-2 space-y-1.5">
                {column.cards.map((card) => (
                  <div
                    key={card.title}
                    className="rounded-lg border border-neutral-200 bg-white p-2"
                  >
                    <p className="text-[10px] font-medium leading-snug text-neutral-800 sm:text-[11px]">
                      {card.title}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between gap-1">
                      <span
                        className={`truncate rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${PRIORITY_STYLE[card.priority]}`}
                      >
                        {card.priority}
                      </span>
                      <span className="tnum hidden h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-600 text-[9px] font-semibold text-white min-[400px]:inline-flex">
                        {card.initials}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 border-t border-neutral-100 pt-3.5 text-sm leading-relaxed text-neutral-600">
          The same <span className="tnum font-semibold text-neutral-900">9</span> tasks,
          six ways to look at them. Switching views is one click, not a second
          plan to keep in sync.
        </p>
      </div>
    </div>
  );
}
