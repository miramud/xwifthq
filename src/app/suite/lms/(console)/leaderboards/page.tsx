"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, Medal, Trophy, Users } from "lucide-react";
import { Chip, Empty, PageHeader, Panel } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { HUE, hueFor } from "@/components/workspace/modules";
import { ErrorNote } from "@/suite/lms/components/ui/ws";
import { ApiError, type Leaderboard, type LeaderboardRow } from "@/lib/api/saas-client";

/**
 * The institution's three boards, in one place.
 *
 * An admin's question is not "who is winning" but "who has stalled", so the
 * ranking is shown alongside the count of people on it — a board of four names
 * out of a cohort of ninety is the actual finding, and a bare top-twenty hides
 * it.
 *
 * Every board is scoped to this institution by the API. Nothing here can widen
 * that.
 */

type Scope = "usage" | "course" | "learning_path";

interface Subject {
  slug: string;
  title: string;
}

const SCOPES: { key: Scope; label: string; hint: string }[] = [
  { key: "usage", label: "Overall", hint: "Learners ranked by courses finished" },
  { key: "course", label: "By course", hint: "How far through one course each learner is" },
  {
    key: "learning_path",
    label: "By learning path",
    hint: "Required courses finished on one path",
  },
];

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(body?.message ?? "Request failed.", res.status, body?.errors);
  }

  return body as T;
}

