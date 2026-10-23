/**
 * The mock that sits beside the headline on the Projects hero.
 *
 * It draws a board rather than describing one, because the whole claim of this
 * page is about what the interface looks like — a page that only asserts
 * "easier" has conceded the argument before the fold.
 *
 * Everything here sits on deep teal, so the surfaces are white at low opacity
 * rather than `hue.tile`: a 10%-tinted sky panel on teal is a smudge. Sky
 * appears only as a graphic accent on the progress bars, where it is a data
 * mark on the product's own surface and clears the 3:1 non-text bar.
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

export function ProjectsHeroMock() {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-white/15 bg-white/[0.07] p-6 backdrop-blur-sm">
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-heading text-lg font-semibold text-white">
          Website rebuild
        </p>
        <p className="label-mono text-white/70">
          <span className="tnum">Sprint 14</span>
        </p>
      </div>

      <p className="label-mono mt-1 text-white/70">
        Delivery <span aria-hidden="true">/</span> Website rebuild
      </p>

      <div className="mt-5 grid grid-cols-3 gap-2.5">
        {COLUMNS.map((column) => (
          <div key={column.title} className="min-w-0">
            <div className="flex items-center justify-between gap-1">
              <p className="label-mono truncate text-white/70">{column.title}</p>
              <span className="tnum label-mono text-white/70">
                {column.count}
              </span>
            </div>
            <span
              className="mt-2 block h-0.5 w-full rounded-full bg-info-400/60"
              aria-hidden="true"
            />

            <div className="mt-2.5 space-y-2">
              {column.cards.map((card) => (
                <div
                  key={card.title}
                  className="rounded-lg border border-white/15 bg-white/[0.06] p-2.5"
                >
                  <p className="text-[11px] leading-snug text-white/85">
                    {card.title}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-1">
                    <span className="label-mono text-white/70">
                      {card.priority}
                    </span>
                    <span className="tnum inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/15 text-[10px] font-semibold text-white/80">
                      {card.initials}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-5 border-t border-white/10 pt-4 text-sm leading-relaxed text-white/70">
        The same <span className="tnum font-semibold text-white">9</span> tasks,
        seen six ways. Switching view is a toggle, not a second plan.
      </p>
    </div>
  );
}
