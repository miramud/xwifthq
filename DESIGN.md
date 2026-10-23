# Elevate Workspace — design system

The visual language of every signed-in suite surface (HR, Projects, LMS console,
teaching studio, organisation console). Modelled on the reference dashboards the
product owner supplied: Canvaso (board), Worktion (dashboard, timeline, gauge),
Deli-Plany (project detail + activity), TaskMaster (calendar, hatched bars),
Finora (featured stat card, segmented gauge), Shopeers (stat row, line chart,
table), Taskora (week schedule), Panze (status bars, donut, pastel task cards).

**Light, cool, colourful, rounded, calm.** White cards floating on a pale
blue-grey canvas; one clear blue for action and selection; a set of hues for
telling things apart; generous spacing; Plus Jakarta Sans throughout.

The marketing site is untouched — it keeps its teal and Poppins. Everything
below applies inside `.ws`, which `WorkspaceShell` puts on its root.

---

## Tokens (see `src/app/globals.css`)

| Role | Token | Value |
|---|---|---|
| Canvas | `bg-canvas` | #f4f6fb |
| Surface | `bg-white` + `ws-card` | white, 1px `neutral-200/80`, 18px radius, soft shadow |
| Ink | `text-neutral-900` | #0f172a |
| Body / secondary text | `text-neutral-600` / `text-neutral-500` | 500 is the lightest grey allowed for text (4.76:1) |
| Glyphs, borders only | `neutral-400`, `neutral-200` | never text |
| Action / selection | `primary-600` (hover 700), soft `primary-50` | #2563eb, white on it 5.17:1 |
| Hues | `coral`, `mint`, `grape`, `sun`, `sky`, `rose` | each has 50/100 (wash), 500 (mark/bar), 600/700 (text on its wash) |
| Semantic | `error-*` for destructive/failure, `mint` for success, `sun` for warning, `sky` for info |

**Never** write a raw hex in a component. Use the tokens or `HUE[hue]` from
`components/workspace/modules.ts`. For per-item colour use `hueFor(name)` so a
person / project / leave type is the same colour on every screen.

Type scale: page title 28px bold tracking-tight; card title 15px semibold;
body 14px; captions 12–13px; numbers `tabular-nums`. Big KPI numbers 28–30px
bold.

Radius: cards 18px (`ws-card` / `rounded-[1.125rem]`), controls `rounded-xl`
(12px), chips and avatars full. Controls are 44px tall (`h-11`) — 36px (`h-9`)
only for dense toolbars.

**Signature texture: the hatch.** `ws-hatch` fills the *remaining* part of any
bar, progress track, capacity column or out-of-month calendar day. "Not yet"
reads as texture, never as an empty grey trough.

## Components (`src/components/workspace/`)

Import from these; do not rebuild them per page.

- `kit.tsx`
  - `Card`, `Panel` (card with title row, optional hue icon tile, actions)
  - `PageHeader` (title, subtitle, eyebrow, actions, underline `tabs`)
  - `UnderlineTabs`
  - `Button`, `ButtonLink`, `buttonClass(variant, size)` — variants `primary` / `secondary` / `ghost` / `danger`; **one primary per screen**
  - `StatCard` (label, value, unit, icon, hue, delta, deltaLabel, hint, href, `featured`), `StatGrid`
  - `Chip` (hue, dot, icon), `PriorityChip`
  - `PersonAvatar`, `AvatarStack`, `initialsOf`
  - `Progress` (hatched remainder)
  - `Toolbar`, `SearchField`, `Segmented`
  - `Empty` (icon tile + title + hint + action)
- `DataView.tsx` — **every collection with rows** (item 4 of the brief). One component, three views: table (sortable, `aria-sort`), grid (cards), list. The toggle is remembered per page via `storageKey`. Supply `columns` (mark one `primary`), `rowKey`, `rowHref` or `onRowClick`, and optionally `renderCard` / `renderListItem` for a richer card; otherwise both are generated from the columns. Filters go in `toolbar`.
- `charts.tsx`
  - `SegmentedGauge` (half-ring of ticks), `ColumnChart` (rounded columns in hatched capacity, peak called out in a bubble)
  - `Donut` (rounded segments + legend), `StatusBars` (Panze bars), `AreaLine` (smooth line, dashed comparison, hover tooltip), `Legend`
  - Every chart has a caption, and a hidden table for screen readers.
