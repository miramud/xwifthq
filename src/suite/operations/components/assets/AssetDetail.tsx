"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArchiveRestore,
  ArrowLeftRight,
  CalendarClock,
  CircleHelp,
  History,
  Hourglass,
  Landmark,
  ClipboardList,
  CircleCheck,
  MapPin,
  PackageSearch,
  PenLine,
  RotateCcw,
  ShieldCheck,
  Siren,
  Tag,
  UserCheck,
  UserRound,
  Wrench,
} from "lucide-react";
import { Button, Card, Chip, PageHeader, Panel, PersonAvatar, cx } from "@/components/workspace/kit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { todayYmd } from "@/components/workspace/Calendar";
import { BackLink, ErrorNote, Skeleton } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { Money } from "@/suite/finance/components/banking/ui";
import { day } from "@/suite/finance/lib/format";
import { useAuth } from "@/lib/auth-store";
import { mayDoOps } from "@/suite/operations/lib/operations-access";
import RaiseWorkOrderDialog from "@/suite/operations/components/maintenance/RaiseWorkOrderDialog";
import { KIND_LABEL } from "@/suite/operations/components/maintenance/labels";
import { WorkOrderStatusChip } from "@/suite/operations/components/maintenance/parts";
import { ApiError, assets, opsError, type AssetCategory, type AssetFull, type AssetStatus } from "@/lib/api/operations-assets-client";
import { FactRow } from "@/suite/operations/components/travel/shared";
import { CounterpartyLink } from "@/suite/operations/components/links";
import { assetStatus, daysFrom, stampOf } from "./labels";
import { AssetTag, BookFigures, ConditionChip, MetaChip, MovementTimeline } from "./parts";
import AssetFormDialog from "./AssetFormDialog";
import { AllocateDialog, ReturnDialog, StatusDialog, TagDialog, TransferDialog } from "./AssetActionDialogs";
import { RichTextView } from "@/components/workspace/RichTextView";

/**
 * An asset's card: what it is, where it is, who holds it, its warranty and
 * cover, Finance's book of it (read-only), and every movement it has made.
 * The actions on offer follow its status.
 */

type Dialog = "edit" | "tag" | "allocate" | "transfer" | "return" | "under_maintenance" | "lost" | "stolen" | "fault" | null;

/** The road an asset travels in normal life; other statuses are a detour off it. */
const ROAD: { status: AssetStatus; label: string }[] = [
  { status: "received", label: "Received" },
  { status: "in_store", label: "Tagged, in store" },
  { status: "in_transit", label: "Handed over" },
  { status: "allocated", label: "Signed for" },
];

export function roadIndex(status: AssetStatus): number {
  return ROAD.findIndex((r) => r.status === status);
}

