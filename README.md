# Elevate LMS — web app

The Next.js 16 App Router frontend. Talks to the Laravel API in
[`../api-lms`](../api-lms); see [the root README](../README.md) for how the two
fit together.

## Read this before writing framework code

`AGENTS.md` (loaded by `CLAUDE.md`) carries the warning that matters most here:
**this version of Next.js diverges from older documentation.** Most visibly,
`middleware.ts` is now `src/proxy.ts`, exporting `proxy()` and `config.matcher`.
Check `node_modules/next/dist/docs/` before reaching for a remembered API.

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
```

Set `LMS_API_URL` in `.env.local` (defaults to `http://localhost:8000/api`).

## Checks

```bash
npm run typecheck  # tsc --noEmit
npm run lint
npm test           # vitest
npm run build
```

## How data gets in

The Sanctum token lives in an httpOnly cookie and is only ever read on the
server. Nothing in the browser bundle holds a credential.

| Layer | Where | Notes |
| --- | --- | --- |
| Server helper | `src/lib/api/server.ts` | `lmsFetch` / `getServerUser`; reads the cookie. `server-only`. |
| Public catalog | `src/lib/api/public.ts` | ISR-cached, `revalidate: 300`. `server-only`. |
| Route handlers | `src/app/api/**` | Same-origin proxy; re-attaches the bearer token. |
| Browser clients | `src/lib/api/*-client.ts` | One per surface, each exporting a typed `ApiError`. |

**Components never call `fetch` directly** — they go through a client module.

## Conventions

- TypeScript `strict`, and **no `any`** anywhere in `src/`.
- State is React Context only (`src/lib/store.ts`, `src/lib/auth-store.ts`). No
  Redux, Zustand or React Query.
- Never hardcode the revenue split: `usePlatformFee()` reads the admin-managed
  percentage from `/auth/me`.
- Instructor-authored article HTML always passes through
  `src/lib/sanitize-html.ts` before `dangerouslySetInnerHTML`. It is an
  allowlist, it is covered by tests, and it fails closed on the server.
- Styling is Tailwind v4 utilities with the semantic tokens in `globals.css`
  (`primary-600`, `neutral-800`, `error-500`…), `clsx` for conditionals, and
  `lucide-react` for icons. No component library.
- Every route group has an `error.tsx`; server-rendered routes have a
  `loading.tsx` whose skeleton matches the real layout so nothing shifts.
