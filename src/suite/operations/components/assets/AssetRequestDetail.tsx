"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { ArchiveRestore, ArrowLeftRight, ArrowUpRight, Ban, Check, ClipboardList, DoorOpen, Landmark, PackageOpen, Printer, Send, ShoppingCart, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { Button, ButtonLink, Card, Chip, Empty, PageHeader, Panel, Segmented, cx } from "@/components/workspace/kit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { todayYmd } from "@/components/workspace/Calendar";
import { BackLink, ErrorNote, Field, Skeleton, inputClass, textareaClass } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { Money } from "@/suite/finance/components/banking/ui";
import { amount, day } from "@/suite/finance/lib/format";
import { useAuth } from "@/lib/auth-store";
import { mayDoOps } from "@/suite/operations/lib/operations-access";
import { ApiError, assetRequests, assets, opsError, type AssetCategory, type AssetCondition, type AssetRequestFull, type AssetSummary } from "@/lib/api/operations-assets-client";
import { ApprovalLink, FactRow } from "@/suite/operations/components/travel/shared";
import { CONDITION, CONDITION_ORDER, DISPOSAL, expectedGainLoss, requestKind, requestStatus, stampOf } from "./labels";
import { AssetTag, BookFigures, ConditionChip, MetaChip } from "./parts";
import { CheckInDialog, GatePassPrint, PassStateChip } from "./GatePasses";

/**
 * One asset request on the desk: what was asked for, its approval, and -
 * once approved - fulfilling it: handing over from what is in store,
 * taking an asset back, transferring it, issuing a gate pass, or disposing
 * of it against Finance's net book value.
 */