export default function AdminLeaderboardsPage() {
  const [scope, setScope] = useState<Scope>("usage");
  const [courses, setCourses] = useState<Subject[]>([]);
  const [paths, setPaths] = useState<Subject[]>([]);
  const [subject, setSubject] = useState("");

  /**
   * The board carries the URL it answers, so "loading" is derived rather than a
   * flag written synchronously inside an effect — that would cost a cascading
   * render on every scope change.
   */
  const [result, setResult] = useState<{ url: string; board: Leaderboard | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The pickers, loaded once. Both lists are already tenant-scoped by the API.
  useEffect(() => {
    let alive = true;

    Promise.all([
      get<{ data?: Subject[] }>("/api/admin/courses").catch(() => ({ data: [] })),
      get<{ data?: Subject[] }>("/api/admin/learning-paths").catch(() => ({ data: [] })),
    ]).then(([courseBody, pathBody]) => {
      if (!alive) return;
      setCourses(courseBody.data ?? []);
      setPaths(pathBody.data ?? []);
    });

    return () => {
      alive = false;
    };
  }, []);

  const options = useMemo(
    () => (scope === "course" ? courses : scope === "learning_path" ? paths : []),
    [scope, courses, paths],
  );

  /**
   * Switching scope invalidates whichever subject was picked for the last one,
   * so the effective subject is derived instead of reset in an effect.
   */
  const chosen = options.some((option) => option.slug === subject)
    ? subject
    : (options[0]?.slug ?? "");

  // Null when there is nothing to rank — a path scope in an institution with no
  // paths must not fire a request against an empty slug.
  const url = useMemo<string | null>(() => {
    if (scope === "usage") return "/api/admin/leaderboards/usage";
    if (chosen === "") return null;

    return scope === "course"
      ? `/api/admin/leaderboards/courses/${encodeURIComponent(chosen)}`
      : `/api/admin/leaderboards/learning-paths/${encodeURIComponent(chosen)}`;
  }, [scope, chosen]);

  const loading = url !== null && result?.url !== url;
  const board = result?.url === url ? result.board : null;

  useEffect(() => {
    if (url === null) return;

    let alive = true;

    get<{ data?: Leaderboard }>(url)
      .then((body) => {
        if (!alive) return;
        setResult({ url, board: body.data ?? null });
        setError(null);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setResult({ url, board: null });
        setError(e instanceof ApiError ? e.message : "Could not load that leaderboard.");
      });

    return () => {
      alive = false;
    };
  }, [url]);

  const active = SCOPES.find((s) => s.key === scope);

  const score = (row: LeaderboardRow, unit?: string) =>
    unit === "courses" ? (
      <span className="shrink-0 text-sm font-semibold tabular-nums text-neutral-900">
        {row.score} {row.score === 1 ? "course" : "courses"}
      </span>
    ) : (
      <span className="flex shrink-0 items-center gap-2">
        <span
          className="ws-hatch hidden h-2 w-28 overflow-hidden rounded-full sm:block"
          role="img"
          aria-label={`${row.score} percent complete`}
        >
          <span className="block h-full rounded-full bg-grape-500" style={{ width: `${row.score}%` }} />
        </span>
        <span className="w-10 text-right text-sm font-semibold tabular-nums text-neutral-900">{row.score}%</span>
      </span>
    );

  const columns: Column<LeaderboardRow>[] = [
    {
      key: "rank",
      header: "Rank",
      sortable: true,
      value: (r) => r.rank,
      render: (r) => <RankBadge rank={r.rank} />,
    },
    {
      key: "name",
      header: "Learner",
      primary: true,
      sortable: true,
      value: (r) => r.name,
      render: (r) => (
        <span className="flex items-center gap-3">
          <Initials initials={r.initials} name={r.name} />
          <span className="truncate font-medium text-neutral-900">{r.name}</span>
        </span>
      ),
    },
    {
      key: "score",
      header: board?.unit === "courses" ? "Courses finished" : "Progress",
      align: "right",
      sortable: true,
      value: (r) => r.score,
      render: (r) => <span className="inline-flex justify-end">{score(r, board?.unit)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leaderboards"
        subtitle="Who is progressing, and who has stalled. Scoped to your institution."
      />

      {error && (
        <ErrorNote className="flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0" aria-hidden />
          {error}
        </ErrorNote>
      )}

      <Panel
        title={active?.label}
        subtitle={active?.hint}
        icon={Trophy}
        hue="sun"
        actions={
          board ? (
            <Chip hue="grape" icon={Users}>
              {board.total} {board.total === 1 ? "learner" : "learners"} with progress
            </Chip>
          ) : undefined
        }
      >
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchableSelect
            className="sm:w-56"
            aria-label="Leaderboard type"
            value={scope}
            onChange={(v) => setScope(v as Scope)}
            options={SCOPES.map((s) => ({ value: s.key, label: s.label, hint: s.hint }))}
          />

          {scope !== "usage" && (
            <SearchableSelect
              className="min-w-0 flex-1"
              aria-label={scope === "course" ? "Which course" : "Which learning path"}
              value={chosen}
              onChange={setSubject}
              disabled={options.length === 0}
              placeholder="Nothing to rank yet"
              searchPlaceholder={scope === "course" ? "Search courses" : "Search learning paths"}
              options={options.map((option) => ({ value: option.slug, label: option.title }))}
            />
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-12 text-sm text-neutral-500">
            <Loader2 size={15} className="animate-spin" aria-hidden />
            Loading the leaderboard…
          </div>
        ) : board === null || board.rows.length === 0 ? (
          <Empty
            icon={Trophy}
            hue="sun"
            title="Nobody on this board yet"
            hint="A learner appears once they have made some progress. Nobody is listed at zero."
          />
        ) : (
          <DataView
            rows={board.rows}
            columns={columns}
            rowKey={(r) => `${r.rank}-${r.name}`}
            storageKey="lms.leaderboards"
            defaultView="list"
            caption={`${active?.label ?? "Leaderboard"} ranking`}
            searchPlaceholder="Find a learner"
            renderCard={(r) => (
              <div className="flex h-full flex-col items-center gap-3 p-5 text-center">
                <RankBadge rank={r.rank} />
                <Initials initials={r.initials} name={r.name} size={52} />
                <p className="truncate text-sm font-semibold text-neutral-900">{r.name}</p>
                <div className="mt-auto">{score(r, board.unit)}</div>
              </div>
            )}
            renderListItem={(r) => (
              <div className="flex items-center gap-3 px-5 py-3">
                <RankBadge rank={r.rank} />
                <Initials initials={r.initials} name={r.name} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-800">{r.name}</span>
                {score(r, board.unit)}
              </div>
            )}
          />
        )}
      </Panel>
    </div>
  );
}

/** The top three wear medal colours; everyone else a quiet number. */
function RankBadge({ rank }: { rank: number }) {
  const medal =
    rank === 1
      ? "bg-sun-400 text-neutral-900"
      : rank === 2
        ? "bg-neutral-200 text-neutral-800"
        : rank === 3
          ? "bg-coral-100 text-coral-700"
          : "bg-neutral-50 text-neutral-500";
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-bold tabular-nums ${medal}`}
      aria-label={`Rank ${rank}`}
    >
      {rank <= 3 ? <Medal size={15} aria-hidden /> : rank}
      {rank <= 3 && <span className="sr-only">{rank}</span>}
    </span>
  );
}

function Initials({ initials, name, size = 36 }: { initials: string; name: string; size?: number }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.34) }}
      className={`flex shrink-0 items-center justify-center rounded-full font-bold ${HUE[hueFor(name)].soft}`}
    >
      {initials}
    </span>
  );
}
