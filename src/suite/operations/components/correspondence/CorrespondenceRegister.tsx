"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlarmClock, CalendarRange, Inbox, Mailbox, MailOpen, PenLine, Send, UserX } from "lucide-react";
import { Button, Chip, PageHeader, Segmented, StatGrid, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { downloadCsv } from "@/components/workspace/csv";
import { FaceAvatar, Skeleton, StatCard, inputClass } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { useListView } from "@/suite/finance/components/revenue/ui";
import { useAuth } from "@/lib/auth-store";
import { mayDoOps } from "@/suite/operations/lib/operations-access";
import { correspondence, opsError, type Direction, type Letter, type Register, type RegisterOptions } from "@/lib/api/operations-correspondence-client";
import { ConfidentialChip, DirectionMark, DueChip, LetterStatusChip, RefStamp } from "./parts";
import { IN_OPEN, LETTER_STATUS, dayText, letterRows } from "./labels";
import LetterDialog from "./LetterDialog";

type DirectionFilter = "" | Direction;

/** The status filter: anything still waiting, everything, or one status. */
const STATUS_OPTIONS = [
  { value: "open", label: "Awaiting action or dispatch" },
  { value: "all", label: "Every status" },
  ...Object.entries(LETTER_STATUS).map(([value, m]) => ({ value, label: m.label, group: ["received", "assigned", "in_progress", "responded", "closed"].includes(value) ? "Received" : value === "cancelled" ? "Either" : "Sent" })),
];

/** Waits a moment after typing stops, so the register is not asked on every key. */
function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/**
 * The correspondence register: every letter received and sent, searchable
 * by reference, party, unit, project and date; what is waiting, what is
 * overdue and what is ready to go out at the top.
 */
export default function CorrespondenceRegister() {
  const { user } = useAuth();
  const router = useRouter();
  const [direction, setDirection] = useState<DirectionFilter>("");
  const [status, setStatus] = useState("open");
  const [overdue, setOverdue] = useState<"all" | "overdue">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [unitId, setUnitId] = useState("");
  const [partyText, setPartyText] = useState("");
  const party = useDebounced(partyText.trim());
  const [reg, setReg] = useState<Register | null>(null);
  const [options, setOptions] = useState<RegisterOptions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [dialog, setDialog] = useState<Direction | null>(null);
  const listView = useListView("ops-correspondence");
  const canCreate = mayDoOps(user, "correspondence", "create");

  useEffect(() => {
    let alive = true;
    correspondence
      .list({ direction, status, from: from || undefined, to: to || undefined, unitId: unitId || undefined, party: party || undefined, overdue: overdue === "overdue" })
      .then(
        (r) => {
          if (!alive) return;
          setReg(r);
          setError(null);
        },
        (e: unknown) => alive && setError(`The register didn't load. ${opsError(e)}`),
      );
    return () => {
      alive = false;
    };
  }, [direction, status, from, to, unitId, party, overdue, reload]);

  useEffect(() => {
    let alive = true;
    correspondence.options().then(
      (o) => alive && setOptions(o),
      () => alive && setOptions({ staff: [], units: [], parties: [], projects: [], channels: { hand: "By hand", post: "Post", courier: "Courier", email: "Email" } }),
    );
    return () => {
      alive = false;
    };
  }, []);

  const rows = reg?.letters ?? [];
  const replyTargets = useMemo(
    () => rows.filter((l) => l.direction === "incoming" && l.status !== "cancelled").map((l) => ({ value: l.id, label: `${l.reference ?? ""} · ${l.subject}`, hint: l.party ?? undefined })),
    [rows],
  );

  if (error && !reg) {
    return (
      <div>
        <PageHeader title="Correspondence" />
        <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  }
  if (!reg) {
    return (
      <div aria-busy="true" className="space-y-5">
        <p className="sr-only">Loading the register…</p>
        <Skeleton className="h-20" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[132px]" />
          ))}
        </div>
        <Skeleton className="h-[420px]" />
      </div>
    );
  }

  const s = reg.summary;
  const filtered = Boolean(direction || status !== "open" || from || to || unitId || party || overdue === "overdue");

  const columns: Column<Letter>[] = [
    {
      key: "subject",
      header: "Letter",
      primary: true,
      sortable: true,
      value: (l) => `${l.reference ?? ""} ${l.subject}`,
      render: (l) => (
        <span className="flex min-w-0 items-center gap-3">
          <DirectionMark direction={l.direction} size={34} />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5">
              <span className="truncate font-semibold text-neutral-900">{l.subject}</span>
              {l.confidentiality === "confidential" && <span className="sr-only">(confidential)</span>}
            </span>
            <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <RefStamp reference={l.reference} />
              {l.confidentiality === "confidential" && <ConfidentialChip />}
            </span>
          </span>
        </span>
      ),
    },
    {
      key: "party",
      header: "From / to",
      sortable: true,
      value: (l) => l.party ?? "",
      render: (l) => (
        <span className="block min-w-0">
          <span className="block truncate text-neutral-800">{l.party ?? "—"}</span>
          {(l.partyOrganisation || l.partyReference) && <span className="block truncate text-xs text-neutral-500">{[l.partyOrganisation, l.partyReference].filter(Boolean).join(" · ")}</span>}
        </span>
      ),
    },
    { key: "date", header: "Date", sortable: true, hideOnMobile: true, value: (l) => l.date ?? "", render: (l) => <span className="tabular-nums text-neutral-700">{dayText(l.date)}</span> },
    {
      key: "officer",
      header: "With",
      sortable: true,
      hideOnMobile: true,
      value: (l) => (l.direction === "incoming" ? (l.assignee ?? "") : (l.signatory ?? "")),
      render: (l) =>
        l.direction === "incoming" ? (
          l.assignee ? (
            <span className="flex items-center gap-2">
              <FaceAvatar name={l.assignee} size={24} />
              <span className="min-w-0">
                <span className="block truncate text-neutral-800">{l.assignee}</span>
                {l.assignedUnit && <span className="block truncate text-xs text-neutral-500">{l.assignedUnit}</span>}
              </span>
            </span>
          ) : IN_OPEN.includes(l.status) ? (
            <Chip hue="coral">Not routed</Chip>
          ) : (
            <span className="text-neutral-500">—</span>
          )
        ) : (
          <span className="text-neutral-700">{l.signatory ? `Signed: ${l.signatory}` : "—"}</span>
        ),
    },
    { key: "due", header: "Due", sortable: true, value: (l) => l.dueOn ?? "9999", render: (l) => <DueChip letter={l} /> },
    { key: "status", header: "Status", sortable: true, value: (l) => LETTER_STATUS[l.status]?.label ?? l.status, render: (l) => <LetterStatusChip status={l.status} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Correspondence"
        subtitle="Every letter received and sent: who it is with, what is overdue and what is ready to go out."
        actions={
          canCreate && (
            <>
              <Button icon={PenLine} onClick={() => setDialog("outgoing")}>
                Draft a letter
              </Button>
              <Button variant="primary" icon={Mailbox} onClick={() => setDialog("incoming")}>
                Log a letter received
              </Button>
            </>
          )
        }
      />

      <div className="space-y-5">
        <StatGrid cols={4}>
          <StatCard featured label="Awaiting action" value={s.open} icon={MailOpen} hint={`${s.receivedThisMonth} received this month`} />
          <StatCard label="Overdue" value={s.overdue} icon={AlarmClock} hue={s.overdue ? "rose" : "mint"} hint={s.overdue ? "Past the date they were due" : "Nothing late"} />
          <StatCard label="Not yet routed" value={s.unassigned} icon={UserX} hue={s.unassigned ? "coral" : "mint"} hint={s.awaitingClosure ? `${s.awaitingClosure} responded, to close` : "Every letter has an officer"} />
          <StatCard label="Ready to dispatch" value={s.toDispatch} icon={Send} hue="sky" hint={`${s.inApproval} in approval · ${s.sentThisMonth} sent this month`} />
        </StatGrid>

        <section aria-labelledby="register-h" className="space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 id="register-h" className="text-[15px] font-semibold text-neutral-900">
                The register
              </h2>
              <p className="text-xs text-neutral-500">Newest first. Search covers references, subjects and parties.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Segmented
                label="Direction"
                value={direction === "" ? "all" : direction}
                onChange={(v) => setDirection(v === "all" ? "" : (v as Direction))}
                options={[
                  { key: "all", label: "Both" },
                  { key: "incoming", label: "Received" },
                  { key: "outgoing", label: "Sent" },
                ]}
              />
              <Segmented
                label="Overdue"
                value={overdue}
                onChange={setOverdue}
                options={[
                  { key: "all", label: "Any due date" },
                  { key: "overdue", label: "Overdue only" },
                ]}
              />
            </div>
          </div>

          <div className="ws-card grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-5">
            <div>
              <label htmlFor="corr-status" className="mb-1.5 block text-xs font-medium text-neutral-600">
                Status
              </label>
              <SearchableSelect id="corr-status" size="sm" value={status} onChange={(v) => setStatus(v || "open")} options={STATUS_OPTIONS} />
            </div>
            <div>
              <label htmlFor="corr-unit" className="mb-1.5 block text-xs font-medium text-neutral-600">
                Unit
              </label>
              <SearchableSelect id="corr-unit" size="sm" value={unitId} onChange={setUnitId} options={(options?.units ?? []).map((u) => ({ value: u.id, label: u.name, hint: u.code ?? undefined }))} clearable clearLabel="Every unit" placeholder="Every unit" noOptionsText={options ? "No units set up" : "Loading…"} />
            </div>
            <div>
              <label htmlFor="corr-party" className="mb-1.5 block text-xs font-medium text-neutral-600">
                Sender or recipient
              </label>
              <input id="corr-party" className={cx(inputClass, "h-9")} value={partyText} onChange={(e) => setPartyText(e.target.value)} placeholder="NBTE, Leadway…" maxLength={120} />
            </div>
            <div>
              <label htmlFor="corr-from" className="mb-1.5 flex items-center gap-1 text-xs font-medium text-neutral-600">
                <CalendarRange size={12} aria-hidden /> From
              </label>
              <input id="corr-from" type="date" className={cx(inputClass, "h-9")} value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label htmlFor="corr-to" className="mb-1.5 block text-xs font-medium text-neutral-600">
                To
              </label>
              <input id="corr-to" type="date" className={cx(inputClass, "h-9")} value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>

          <DataView
            rows={rows}
            columns={columns}
            rowKey={(l) => l.id}
            rowHref={(l) => `/suite/operations/correspondence/${l.id}`}
            {...listView}
            searchPlaceholder="Search references, subjects or parties"
            caption="The correspondence register"
            onDownload={(r) => downloadCsv(`correspondence_${direction || "all"}_${status}${overdue === "overdue" ? "_overdue" : ""}${from ? `_from-${from}` : ""}${to ? `_to-${to}` : ""}.csv`, letterRows(r))}
            renderCard={(l) => (
              <div className={cx("flex h-full flex-col gap-3 p-5", l.overdue && "bg-rose-50/40")}>
                <div className="flex items-start justify-between gap-2">
                  <DirectionMark direction={l.direction} />
                  <LetterStatusChip status={l.status} />
                </div>
                <div className="min-w-0">
                  <p className="line-clamp-2 text-[15px] font-semibold text-neutral-900">{l.subject}</p>
                  <p className="mt-0.5 truncate text-xs text-neutral-500">
                    {l.direction === "incoming" ? "From" : "To"} {l.party ?? "—"} · {dayText(l.date)}
                  </p>
                </div>
                <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
                  <RefStamp reference={l.reference} />
                  {l.confidentiality === "confidential" && <ConfidentialChip />}
                  <DueChip letter={l} />
                </div>
              </div>
            )}
            empty={
              <div className="px-5 py-10 text-center text-sm text-neutral-500">
                <Inbox size={18} className="mx-auto mb-2 text-neutral-400" aria-hidden />
                {filtered ? "No letters match these filters." : "Nothing waiting. Log the next letter when it arrives."}
              </div>
            }
          />
        </section>
      </div>

      {dialog && (
        <LetterDialog
          direction={dialog}
          options={options}
          registry={reg.registry}
          replyTargets={replyTargets}
          onClose={() => setDialog(null)}
          onDone={(l) => {
            setDialog(null);
            router.push(`/suite/operations/correspondence/${l.id}`);
          }}
        />
      )}
    </div>
  );
}