export default function AssetDetail({ id }: { id: string }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [asset, setAsset] = useState<AssetFull | null>(null);
  const [categories, setCategories] = useState<AssetCategory[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    assets.get(id).then(
      (a) => {
        if (!alive) return;
        setAsset(a);
        setLoadError(null);
      },
      (e: unknown) => alive && setLoadError(e instanceof ApiError && e.status === 404 ? "This asset wasn't found on the register." : `This asset didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [id, reload]);

  const refresh = useCallback(() => setReload((k) => k + 1), []);
  const loadCategories = () => {
    if (categories === null) assets.categories().then(setCategories, () => setCategories([]));
  };

  if (loadError && !asset) {
    return (
      <div>
        <BackLink href="/suite/operations/assets" label="Asset register" />
        <LoadError text={loadError} onRetry={refresh} />
      </div>
    );
  }

  if (!asset) {
    return (
      <div aria-busy="true" className="space-y-5">
        <p className="sr-only">Loading the asset…</p>
        <Skeleton className="h-20" />
        <Skeleton className="h-[160px]" />
        <Skeleton className="h-[360px]" />
      </div>
    );
  }

  const a = asset;
  const can = (action: string) => mayDoOps(user, "assets", action);
  const done = (next: AssetFull) => {
    setAsset(next);
    setDialog(null);
    setActionError(null);
  };
  const out = ["under_maintenance", "lost", "stolen"].includes(a.status);
  const inService = !out && a.status !== "disposed" && a.status !== "disposal_pending";

  const backInService = async () => {
    const ok = await confirm({
      title: "Mark it back in service?",
      body: `${a.tagNo ?? a.name} goes back to ${a.custodianId ? `${a.custodian ?? "its holder"}, allocated` : "the store"}.`,
      confirmLabel: "Back in service",
      tone: "primary",
    });
    if (!ok) return;
    setBusy(true);
    setActionError(null);
    try {
      done(await assets.setStatus(a.id, "back"));
    } catch (e) {
      setActionError(opsError(e));
    } finally {
      setBusy(false);
    }
  };

  const actions = (
    <>
      {can("update") && a.status !== "disposed" && (
        <Button
          icon={PenLine}
          onClick={() => {
            loadCategories();
            setDialog("edit");
          }}
        >
          Edit details
        </Button>
      )}
      {a.status === "received" && can("tag") && (
        <Button variant="primary" icon={Tag} onClick={() => setDialog("tag")}>
          Tag it
        </Button>
      )}
      {a.status === "in_store" && can("allocate") && (
        <Button variant="primary" icon={UserCheck} onClick={() => setDialog("allocate")}>
          Hand over
        </Button>
      )}
      {a.status === "allocated" && can("transfer") && (
        <Button variant="primary" icon={ArrowLeftRight} onClick={() => setDialog("transfer")}>
          Transfer
        </Button>
      )}
      {["allocated", "in_transit", "under_maintenance"].includes(a.status) && can("return_asset") && (
        <Button icon={ArchiveRestore} onClick={() => setDialog("return")}>
          Return to store
        </Button>
      )}
      {out && can("set_status") && (
        <Button icon={RotateCcw} disabled={busy} onClick={() => void backInService()}>
          Back in service
        </Button>
      )}
    </>
  );

  const warrantyDays = daysFrom(todayYmd(), a.warrantyUntil);
  const insuranceDays = daysFrom(todayYmd(), a.insuranceUntil);
  const step = roadIndex(a.status);

  return (
    <div>
      <BackLink href="/suite/operations/assets" label="Asset register" />
      <PageHeader
        eyebrow={[a.category, a.make, a.model].filter(Boolean).join(" · ")}
        title={a.name}
        subtitle={
          <span className="mt-1 flex flex-wrap items-center gap-2">
            <MetaChip meta={assetStatus(a.status)} />
            <ConditionChip value={a.condition} />
          </span>
        }
        actions={actions}
      />

      {actionError && <ErrorNote className="mb-4">{actionError}</ErrorNote>}
      {notice && (
        <p role="status" className="mb-4 flex items-start gap-2 rounded-xl bg-mint-50 px-4 py-3 text-sm text-mint-700 ring-1 ring-mint-500/20">
          <CircleCheck size={16} className="mt-0.5 shrink-0" aria-hidden />
          {notice}
        </p>
      )}

      {a.pendingHandover && (
        <div className="mb-5 flex flex-col gap-3 rounded-[1.125rem] border border-sky-500/25 bg-sky-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between" role="status">
          <div className="flex items-start gap-3">
            <Hourglass size={20} className="mt-0.5 shrink-0 text-sky-700" aria-hidden />
            <div className="text-sm text-sky-700">
              <p className="font-semibold">
                Waiting for {a.pendingHandover.to ?? "the receiver"} to sign handover <span className="font-mono">{a.pendingHandover.handoverNo}</span>
              </p>
              <p className="mt-0.5">
                Sent {stampOf(a.pendingHandover.at)}
                {a.pendingHandover.by && ` by ${a.pendingHandover.by}`}. It is in transit until they acknowledge it in My assets
                {a.custodian ? `; ${a.custodian} stays on record until then.` : "."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* The sticker and its road. */}
      <Card className="mb-5 overflow-hidden">
        <div className="grid gap-6 p-5 md:grid-cols-[auto_1fr] md:items-center">
          <div className="flex flex-col items-start gap-2">
            <AssetTag tagNo={a.tagNo} code={a.categoryCode} size="lg" />
            {a.serialNo && <p className="font-mono text-xs text-neutral-500">S/N {a.serialNo}</p>}
          </div>
          <div>
            <ol className="grid grid-cols-4 gap-2" aria-label="Where the asset is in its life">
              {ROAD.map((r, i) => {
                const reached = step >= i;
                const current = step === i;
                return (
                  <li key={r.status} className="min-w-0">
                    <div className={cx("h-2 rounded-full", reached ? (current ? "bg-primary-500" : "bg-primary-300") : "ws-hatch")} />
                    <p className={cx("mt-2 truncate text-xs", current ? "font-semibold text-neutral-900" : reached ? "text-neutral-600" : "text-neutral-500")}>
                      {r.label}
                      {current && <span className="sr-only"> (now)</span>}
                    </p>
                  </li>
                );
              })}
            </ol>
            {step < 0 && (
              <p className="mt-3 flex items-center gap-2 text-sm text-neutral-600">
                {a.status === "stolen" ? <Siren size={16} className="text-rose-600" aria-hidden /> : a.status === "lost" ? <CircleHelp size={16} className="text-rose-600" aria-hidden /> : <Wrench size={16} className="text-coral-600" aria-hidden />}
                Off its usual road: {assetStatus(a.status).label.toLowerCase()}.
              </p>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="min-w-0 space-y-5 xl:col-span-2">
          <Panel title="Details" subtitle="What it is and where it lives" icon={PackageSearch} hue="sky">
            <dl className="grid gap-4 sm:grid-cols-3">
              <FactRow label="Category">{a.category ?? "—"}</FactRow>
              <FactRow label="Make and model">{[a.make, a.model].filter(Boolean).join(" ") || "—"}</FactRow>
              <FactRow label="Serial number">{a.serialNo ? <span className="font-mono">{a.serialNo}</span> : "—"}</FactRow>
              <FactRow label="Location">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={14} className="text-neutral-400" aria-hidden />
                  {a.location ?? "—"}
                </span>
              </FactRow>
              <FactRow label="Project">{a.project ? `${a.project.name}${a.project.code ? ` (${a.project.code})` : ""}` : "—"}</FactRow>
              <FactRow label="Acquired">{day(a.acquiredOn)}</FactRow>
              <FactRow label="Cost on the register">
                <Money value={a.cost} className="font-semibold" />
              </FactRow>
              <FactRow label="Supplier">
                <CounterpartyLink id={a.supplierId} name={a.supplier} />
              </FactRow>
              <FactRow label="Bought on">
                {a.po ? (
                  <Link href={`/suite/operations/procurement/orders/${a.po.id}`} className="font-mono font-semibold text-primary-700 underline-offset-2 hover:underline">
                    {a.po.number ?? "Purchase order"}
                  </Link>
                ) : (
                  "—"
                )}
                {a.grn?.number && <span className="block font-mono text-xs text-neutral-500">{a.grn.number}</span>}
              </FactRow>
            </dl>
            {a.notes && <RichTextView value={a.notes} size="sm" className="mt-5 rounded-xl bg-neutral-50 px-4 py-3 text-neutral-700" />}
          </Panel>

          <Panel title="Warranty and insurance" icon={ShieldCheck} hue="mint">
            <div className="grid gap-4 sm:grid-cols-2">
              <CoverTile label="Warranty" until={a.warrantyUntil} days={warrantyDays} who={a.warrantyProvider} />
              <CoverTile label="Insurance" until={a.insuranceUntil} days={insuranceDays} who={a.insurancePolicy ? `Policy ${a.insurancePolicy}` : null} />
            </div>
          </Panel>

          <MaintenancePanel
            workOrders={a.workOrders ?? []}
            onReport={mayDoOps(user, "maintenance", "create") && a.status !== "disposed" ? () => setDialog("fault") : undefined}
          />

          <Panel title="History" subtitle="Every movement, with its handover number and who signed" icon={History} hue="grape">
            <MovementTimeline history={a.history} noteHref={(m) => assets.movementPdfUrl(m.id)} />
          </Panel>
        </div>

        <div className="min-w-0 space-y-5">
          <Panel title="Custodian" icon={UserRound} hue="blue">
            {a.custodian ? (
              <div className="flex items-center gap-3">
                <PersonAvatar name={a.custodian} size={44} />
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-neutral-900">{a.custodian}</p>
                  <p className="text-xs text-neutral-500">{a.status === "in_transit" ? "Holds it until the receiver signs" : "Custodian of record"}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-neutral-500">{a.status === "in_store" ? "Nobody: it is in store, ready to hand over." : "Nobody holds it."}</p>
            )}
          </Panel>

          <Panel title="On Finance's books" subtitle="Read-only; Finance keeps these" icon={Landmark} hue="grape">
            <BookFigures book={a.book} />
          </Panel>

          {inService && can("set_status") && (
            <Panel title="If something goes wrong" icon={Wrench} hue="coral">
              <div className="flex flex-col gap-2">
                <Button icon={Wrench} onClick={() => setDialog("under_maintenance")} className="justify-start">
                  Send for maintenance
                </Button>
                <Button icon={CircleHelp} onClick={() => setDialog("lost")} className="justify-start">
                  Report it lost
                </Button>
                <Button icon={Siren} onClick={() => setDialog("stolen")} className="justify-start">
                  Report it stolen
                </Button>
              </div>
            </Panel>
          )}
        </div>
      </div>

      {dialog === "edit" && <AssetFormDialog asset={a} categories={categories} onClose={() => setDialog(null)} onDone={done} />}
      {dialog === "tag" && <TagDialog asset={a} onClose={() => setDialog(null)} onDone={done} />}
      {dialog === "allocate" && <AllocateDialog asset={a} onClose={() => setDialog(null)} onDone={done} />}
      {dialog === "transfer" && <TransferDialog asset={a} onClose={() => setDialog(null)} onDone={done} />}
      {dialog === "return" && <ReturnDialog asset={a} onClose={() => setDialog(null)} onDone={done} />}
      {(dialog === "under_maintenance" || dialog === "lost" || dialog === "stolen") && <StatusDialog asset={a} status={dialog} onClose={() => setDialog(null)} onDone={done} />}
      {dialog === "fault" && (
        <RaiseWorkOrderDialog
          asset={{ id: a.id, tagNo: a.tagNo, name: a.name, categoryCode: a.categoryCode }}
          onClose={() => setDialog(null)}
          onDone={(wo) => {
            setDialog(null);
            setNotice(`${wo.number ? `Work order ${wo.number}` : "A work order"} raised. The maintenance desk picks it up from here.`);
            refresh();
          }}
        />
      )}
    </div>
  );
}

/** The asset's work orders, newest first, each opening the work order. */
function MaintenancePanel({ workOrders, onReport }: { workOrders: NonNullable<AssetFull["workOrders"]>; onReport?: () => void }) {
  const spent = workOrders.filter((w) => w.status !== "cancelled").reduce((s, w) => s + w.cost, 0);
  return (
    <Panel
      title="Maintenance"
      subtitle={workOrders.length ? `${workOrders.length} ${workOrders.length === 1 ? "work order" : "work orders"}` : "Repairs and servicing on this asset"}
      icon={ClipboardList}
      hue="coral"
      actions={
        onReport ? (
          <Button size="sm" icon={Wrench} onClick={onReport}>
            Report a fault
          </Button>
        ) : undefined
      }
    >
      {spent > 0 && (
        <p className="-mt-2 mb-3 text-xs text-neutral-500">
          <Money value={spent} className="font-semibold text-neutral-800" /> spent on it in all
        </p>
      )}
      {workOrders.length === 0 ? (
        <p className="py-2 text-sm text-neutral-500">No repairs or servicing yet.</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {workOrders.map((w) => (
            <li key={w.id}>
              <Link
                href={`/suite/operations/maintenance/${w.id}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg py-2.5 outline-none hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-primary-300"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-neutral-900">{w.title}</span>
                  <span className="block text-xs text-neutral-500">
                    <span className="font-mono">{w.number ?? "—"}</span> · {KIND_LABEL[w.kind] ?? w.kind} · {day(w.createdAt)}
                  </span>
                </span>
                <WorkOrderStatusChip status={w.status} />
                <Money value={w.cost} className="w-28 text-right text-sm font-semibold text-neutral-800" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** A warranty or policy: until when, how long left, from whom. */
function CoverTile({ label, until, days, who }: { label: string; until: string | null; days: number | null; who: string | null }) {
  const lapsed = days !== null && days < 0;
  const soon = days !== null && days >= 0 && days <= 60;
  return (
    <div className="rounded-xl border border-neutral-200 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-neutral-900">{label}</p>
        {until ? (
          <Chip hue={lapsed ? "rose" : soon ? "sun" : "mint"} icon={CalendarClock}>
            {lapsed ? "Lapsed" : days === 0 ? "Ends today" : `${days} days left`}
          </Chip>
        ) : (
          <Chip>None recorded</Chip>
        )}
      </div>
      <p className="mt-2 text-sm text-neutral-600">{until ? `Until ${day(until)}` : "Add the end date under Edit details."}</p>
      {who && <p className="mt-0.5 text-xs text-neutral-500">{who}</p>}
    </div>
  );
}
