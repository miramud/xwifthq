"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, DoorOpen, Hourglass, PackageOpen, Plus, ShoppingCart } from "lucide-react";
import { Button, Card, Chip, Empty, PageHeader, Panel, PersonAvatar, StatGrid, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { ColumnChart } from "@/components/workspace/charts";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { todayYmd } from "@/components/workspace/Calendar";
import { HUE } from "@/components/workspace/modules";
import { ErrorNote, Field, Skeleton, StatCard, inputClass, textareaClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { FieldError, LoadError } from "@/suite/org/components/foundations/shared";
import { day } from "@/suite/finance/lib/format";
import { useListView } from "@/suite/finance/components/revenue/ui";
import { MoneyInput } from "@/suite/operations/components/travel/shared";
import { useAuth } from "@/lib/auth-store";
import { mayDoOps } from "@/suite/operations/lib/operations-access";
import { assetRequests, assets, opsError, opsFieldErrors, type AssetRequest, type AssetRequestKind, type AssetSummary, type DisposalMethod } from "@/lib/api/operations-assets-client";
import { DISPOSAL, REQUEST_KIND, plural, requestKind, requestStatus } from "./labels";
import { MetaChip, usePickerOptions } from "./parts";
import { GatePassBoard } from "./GatePasses";

/**
 * The asset request desk: what is approved and waiting to be fulfilled,
 * what is still in approval, and what is out on a gate pass.
 */

type Tab = "to_fulfil" | "in_approval" | "draft" | "done" | "closed" | "all";

const TABS: { key: Tab; label: string }[] = [
  { key: "to_fulfil", label: "To fulfil" },
  { key: "in_approval", label: "In approval" },
  { key: "draft", label: "Drafts" },
  { key: "done", label: "Done" },
  { key: "closed", label: "Rejected or cancelled" },
  { key: "all", label: "All" },
];

export function inTab(r: AssetRequest, tab: Tab): boolean {
  switch (tab) {
    case "to_fulfil":
      return r.status === "approved";
    case "in_approval":
      return r.status === "in_approval";
    case "draft":
      return r.status === "draft";
    case "done":
      return r.status === "fulfilled" || r.status === "converted";
    case "closed":
      return r.status === "rejected" || r.status === "cancelled";
    default:
      return true;
  }
}

const KIND_ORDER: AssetRequestKind[] = ["allocation", "onboarding", "replacement", "return", "transfer", "take_out", "disposal"];

/** What the request is about, in one line. */
export function requestSubject(r: AssetRequest): string {
  if (r.asset) return `${r.asset.tagNo ?? ""} ${r.asset.name}`.trim();
  if (r.kind === "onboarding") return r.reason ?? "Onboarding kit";
  return r.category ?? "-";
}

export default function AssetRequestsDesk() {
  const router = useRouter();
  const { user } = useAuth();
  const [data, setData] = useState<{ requests: AssetRequest[]; meta: { kinds: Record<string, string>; toFulfil: number } } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [tab, setTab] = useState<Tab>("to_fulfil");
  const [kind, setKind] = useState<AssetRequestKind | "">("");
  const [raising, setRaising] = useState(false);
  const listView = useListView("ops-asset-requests");

  useEffect(() => {
    let alive = true;
    assetRequests.list().then(
      (r) => {
        if (!alive) return;
        setData(r);
        setError(null);
      },
      (e: unknown) => alive && setError(`Asset requests didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  const all = useMemo(() => data?.requests ?? [], [data]);
  const counts = Object.fromEntries(TABS.map((t) => [t.key, all.filter((r) => inTab(r, t.key)).length])) as Record<Tab, number>;
  const shown = all.filter((r) => inTab(r, tab) && (!kind || r.kind === kind));
  const today = todayYmd();

  const columns: Column<AssetRequest>[] = [
    {
      key: "request",
      header: "Request",
      primary: true,
      sortable: true,
      value: (r) => `${r.number ?? ""} ${requestSubject(r)} ${r.forUser ?? ""}`,
      render: (r) => (
        <span className="block min-w-0">
          <span className="block truncate font-semibold text-neutral-900">{requestSubject(r)}</span>
          <span className="block truncate font-mono text-xs text-neutral-500">{r.number ?? "Draft"}</span>
        </span>
      ),
    },
    { key: "kind", header: "Kind", sortable: true, value: (r) => requestKind(r.kind).label, render: (r) => <MetaChip meta={requestKind(r.kind)} /> },
    {
      key: "for",
      header: "For",
      sortable: true,
      value: (r) => r.forUser ?? r.requester ?? "",
      render: (r) => (
        <span className="flex min-w-0 items-center gap-2">
          <PersonAvatar name={r.forUser ?? r.requester} size={24} />
          <span className="truncate">{r.forUser ?? r.requester ?? "-"}</span>
        </span>
      ),
    },
    { key: "needed", header: "Needed by", sortable: true, hideOnMobile: true, value: (r) => r.neededBy ?? r.returnBy ?? "", render: (r) => <NeededBy r={r} today={today} /> },
    { key: "status", header: "Status", sortable: true, value: (r) => requestStatus(r.status).label, render: (r) => <MetaChip meta={requestStatus(r.status)} /> },
  ];

  if (error && !data) return <LoadError text={error} onRetry={() => setReload((k) => k + 1)} />;

  if (!data) {
    return (
      <div aria-busy="true" className="space-y-6">
        <p className="sr-only">Loading asset requests…</p>
        <Skeleton className="h-20" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[132px]" />
          ))}
        </div>
        <Skeleton className="h-[420px]" />
      </div>
    );
  }

  const canCreate = mayDoOps(user, "asset_requests", "create");
  const canCheckIn = mayDoOps(user, "asset_requests", "check_in");
  const open = all.filter((r) => ["approved", "in_approval"].includes(r.status));
  const byKind = KIND_ORDER.map((k) => ({ label: REQUEST_KIND[k].label, value: open.filter((r) => r.kind === k).length, hue: REQUEST_KIND[k].hue }));
  const converted = all.filter((r) => r.status === "converted").length;

  return (
    <div>
      <PageHeader
        title="Asset requests"
        subtitle="Fulfil approved requests from what is in store, raise a purchase request when nothing fits and keep track of gate passes."
        actions={
          canCreate ? (
            <Button variant="primary" icon={Plus} onClick={() => setRaising(true)}>
              Raise a request
            </Button>
          ) : undefined
        }
        tabs={TABS.map((t) => ({ ...t, count: counts[t.key] }))}
        activeTab={tab}
        onTab={(k) => setTab(k as Tab)}
      />

      <div className="space-y-6">
        <StatGrid>
          <StatCard featured label="Approved, to fulfil" value={data.meta.toFulfil} icon={PackageOpen} hint={data.meta.toFulfil ? "Hand over from store, or buy" : "Nothing waiting"} />
          <StatCard label="In approval" value={counts.in_approval} icon={Hourglass} hue="grape" hint="With the head of unit or MD" />
          <StatCard label="Out on a gate pass" value={all.filter((r) => r.gatePass && !r.gatePass.returnedAt).length} icon={DoorOpen} hue="sun" hint={`${plural(all.filter((r) => r.gatePass?.overdue && !r.gatePass.returnedAt).length, "overdue")}`} />
          <StatCard label="Sent to procurement" value={converted} icon={ShoppingCart} hue="sky" hint="Nothing suitable in store" />
        </StatGrid>

        <div className="grid gap-6 xl:grid-cols-5">
          <Panel title="Open requests by kind" subtitle="Approved or in approval" icon={ClipboardList} hue="blue" className="xl:col-span-2">
            {open.length === 0 ? (
              <p className="py-10 text-center text-sm text-neutral-500">No open requests. Once staff send them, they show here by kind.</p>
            ) : (
              <ColumnChart data={byKind.filter((k) => k.value > 0)} height={200} caption="Open asset requests by kind" />
            )}
          </Panel>
          <div className="min-w-0 xl:col-span-3">
            <GatePassBoard canCheckIn={canCheckIn} refreshKey={reload} />
          </div>
        </div>

        {all.length === 0 ? (
          <Card>
            <Empty
              icon={ClipboardList}
              title="No asset requests yet"
              hint="Staff ask for equipment, report faults and arrange take-outs from My assets. When HR hires someone, their starter kit arrives here already approved."
            />
          </Card>
        ) : (
          <DataView
            rows={shown}
            columns={columns}
            rowKey={(r) => r.id}
            rowHref={(r) => `/suite/operations/assets/requests/${r.id}`}
            {...listView}
            toolbar={
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show one kind">
                {KIND_ORDER.filter((k) => all.some((r) => r.kind === k)).map((k) => {
                  const on = kind === k;
                  const Icon = REQUEST_KIND[k].icon;
                  return (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setKind(on ? "" : k)}
                      className={cx(
                        "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-primary-300",
                        on ? cx(HUE[REQUEST_KIND[k].hue].soft, "ring-1 ring-current") : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200",
                      )}
                    >
                      <Icon size={13} aria-hidden />
                      {REQUEST_KIND[k].label}
                    </button>
                  );
                })}
              </div>
            }
            searchPlaceholder="Search by number, asset or person"
            caption="Asset requests"
            gridCols={3}
            renderListItem={(r) => <RequestRow r={r} today={today} />}
            renderCard={(r) => <RequestRow r={r} today={today} card />}
            empty={<Empty icon={ClipboardList} hue="slate" title="Nothing here" hint="Try another tab or kind." />}
          />
        )}
      </div>

      {raising && (
        <RaiseRequestDialog
          onClose={() => setRaising(false)}
          onDone={(r) => {
            setRaising(false);
            router.push(`/suite/operations/assets/requests/${r.id}`);
          }}
        />
      )}
    </div>
  );
}

function NeededBy({ r, today }: { r: AssetRequest; today: string }) {
  const date = r.kind === "take_out" ? r.returnBy : r.neededBy;
  if (!date) return <span className="text-neutral-500">-</span>;
  const late = r.status === "approved" && date < today;
  return (
    <span className="flex flex-wrap items-center gap-1.5 tabular-nums">
      {r.kind === "take_out" ? `Back ${day(date)}` : day(date)}
      {late && <Chip hue="rose">Late</Chip>}
    </span>
  );
}

function RequestRow({ r, today, card = false }: { r: AssetRequest; today: string; card?: boolean }) {
  return (
    <div className={card ? "flex h-full flex-col gap-3 p-5" : "px-5 py-3.5"}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-neutral-900">{requestSubject(r)}</p>
          <p className="mt-0.5 truncate text-xs text-neutral-500">
            <span className="font-mono">{r.number ?? "Draft"}</span> · {r.forUser ?? r.requester}
          </p>
        </div>
        <MetaChip meta={requestKind(r.kind)} />
      </div>
      <div className={cx("flex flex-wrap items-center gap-2", card ? "mt-auto" : "mt-2")}>
        <MetaChip meta={requestStatus(r.status)} />
        <span className="text-xs text-neutral-500">
          <NeededBy r={r} today={today} />
        </span>
      </div>
    </div>
  );
}

/* --------------------------- the desk raises one --------------------------- */

type DeskKind = "return" | "transfer" | "disposal";

/** Operations raises a request itself: a return, a transfer, or a disposal proposal. It starts as a draft to send for approval. */
function RaiseRequestDialog({ onDone, onClose }: { onDone: (r: AssetRequest) => void; onClose: () => void }) {
  const uid = useId();
  const { staff, projects } = usePickerOptions();
  const [register, setRegister] = useState<AssetSummary[] | null>(null);
  const [kind, setKind] = useState<DeskKind>("disposal");
  const [assetId, setAssetId] = useState("");
  const [reason, setReason] = useState("");
  const [toUserId, setToUserId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [toLocation, setToLocation] = useState("");
  const [method, setMethod] = useState<DisposalMethod | "">("");
  const [proceeds, setProceeds] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    assets.list().then(
      (r) => setRegister(r.assets),
      () => setRegister([]),
    );
  }, []);

  const pickable = (register ?? []).filter((a) => a.status !== "disposed" && (kind === "disposal" || ["allocated", "in_transit"].includes(a.status)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!assetId) local.assetId = "Choose the asset.";
    if (kind === "disposal" && !method) local.disposalMethod = "Choose sale, scrap, donation or write-off.";
    if (kind === "disposal" && !reason.trim()) local.reason = "Give the condition evidence and why it should go.";
    if (kind === "transfer" && !toUserId && !projectId && !toLocation.trim()) local.toUserId = "Say who, which project or where it is going.";
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      onDone(
        await assetRequests.create({
          kind,
          assetId,
          reason: reason.trim() || null,
          toUserId: kind === "transfer" ? toUserId || null : null,
          projectId: kind === "transfer" ? projectId || null : null,
          toLocation: kind === "transfer" ? toLocation.trim() || null : null,
          disposalMethod: kind === "disposal" ? (method as DisposalMethod) : null,
          proceeds: kind === "disposal" ? (proceeds ?? 0) : null,
        }),
      );
    } catch (err) {
      setErrors(opsFieldErrors(err));
      setError(opsError(err));
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      size="lg"
      titleId={`${uid}-title`}
      title="Raise an asset request"
      subtitle="It is saved as a draft for you to send for approval. A disposal goes to the MD as well as the head of unit."
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Saving…" : "Save the draft"}
          </Button>
        </div>
      }
    >
      <Field id={`${uid}-kind`} label="What kind of request">
        <SearchableSelect
          id={`${uid}-kind`}
          value={kind}
          onChange={(v) => {
            setKind(v as DeskKind);
            setAssetId("");
          }}
          options={(["disposal", "return", "transfer"] as DeskKind[]).map((k) => ({ value: k, label: REQUEST_KIND[k].label }))}
          searchPlaceholder="Search kinds"
        />
      </Field>
      <Field id={`${uid}-asset`} label="Asset">
        <SearchableSelect
          id={`${uid}-asset`}
          value={assetId}
          onChange={setAssetId}
          options={pickable.map((a) => ({ value: a.id, label: `${a.tagNo ?? "Untagged"} · ${a.name}`, hint: a.custodian ?? a.location ?? undefined }))}
          placeholder={register === null ? "Loading the register…" : "Choose the asset"}
          searchPlaceholder="Search by tag, name or holder"
          noOptionsText={register === null ? "Loading the register…" : kind === "disposal" ? "Nothing on the register." : "Nothing is with anybody."}
          aria-invalid={errors.assetId ? true : undefined}
        />
        <FieldError message={errors.assetId} />
      </Field>

      {kind === "transfer" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${uid}-to`} label="To a person" hint="Or a project or place">
            <SearchableSelect
              id={`${uid}-to`}
              value={toUserId}
              onChange={setToUserId}
              options={staff ?? []}
              clearable
              clearLabel="Nobody new"
              placeholder={staff === null ? "Loading staff…" : "Nobody new"}
              searchPlaceholder="Search staff"
            />
            <FieldError message={errors.toUserId} />
          </Field>
          <Field id={`${uid}-project`} label="For a project" hint="Optional">
            <SearchableSelect
              id={`${uid}-project`}
              value={projectId}
              onChange={setProjectId}
              options={projects ?? []}
              clearable
              clearLabel="No project"
              placeholder={projects === null ? "Loading projects…" : "No project"}
              searchPlaceholder="Search projects"
            />
          </Field>
          <Field id={`${uid}-loc`} label="To a place" hint="Optional" className="sm:col-span-2">
            <input id={`${uid}-loc`} className={inputClass} value={toLocation} maxLength={255} onChange={(e) => setToLocation(e.target.value)} placeholder="Client site, Kano" />
          </Field>
        </div>
      )}

      {kind === "disposal" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${uid}-method`} label="How it goes">
            <SearchableSelect
              id={`${uid}-method`}
              value={method}
              onChange={(v) => setMethod(v as DisposalMethod)}
              options={Object.entries(DISPOSAL).map(([value, label]) => ({ value, label }))}
              placeholder="Choose how"
              searchPlaceholder="Search methods"
              aria-invalid={errors.disposalMethod ? true : undefined}
            />
            <FieldError message={errors.disposalMethod} />
          </Field>
          <Field id={`${uid}-proceeds`} label="Expected proceeds (₦)" hint="Zero for scrap or donation">
            <MoneyInput id={`${uid}-proceeds`} value={proceeds} onChange={setProceeds} invalid={Boolean(errors.proceeds)} />
            <FieldError message={errors.proceeds} />
          </Field>
        </div>
      )}

      <Field id={`${uid}-reason`} label={kind === "disposal" ? "Condition evidence and why it should go" : "Reason"} hint={kind === "disposal" ? "Required" : "Optional"}>
        <textarea id={`${uid}-reason`} rows={3} className={textareaClass} value={reason} maxLength={5000} onChange={(e) => setReason(e.target.value)} aria-invalid={errors.reason ? true : undefined} />
        <FieldError message={errors.reason} />
      </Field>
      {error && <ErrorNote>{error}</ErrorNote>}
    </DialogFrame>
  );
}