export default function AssetRequestDetail({ id }: { id: string }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [req, setReq] = useState<AssetRequestFull | null>(null);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [prLink, setPrLink] = useState<{ id: string; number: string | null } | null>(null);

  useEffect(() => {
    let alive = true;
    assetRequests.get(id).then(
      (r) => {
        if (!alive) return;
        setReq(r);
        setLoadError(null);
      },
      (e: unknown) => alive && setLoadError(e instanceof ApiError && e.status === 404 ? "This request wasn't found." : `This request didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [id, reload]);

  useEffect(() => {
    assets.categories().then(setCategories, () => undefined);
  }, []);

  const refresh = useCallback(() => setReload((k) => k + 1), []);

  if (loadError && !req) {
    return (
      <div>
        <BackLink href="/suite/operations/assets/requests" label="Asset requests" />
        <LoadError text={loadError} onRetry={refresh} />
      </div>
    );
  }

  if (!req) {
    return (
      <div aria-busy="true" className="space-y-5">
        <p className="sr-only">Loading the request…</p>
        <Skeleton className="h-20" />
        <Skeleton className="h-[200px]" />
        <Skeleton className="h-[320px]" />
      </div>
    );
  }

  const r = req;
  const can = (action: string) => mayDoOps(user, "asset_requests", action);
  const canSubmit = r.status === "draft" && r.requesterId === user?.id && can("submit");
  const canCancel = (r.status === "draft" || r.status === "approved") && can("cancel");
  const canFulfil = r.status === "approved" && can("fulfil");

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setActionError(null);
    try {
      await fn();
      refresh();
    } catch (e) {
      setActionError(opsError(e));
    } finally {
      setBusy(null);
    }
  };

  const cancel = async () => {
    const ok = await confirm({
      title: "Cancel this request?",
      body: `${r.number ?? "The draft"} is closed and nothing is handed over. Whoever asked can raise it again. This can't be undone.`,
      confirmLabel: "Cancel the request",
    });
    if (ok) await act("cancel", () => assetRequests.cancel(r.id));
  };

  const convert = async () => {
    const ok = await confirm({
      title: "Raise a purchase request instead?",
      body: "Nothing in store is handed over. Procurement gets a purchase request for what was asked, and this request is marked as sent to procurement.",
      confirmLabel: "Raise the purchase request",
      tone: "primary",
    });
    if (!ok) return;
    setBusy("convert");
    setActionError(null);
    try {
      const res = await assetRequests.convert(r.id);
      setPrLink(res.purchaseRequest ?? null);
      refresh();
    } catch (e) {
      setActionError(opsError(e));
    } finally {
      setBusy(null);
    }
  };

  const catName = (cid: string) => categories.find((c) => c.id === cid)?.name ?? "A category";
  const kindMeta = requestKind(r.kind);

  return (
    <div>
      <BackLink href="/suite/operations/assets/requests" label="Asset requests" />
      <PageHeader
        eyebrow={<span className="font-mono">{r.number ?? "Draft"}</span>}
        title={`${kindMeta.label}${r.forUser ? ` for ${r.forUser}` : ""}`}
        subtitle={
          <span className="mt-1 flex flex-wrap items-center gap-2">
            <MetaChip meta={kindMeta} />
            <MetaChip meta={requestStatus(r.status)} />
          </span>
        }
        actions={
          <>
            <ApprovalLink approvalId={r.approvalId} />
            {canCancel && (
              <Button icon={Ban} disabled={busy !== null} onClick={() => void cancel()}>
                Cancel request
              </Button>
            )}
            {canSubmit && (
              <Button variant="primary" icon={Send} disabled={busy !== null} onClick={() => void act("submit", () => assetRequests.submit(r.id))}>
                {busy === "submit" ? "Sending…" : "Send for approval"}
              </Button>
            )}
          </>
        }
      />

      {actionError && <ErrorNote className="mb-4">{actionError}</ErrorNote>}
      {(prLink || (r.status === "converted" && r.prId)) && (
        <Card className="mb-5 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-sm text-neutral-700">
            <ShoppingCart size={18} className="text-sky-600" aria-hidden />
            Nothing suitable was in store, so this went to procurement{prLink?.number ? ` as ${prLink.number}` : ""}.
          </p>
          <ButtonLink href={`/suite/operations/procurement/requests/${prLink?.id ?? r.prId}`} icon={ArrowUpRight}>
            Open the purchase request
          </ButtonLink>
        </Card>
      )}

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="min-w-0 space-y-5 xl:col-span-2">
          {canFulfil && (
            <FulfilPanel
              req={r}
              catName={catName}
              busy={busy}
              onConvert={can("convert") && ["allocation", "onboarding", "replacement"].includes(r.kind) ? () => void convert() : undefined}
              onDone={refresh}
            />
          )}

          <Panel title="The request" icon={ClipboardList} hue={kindMeta.hue}>
            <dl className="grid gap-4 sm:grid-cols-3">
              <FactRow label="Asked by">{r.requester ?? "-"}</FactRow>
              <FactRow label="For">{r.forUser ?? r.requester ?? "-"}</FactRow>
              <FactRow label="Raised">{stampOf(r.createdAt)}</FactRow>
              {r.asset && (
                <FactRow label="Asset">
                  <Link href={`/suite/operations/assets/${r.asset.id}`} className="inline-flex items-center gap-2 font-semibold text-primary-700 underline-offset-2 hover:underline">
                    <AssetTag tagNo={r.asset.tagNo} size="sm" />
                    {r.asset.name}
                  </Link>
                </FactRow>
              )}
              {r.category && <FactRow label="Category">{r.category}</FactRow>}
              {r.neededBy && <FactRow label="Needed by">{day(r.neededBy)}</FactRow>}
              {r.returnBy && <FactRow label="Back by">{day(r.returnBy)}</FactRow>}
              {r.project && <FactRow label="Project">{r.project.name}</FactRow>}
              {r.toUser && <FactRow label="To">{r.toUser}</FactRow>}
              {r.toLocation && <FactRow label={r.kind === "take_out" ? "Going to" : "To where"}>{r.toLocation}</FactRow>}
              {r.disposalMethod && <FactRow label="Disposal by">{DISPOSAL[r.disposalMethod]}</FactRow>}
              {r.kind === "disposal" && (
                <FactRow label="Expected proceeds">
                  <Money value={r.proceeds ?? 0} className="font-semibold" />
                </FactRow>
              )}
            </dl>
            {r.kit && r.kit.length > 0 && (
              <div className="mt-5">
                <p className="mb-2 text-sm font-semibold text-neutral-800">The kit</p>
                <ul className="flex flex-wrap gap-2">
                  {r.kit.map((k) => (
                    <li key={k.categoryId}>
                      <Chip hue="grape">
                        {k.quantity} × {catName(k.categoryId)}
                      </Chip>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {r.reason && <p className="mt-5 whitespace-pre-line rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-700">{r.reason}</p>}
          </Panel>
        </div>

        <div className="min-w-0 space-y-5">
          {r.gatePass && (
            <Panel title="Gate pass" icon={DoorOpen} hue={r.gatePass.overdue && !r.gatePass.returnedAt ? "rose" : "sun"}>
              <p className="font-mono text-lg font-bold text-neutral-900">{r.gatePass.number}</p>
              <div className="mt-2">
                <PassStateChip pass={r.gatePass} />
              </div>
              <p className="mt-3 text-sm text-neutral-600">
                Out {stampOf(r.gatePass.outAt)}, due back {day(r.gatePass.dueBackOn)}
                {r.gatePass.returnedAt && `. Back in ${stampOf(r.gatePass.returnedAt)}`}.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" icon={Printer} onClick={() => setPrinting(true)}>
                  Print pass
                </Button>
                {!r.gatePass.returnedAt && can("check_in") && (
                  <Button size="sm" variant="primary" icon={Check} onClick={() => setChecking(true)}>
                    Check in
                  </Button>
                )}
              </div>
            </Panel>
          )}
          {r.asset && (
            <Panel title="On Finance's books" subtitle="Read-only" icon={Landmark} hue="grape">
              <BookFigures book={r.book} />
            </Panel>
          )}
        </div>
      </div>

      {printing && r.gatePass && <GatePassPrint id={r.gatePass.id} onClose={() => setPrinting(false)} />}
      {checking && r.gatePass && (
        <CheckInDialog
          pass={r.gatePass}
          onClose={() => setChecking(false)}
          onDone={() => {
            setChecking(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

/* --------------------------------- fulfil -------------------------------- */

const conditionOptions = CONDITION_ORDER.map((c) => ({ value: c, label: CONDITION[c].label }));

function FulfilPanel({ req: r, catName, busy, onConvert, onDone }: { req: AssetRequestFull; catName: (id: string) => string; busy: string | null; onConvert?: () => void; onDone: () => void }) {
  const uid = useId();
  const confirm = useConfirm();
  const [chosen, setChosen] = useState<string[]>([]);
  const [cond, setCond] = useState("");
  const [condOld, setCondOld] = useState<AssetCondition>("faulty");
  const [oldTo, setOldTo] = useState<"store" | "maintenance">("store");
  const [accessories, setAccessories] = useState("");
  const [note, setNote] = useState("");
  const [on, setOn] = useState(todayYmd());
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const fromPool = ["allocation", "onboarding", "replacement"].includes(r.kind);

  /** How many of each category the request wants: one, or the kit's quantities. */
  const wanted = useMemo(() => {
    if (r.kind === "onboarding") return new Map((r.kit ?? []).map((k) => [k.categoryId, k.quantity]));
    return r.categoryId ? new Map([[r.categoryId, 1]]) : new Map<string, number>();
  }, [r]);

  const toggle = (a: AssetSummary) => setChosen((list) => (list.includes(a.id) ? list.filter((x) => x !== a.id) : [...list, a.id]));

  const fulfil = async () => {
    if (fromPool && chosen.length === 0) {
      setError(r.pool.length === 0 ? "Nothing suitable is in store. Raise a purchase request instead." : "Choose what to hand over from store.");
      return;
    }
    if (r.kind === "disposal") {
      const ok = await confirm({
        title: "Dispose of this asset?",
        body: `${r.asset?.tagNo ?? "The asset"} comes off the register and Finance posts the gain or loss on its books. This can't be undone.`,
        confirmLabel: "Dispose of it",
      });
      if (!ok) return;
    }
    setWorking(true);
    setError(null);
    try {
      await assetRequests.fulfil(r.id, {
        ...(fromPool ? { assetIds: chosen } : {}),
        condition: (cond || null) as AssetCondition | null,
        ...(r.kind === "replacement" ? { conditionOld: condOld, oldTo } : {}),
        accessories: accessories.trim() || null,
        note: note.trim() || null,
        ...(r.kind === "disposal" ? { on } : {}),
      });
      onDone();
    } catch (e) {
      setError(opsError(e));
      setWorking(false);
    }
  };

  const label = {
    allocation: `Hand over ${chosen.length > 1 ? `${chosen.length} assets` : "the asset"}`,
    onboarding: `Hand over ${chosen.length} ${chosen.length === 1 ? "asset" : "assets"}`,
    replacement: "Hand over the replacement",
    return: "Take it back into store",
    transfer: "Carry out the transfer",
    take_out: "Issue the gate pass",
    disposal: "Dispose of it",
  }[r.kind];
  const icon = { allocation: PackageOpen, onboarding: PackageOpen, replacement: PackageOpen, return: ArchiveRestore, transfer: ArrowLeftRight, take_out: DoorOpen, disposal: Trash2 }[r.kind];

  return (
    <Panel title="Fulfil the request" subtitle="Approved: carry it out" icon={icon} hue="sky" className="ring-2 ring-sky-500/20">
      <div className="space-y-5">
        {fromPool && (
          <div>
            {r.pool.length === 0 ? (
              <Empty icon={PackageOpen} hue="sun" title="Nothing suitable is in store" hint="Nothing in the requested category is in store in working order. Raise a purchase request and procurement buys it." />
            ) : (
              <>
                <p className="mb-3 text-sm text-neutral-600">
                  In store and in working order, best condition first.{" "}
                  {r.kind === "onboarding" && "Choose one for each thing the kit lists."}
                </p>
                {[...wanted.keys()].map((cid) => {
                  const pool = r.pool.filter((a) => a.categoryId === cid);
                  const picked = pool.filter((a) => chosen.includes(a.id)).length;
                  const want = wanted.get(cid) ?? 1;
                  return (
                    <fieldset key={cid} className="mb-4 last:mb-0">
                      <legend className="mb-2 flex w-full items-center justify-between gap-2 text-sm font-semibold text-neutral-800">
                        <span>{catName(cid)}</span>
                        <Chip hue={picked >= want ? "mint" : "slate"}>
                          {picked} of {want} chosen
                        </Chip>
                      </legend>
                      {pool.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-neutral-200 px-4 py-3 text-sm text-neutral-500">None in store.</p>
                      ) : (
                        <ul className="grid gap-2 sm:grid-cols-2">
                          {pool.map((a) => {
                            const on = chosen.includes(a.id);
                            return (
                              <li key={a.id}>
                                <label
                                  className={cx(
                                    "flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-3 transition",
                                    on ? "border-primary-400 bg-primary-50/60 ring-2 ring-primary-200" : "border-neutral-200 hover:border-neutral-300",
                                  )}
                                >
                                  <input type="checkbox" className="mt-1 h-4 w-4 accent-primary-600" checked={on} onChange={() => toggle(a)} aria-label={`${a.tagNo ?? ""} ${a.name}`.trim()} />
                                  <span className="min-w-0 flex-1">
                                    <AssetTag tagNo={a.tagNo} code={a.categoryCode} size="sm" />
                                    <span className="mt-1.5 block truncate text-sm font-semibold text-neutral-900">{a.name}</span>
                                    <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
                                      <ConditionChip value={a.condition} />
                                      {a.location}
                                    </span>
                                  </span>
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </fieldset>
                  );
                })}
              </>
            )}
          </div>
        )}

        {r.kind === "transfer" && (
          <p className="rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
            {r.toUser ? `${r.toUser} signs for it in My assets; it stays with its holder until then.` : `It moves at once${r.project ? ` to ${r.project.name}` : ""}${r.toLocation ? ` at ${r.toLocation}` : ""}.`}
          </p>
        )}
        {r.kind === "take_out" && (
          <p className="rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
            A gate pass with a QR code is issued to {r.forUser ?? r.requester ?? "them"}, due back {day(r.returnBy)}. Check it back in when it returns.
          </p>
        )}
        {r.kind === "disposal" && <DisposalSum nbv={r.book?.nbv ?? null} proceeds={r.proceeds ?? 0} method={r.disposalMethod} />}

        {r.kind === "replacement" && (
          <div className="grid gap-4 rounded-xl border border-neutral-200 p-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Segmented
                label="The old one goes"
                value={oldTo}
                onChange={setOldTo}
                options={[
                  { key: "store", label: "Back to store" },
                  { key: "maintenance", label: "For maintenance" },
                ]}
              />
            </div>
            {oldTo === "store" && (
              <Field id={`${uid}-old`} label="Condition of the old one">
                <SearchableSelect id={`${uid}-old`} value={condOld} onChange={(v) => setCondOld(v as AssetCondition)} options={conditionOptions} searchPlaceholder="Search conditions" />
              </Field>
            )}
          </div>
        )}

        {r.kind !== "take_out" && r.kind !== "disposal" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={`${uid}-cond`} label={r.kind === "return" ? "Condition it came back in" : "Condition at handover"} hint="Optional">
              <SearchableSelect
                id={`${uid}-cond`}
                value={cond}
                onChange={setCond}
                options={conditionOptions}
                clearable
                clearLabel="As recorded"
                placeholder="As recorded"
                searchPlaceholder="Search conditions"
              />
            </Field>
            {r.kind !== "return" && (
              <Field id={`${uid}-acc`} label="Accessories" hint="Optional">
                <input id={`${uid}-acc`} className={inputClass} value={accessories} maxLength={255} onChange={(e) => setAccessories(e.target.value)} placeholder="Charger, bag" />
              </Field>
            )}
          </div>
        )}
        {r.kind === "disposal" ? (
          <Field id={`${uid}-on`} label="Date it left">
            <input id={`${uid}-on`} type="date" className={`${inputClass} sm:w-56`} value={on} max={todayYmd()} onChange={(e) => setOn(e.target.value)} />
          </Field>
        ) : (
          r.kind !== "take_out" &&
          r.kind !== "transfer" && (
            <Field id={`${uid}-note`} label="Note" hint="Optional">
              <textarea id={`${uid}-note`} rows={2} className={textareaClass} value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} />
            </Field>
          )
        )}

        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          {onConvert ? (
            <button
              type="button"
              onClick={onConvert}
              disabled={busy !== null || working}
              className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 text-sm font-semibold text-primary-700 underline-offset-2 hover:underline disabled:opacity-50"
            >
              <ShoppingCart size={15} aria-hidden />
              Nothing suitable? Raise a purchase request
            </button>
          ) : (
            <span />
          )}
          <Button variant={r.kind === "disposal" ? "danger" : "primary"} icon={icon} disabled={working || busy !== null || (fromPool && r.pool.length === 0)} onClick={() => void fulfil()}>
            {working ? "Working…" : label}
          </Button>
        </div>
      </div>
    </Panel>
  );
}

/** Finance's net book value against the proceeds: the gain or loss the disposal will post. */
export function DisposalSum({ nbv, proceeds, method }: { nbv: number | null; proceeds: number; method: string | null }) {
  const gl = expectedGainLoss(nbv, proceeds);
  const gain = gl !== null && gl > 0;
  const loss = gl !== null && gl < 0;
  return (
    <div className="rounded-xl border border-neutral-200 p-4">
      <div className="grid grid-cols-3 items-end gap-3 text-center">
        <div>
          <p className="text-xs font-medium text-neutral-500">Net book value</p>
          <p className="mt-1 text-[15px] font-bold text-neutral-900">{nbv === null ? "Not on the books" : amount(nbv)}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-neutral-500">Proceeds{method ? ` (${DISPOSAL[method as keyof typeof DISPOSAL] ?? method})` : ""}</p>
          <p className="mt-1 text-[15px] font-bold text-neutral-900">{amount(proceeds)}</p>
        </div>
        <div className={cx("rounded-xl px-2 py-2", gain ? "bg-mint-50 text-mint-700" : loss ? "bg-rose-50 text-rose-700" : "bg-neutral-50 text-neutral-700")}>
          <p className="flex items-center justify-center gap-1 text-xs font-semibold">
            {gain ? <TrendingUp size={13} aria-hidden /> : loss ? <TrendingDown size={13} aria-hidden /> : null}
            {gl === null ? "Gain or loss" : gain ? "Expected gain" : loss ? "Expected loss" : "No gain or loss"}
          </p>
          <p className="mt-1 text-[15px] font-bold tabular-nums">{gl === null ? "-" : amount(Math.abs(gl))}</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-neutral-500">Finance posts this to its books when the asset is disposed of.</p>
    </div>
  );
}

