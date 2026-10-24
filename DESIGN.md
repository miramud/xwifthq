# XwiftHQ design system

XwiftHQ (formerly Elevate) is the all in one company workspace: Finance,
Admin and Operations, HRM, Projects and Learning on one login, one approvals
inbox and one audit trail.

**Brand colour: Xwift Purple `#9638CD` (`primary-600`).** White text on it is
5.6:1. Every colour token resolves through CSS variables in
`src/app/globals.css`, so a token change re-themes the public site and the
signed-in workspace together.

**Gradients lean light.** Purple surfaces are washes that start in the lighter
steps: buttons run `primary-500` to `primary-600`, panels and featured cards
`from-primary-400 via-primary-500 to-primary-700` (or start at `primary-300`
where only large text sits on them), and the logo tile carries a lilac sheen
from its top left corner.

## Copy rules (apply everywhere)

1. The product is **XwiftHQ**, spelled exactly so. Modules are "XwiftHQ Finance",
   "XwiftHQ HRM" and so on.
2. **Never use long dashes.** No em dash, no en dash, no `&mdash;` / `&ndash;`,
   in UI copy or in code comments. Use a comma, colon, full stop, parentheses,
   or "to" for ranges. A lone hyphen `-` stands for "no value" in tables.
3. Sentence case, plain verbs, short sentences, "you / your team" voice.
   Buttons say what happens ("Approve leave", "Get started free").
4. British spelling (organisation, colour). No filler ("seamless", "leverage",
   "robust", "cutting edge"). No emoji as icons (lucide only).
5. Never invent customers, logos, testimonials or usage numbers. Figures must be
   facts about how the product is built.

## Public site

Bright, airy SaaS: a lilac sky behind each hero with soft clouds at its edges,
pill buttons, product frames floating on a purple glow, pale bento tiles on
white, a deep purple closing panel. Headings set in Plus Jakarta Sans (bold,
tight tracking); body in Inter.

### Building blocks

| Piece | Where | Use |
|---|---|---|
| `Sky` | `components/site/Sky.tsx` | Hero wrapper: lilac gradient, clouds, `pt-28` so the floating navbar clears it. Any route that starts with it must be listed in `SKY_ROUTES` in `Navbar.tsx`. |
| `SectionHeading` | `components/site/SectionHeading.tsx` | Eyebrow pill + `xw-h2` title + muted intro. Centred by default, `align="left"` for split layouts. |
| `CtaPanel` | `components/site/CtaPanel.tsx` | The closing purple panel every page ends on. |
| `AppPreview` | `components/site/AppPreview.tsx` | Drawn workspace preview (approvals board) for heroes. |
| `AuthShell`, `AuthHeading`, `AUTH_INPUT` | `components/site/AuthShell.tsx` | Split sign in frame (form left, purple panel right). |
| `XwiftMark`, `XwiftLockup` | `components/shared/BrandLogo.tsx` | The logo. Variants `colour`, `reversed`, `mono`. |

### CSS utilities (`globals.css`)

- `xw-sky`, `xw-cloud`, `xw-drift`: hero sky and clouds.
- `xw-frame`: white product frame with a purple glow shadow.
- `xw-tile`: pale bento card (`neutral-100`, 20px radius).
- `xw-glow-card`: white card with a lilac wash in its top left corner.
- `xw-chip`: floating white pill label.
- `xw-eyebrow`: lilac pill above a section title.
- `xw-h1`, `xw-h2`, `xw-h3`: public heading scale.
- `btn-primary` (purple pill), `btn-outline` (white pill, grey border),
  `btn-accent` (ink pill, the dark secondary call to action).

### Page rhythm

Hero on `Sky` → white section → `bg-neutral-50` section → white … → `CtaPanel`.
Sections use `section-padding` and `section-container`. Cards use 20px radius
(`rounded-[1.25rem]`), borders `neutral-200/80`, no heavy shadows except
`xw-frame`. Icons sit in soft tinted rounded tiles.

## Signed-in workspace

Everything inside `.ws` (see `WorkspaceShell`). Light, calm, colourful:
white cards on the pale `canvas`, purple for action and selection, the hue set
(`coral`, `mint`, `grape`, `sun`, `sky`, `rose`) for telling things apart.
Plus Jakarta Sans throughout.

| Role | Token | Value |
|---|---|---|
| Canvas | `bg-canvas` | `#f6f5fa` |
| Ink | `text-neutral-900` | `#10121f` |
| Secondary text | `text-neutral-600` / `-500` | 500 is the lightest grey allowed for text |
| Action / selection | `primary-600`, hover `primary-700`, soft `primary-50` | `#9638cd` |

Components live in `src/components/workspace/` (`kit.tsx`, `DataView.tsx`,
`charts.tsx`, `Calendar.tsx`, `RichTextEditor.tsx`, `WorkspaceShell.tsx`).
Never write a raw hex in a component: use tokens or `HUE[hue]`.

### Dashboard language

Modelled on bright SaaS dashboards: white 20px cards with a faint purple glow
on a lilac-washed canvas, a white sidebar whose current page is a filled purple
pill, and colour used to tell things apart.

| Piece | Use |
|---|---|
| `WelcomeBanner` | A module's front page opens with it: deep purple greeting hero ("Good morning, Amaka"), one line on the page, the headline figure, the main actions (`bannerButtonClass`). Carries the page heading and the `page-header` tour anchor. |
| `StatCard` in a `StatGrid` | KPI row. Round gradient icon on the left, label, figure, a green or red delta pill and what it is measured against. One card per row may be `featured`. |
| `QuickActions` | "Quick links" tiles: tinted icon square, name underneath. Only links the viewer may open. |
| `Panel` + `ViewAllLink` | Every titled card; "View all" with an arrow in the header. |
| `CalloutStrip` | Tinted note inside a card ("You are on track"). |
| `Donut`, `ProgressRing`, `AreaLine`, `ColumnChart`, `Progress` | Totals in the centre, gradient fills, light tracks. |
| `ListRow` + `IconTile` (`suite/lms/components/ui/ws.tsx`) | List rows: icon tile, title, meta, trailing value, chevron when it links. |

Layout rhythm: banner, KPI row, quick links, then two-thirds / one-third
grids of panels with `gap-6`.

## Rules

1. A redesign moves pixels, not logic. Keep every API call, permission check,
   empty state, error path and `aria-*`. Existing tests must keep passing.
2. Colour is never the only signal.
3. Accessibility floor: visible focus rings, 44px touch targets, labelled
   inputs, `aria-label` on icon-only buttons, headings in order, reduced
   motion respected.
4. Responsive down to 375px with no sideways page scroll.
5. No new dependencies.