- `Calendar.tsx` — `MonthCalendar` (Monday-first, hatched outside days, today as a blue dot, holidays tinted, coloured event chips, "+n more"), `WeekSchedule` (hour axis, pastel time blocks with a time chip), `CalendarNav`, `eventBlockClass(hue)`.
- `RichTextEditor.tsx` / `RichTextView.tsx` — **every multi-line text box** (since 13 Oct 2026). `variant="full"` is the Word-style ribbon on a page (styles, colour, lists, alignment, links, tables, word count) for documents — memos, descriptions, PRDs; `compact` (bold, italic, underline, lists, link) for comments, notes and questions. The value is HTML, or `""` when empty; pass `id` and keep the `<label htmlFor>`. Show the text back with `RichTextView` (`size="sm"` in timelines), never `{text}` in a `whitespace-pre-line` div. Helpers in `src/lib/richText.ts` (`isRichBlank` for "required", `richExcerpt` for one-line previews). The API cleans what it stores with `App\Suite\Core\Support\RichText` and sends `RichText::plain()` to notifications, WhatsApp, Slack and AI. Single-line inputs (names, titles, amounts) stay `<input>`.
- `WorkspaceShell.tsx` — the chrome: sidebar (grouped nav, nav search, collapse, mobile drawer) and top bar (breadcrumb + title, `SuiteSwitcher`, notifications, `ProfileMenu`). Module shells (`HrmShell`, `ProjectsShell`, `AdminShell`, `InstructorShell`) only pass their nav.

The older primitives in `components/dashboard/ui.tsx` (`SectionCard`, `Pill`,
`EmptyState`, `PageHeading`, `StatTile`, `Tabs`, …) have been restyled to match
and still work, but **new and redesigned pages should use the workspace kit**.

## Page recipes

**Dashboard / overview** (Worktion, Shopeers, Finora): `PageHeader` with a
greeting or title and the page's one primary action → a `StatGrid` of 4 stat
cards (the first may be `featured`) → a 2/3 + 1/3 row: a big chart `Panel`
(ColumnChart or AreaLine) beside a gauge or donut `Panel` → a row of list
panels (upcoming, needs attention, recent activity) → a `DataView` of the main
collection.

**Collection page** (people, requisitions, courses, contracts…): `PageHeader`
(title, count, primary "New …" action, underline tabs for status) → optional
3–4 stat cards → `DataView` with a rich `renderCard` (avatar/icon, name,
two or three facts as chips, a progress bar where there is one).

**Detail page** (Deli-Plany): `PageHeader` with back link, name, status chip
and actions → underline tabs (Overview · Tasks · Team · Files · Activity …) →
2/3 main column of `Panel`s (information rows with icon + label + value) and a
1/3 side column (people, activity timeline with avatars, key dates).

**Board** (Canvaso): columns as soft `neutral-100/70` lanes with a coloured
status icon, name and count and a "+" button; cards are white `ws-card` with a
`PriorityChip`, title, one-line description, avatars at top right, and a
footer of due date, comments and attachments. "Add task" as a dashed button at
the bottom of each lane.

**Calendar** (TaskMaster, Taskora): `CalendarNav` + `Segmented` month/week →
`MonthCalendar` or `WeekSchedule`. Colour by project / leave type / team with
`hueFor`, and show a legend.

**Analytics** (Worktion, Panze, Shopeers): stat row → one hero chart with a
period `Segmented` (weekly / monthly) → supporting donut / status bars / gauge
→ a `DataView` of the underlying figures (the table view is the accessible
version of the charts).

## Rules

1. **Behaviour does not change.** A redesign moves pixels, not logic. Keep every
   API call, permission check, empty state, error path, form validation and
   `aria-*`. Existing tests must keep passing. Update a test only where it
   asserted markup that intentionally changed, and say so.
2. **Colour is never the only signal.** Chips carry words; charts carry legends
   and hidden tables; statuses have icons or text.
3. **Accessibility floor:** visible focus rings, 44px touch targets, labels on
   every input, `aria-label` on icon-only buttons, headings in order, reduced
   motion respected (the global CSS already disables animation under
   `prefers-reduced-motion`).
4. **Copy:** sentence case, plain verbs, name things by what people control.
   Buttons say what happens ("Approve leave", not "Submit"). Empty states say
   what to do next. No emoji as icons (lucide only).
5. **Responsive:** works at 375px. Tables scroll horizontally inside their card;
   grids reflow to one column; the sidebar becomes a drawer.
6. **No new dependencies.** Charts are hand-drawn SVG in `charts.tsx`; extend
   that file rather than adding a library. The one exception is the text
   editor: a Word-style editor is not hand-built, so `@tiptap/*` (pinned, exact
   versions) backs `RichTextEditor`.
