"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CheckCircle2, DoorOpen, Hourglass, ListChecks, Plus, UserMinus } from "lucide-react";
import { Button, Card, Chip, Empty, PageHeader, PersonAvatar, StatGrid } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { todayYmd } from "@/components/workspace/Calendar";
import { ErrorNote, Field, Skeleton, StatCard, inputClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { FieldError, LoadError } from "@/suite/org/components/foundations/shared";
import { day } from "@/suite/finance/lib/format";
import { useListView } from "@/suite/finance/components/revenue/ui";
import { useAuth } from "@/lib/auth-store";
import { mayDoOps } from "@/suite/operations/lib/operations-access";
import { exitClearances, opsError, opsFieldErrors, type ExitClearance, type ExitSignoff } from "@/lib/api/operations-assets-client";
import { daysFrom, plural } from "./labels";
import { usePickerOptions } from "./parts";

/**
 * Exit clearances: everybody leaving, what they still hold, and the four
 * sign-offs. HRM's offboarding opens them; the desk can open one by hand.
 */

type Tab = "open" | "cleared" | "all";

/** The four sign-offs as small chips: a tick for signed, an hourglass for waiting. */
export function SignoffChips({ signoffs }: { signoffs: ExitSignoff[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Sign-offs">
      {signoffs.map((s) => (
        <li key={s.key}>
          <Chip hue={s.at ? "mint" : "slate"} icon={s.at ? CheckCircle2 : Hourglass}>
            {s.label}
            <span className="sr-only">{s.at ? `: signed by ${s.name ?? "somebody"}` : ": not signed"}</span>
          </Chip>
        </li>
      ))}
    </ul>
  );
}

export default function ExitClearances() {
  const router = useRouter();
  const { user } = useAuth();
  const [rows, setRows] = useState<ExitClearance[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [tab, setTab] = useState<Tab>("open");
  const [opening, setOpening] = useState(false);
  const listView = useListView("ops-exit-clearances");
  const today = todayYmd();

  useEffect(() => {
    let alive = true;
    exitClearances.list().then(
      (r) => {
        if (!alive) return;
        setRows(r);
        setError(null);
      },
      (e: unknown) => alive && setError(`Exit clearances didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  const all = useMemo(() => rows ?? [], [rows]);
  const shown = all.filter((c) => tab === "all" || c.status === tab);

  const columns: Column<ExitClearance>[] = [
    {
      key: "leaver",
      header: "Leaver",
      primary: true,
      sortable: true,
      value: (c) => c.leaver ?? "",
      render: (c) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <PersonAvatar name={c.leaver} size={30} />
          <span className="truncate font-semibold text-neutral-900">{c.leaver ?? "—"}</span>
        </span>
      ),
    },
    { key: "leaving", header: "Leaving", sortable: true, value: (c) => c.leavingOn ?? "", render: (c) => <LeavingOn c={c} today={today} /> },
    {
      key: "outstanding",
      header: "Outstanding",
      sortable: true,
      value: (c) => c.outstanding,
      render: (c) => (c.status === "cleared" ? <Chip hue="mint">Cleared</Chip> : c.outstanding > 0 ? <Chip hue="sun">{plural(c.outstanding, "item")}</Chip> : <Chip hue="mint">Nothing held</Chip>),
    },
    { key: "signoffs", header: "Sign-offs", value: (c) => c.signoffs.filter((s) => s.at).length, render: (c) => <SignoffChips signoffs={c.signoffs} /> },
  ];

  if (error && !rows) return <LoadError text={error} onRetry={() => setReload((k) => k + 1)} />;
  if (!rows) {
    return (
      <div aria-busy="true" className="space-y-5">
        <p className="sr-only">Loading exit clearances…</p>
        <Skeleton className="h-20" />
        <Skeleton className="h-[320px]" />
      </div>
    );
  }

  const open = all.filter((c) => c.status === "open");
  const soon = open.filter((c) => {
    const d = daysFrom(today, c.leavingOn);
    return d !== null && d <= 14;
  }).length;

  return (
    <div>
      <PageHeader
        title="Exit clearances"
        subtitle="Everybody leaving: what they still hold, and the four sign-offs. HR can't settle final pay until nothing is outstanding."
        actions={
          mayDoOps(user, "exit_clearances", "create") ? (
            <Button variant="primary" icon={Plus} onClick={() => setOpening(true)}>
              Open a clearance
            </Button>
          ) : undefined
        }
        tabs={[
          { key: "open", label: "Open", count: open.length },
          { key: "cleared", label: "Cleared", count: all.length - open.length },
          { key: "all", label: "All", count: all.length },
        ]}
        activeTab={tab}
        onTab={(k) => setTab(k as Tab)}
      />

      <div className="space-y-5">
        <StatGrid cols={3}>
          <StatCard featured label="Open clearances" value={open.length} icon={DoorOpen} hint="Opened by HR's offboarding" />
          <StatCard label="Items still outstanding" value={open.reduce((s, c) => s + c.outstanding, 0)} icon={ListChecks} hue="sun" hint="Not returned, deducted or written off" />
          <StatCard label="Leaving in the next 14 days" value={soon} icon={CalendarClock} hue={soon ? "coral" : "slate"} hint="Settle their items first" />
        </StatGrid>

        {all.length === 0 ? (
          <Card>
            <Empty icon={UserMinus} title="Nobody is leaving" hint="When HR starts somebody's offboarding, their clearance opens here with every asset they hold." />
          </Card>
        ) : (
          <DataView
            rows={shown}
            columns={columns}
            rowKey={(c) => c.id}
            rowHref={(c) => `/suite/operations/assets/exit-clearances/${c.id}`}
            {...listView}
            searchPlaceholder="Search by name"
            caption="Exit clearances"
            gridCols={3}
            renderCard={(c) => <ClearanceCard c={c} today={today} />}
            renderListItem={(c) => <ClearanceCard c={c} today={today} row />}
            empty={<p className="px-5 py-10 text-center text-sm text-neutral-500">Nothing here. Try another tab.</p>}
          />
        )}
      </div>

      {opening && (
        <OpenDialog
          onClose={() => setOpening(false)}
          onDone={(c) => {
            setOpening(false);
            router.push(`/suite/operations/assets/exit-clearances/${c.id}`);
          }}
        />
      )}
    </div>
  );
}

function LeavingOn({ c, today }: { c: ExitClearance; today: string }) {
  if (!c.leavingOn) return <span className="text-neutral-500">Not set</span>;
  const d = daysFrom(today, c.leavingOn);
  return (
    <span className="flex flex-wrap items-center gap-1.5 tabular-nums">
      {day(c.leavingOn)}
      {c.status === "open" && d !== null && d >= 0 && d <= 14 && <Chip hue="coral">{d === 0 ? "Today" : `In ${plural(d, "day")}`}</Chip>}
      {c.status === "open" && d !== null && d < 0 && <Chip hue="rose">Already left</Chip>}
    </span>
  );
}

function ClearanceCard({ c, today, row = false }: { c: ExitClearance; today: string; row?: boolean }) {
  return (
    <div className={row ? "flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between" : "flex h-full flex-col gap-3 p-5"}>
      <div className="flex min-w-0 items-center gap-3">
        <PersonAvatar name={c.leaver} size={36} />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-neutral-900">{c.leaver}</p>
          <p className="text-xs text-neutral-500">
            <LeavingOn c={c} today={today} />
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {c.status === "cleared" ? <Chip hue="mint">Cleared</Chip> : <Chip hue={c.outstanding ? "sun" : "mint"}>{c.outstanding ? `${plural(c.outstanding, "item")} outstanding` : "Nothing held"}</Chip>}
        <SignoffChips signoffs={c.signoffs} />
      </div>
    </div>
  );
}

function OpenDialog({ onDone, onClose }: { onDone: (c: ExitClearance) => void; onClose: () => void }) {
  const uid = useId();
  const { staff } = usePickerOptions();
  const [userId, setUserId] = useState("");
  const [leavingOn, setLeavingOn] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <DialogFrame
      as="form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!userId) {
          setErrors({ userId: "Choose who is leaving." });
          return;
        }
        setBusy(true);
        setErrors({});
        setError(null);
        try {
          onDone(await exitClearances.open({ userId, leavingOn: leavingOn || null }));
        } catch (err) {
          setErrors(opsFieldErrors(err));
          setError(opsError(err));
          setBusy(false);
        }
      }}
      titleId={`${uid}-title`}
      title="Open an exit clearance"
      subtitle="Usually HR's offboarding opens it. Every asset they hold is listed."
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Opening…" : "Open the clearance"}
          </Button>
        </div>
      }
    >
      <Field id={`${uid}-who`} label="Who is leaving">
        <SearchableSelect
          id={`${uid}-who`}
          value={userId}
          onChange={setUserId}
          options={staff ?? []}
          placeholder={staff === null ? "Loading staff…" : "Choose a member of staff"}
          searchPlaceholder="Search staff"
          aria-invalid={errors.userId ? true : undefined}
        />
        <FieldError message={errors.userId} />
      </Field>
      <Field id={`${uid}-on`} label="Leaving on" hint="Optional">
        <input id={`${uid}-on`} type="date" className={inputClass} value={leavingOn} onChange={(e) => setLeavingOn(e.target.value)} />
      </Field>
      {error && !errors.userId && <ErrorNote>{error}</ErrorNote>}
    </DialogFrame>
  );
}
