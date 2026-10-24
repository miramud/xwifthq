"use client";

import { useCallback, useEffect, useId, useState } from "react";
import Link from "next/link";
import { Ban, CalendarClock, CheckCheck, ChevronRight, ClipboardList, DoorOpen, Laptop, MapPin, MessageSquareWarning, PenLine, ScanLine, ShieldCheck } from "lucide-react";
import { Button, Card, Chip, Empty, PageHeader, Panel, buttonClass, cx } from "@/components/workspace/kit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { todayYmd } from "@/components/workspace/Calendar";
import { ErrorNote, Skeleton, inputClass } from "@/suite/lms/components/ui/ws";
import { LoadError, Notice } from "@/suite/org/components/foundations/shared";
import { day } from "@/suite/finance/lib/format";
import { myAssets, opsError, type AssetMovement, type AssetRequest, type MyAsset, type MyAssets as MyAssetsData, type MyRequestKind } from "@/lib/api/operations-assets-client";
import { condition, daysFrom, plural, requestKind, requestStatus, stampOf } from "@/suite/operations/components/assets/labels";
import { AssetTag, ConditionChip, MetaChip } from "@/suite/operations/components/assets/parts";
import { PassStateChip } from "@/suite/operations/components/assets/GatePasses";
import AskDialog from "./AskDialog";

/**
 * My assets: what I hold, handovers waiting for my signature, confirming
 * what I hold during a verification, and my requests about equipment.
 */
export default function MyAssets() {
  const confirm = useConfirm();
  const [data, setData] = useState<MyAssetsData | null>(null);
  const [requests, setRequests] = useState<AssetRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [asking, setAsking] = useState<{ kind?: MyRequestKind; assetId?: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([myAssets.get(), myAssets.requests()]).then(
      ([d, r]) => {
        if (!alive) return;
        setData(d);
        setRequests(r.requests);
        setError(null);
      },
      (e: unknown) => alive && setError(`Your assets didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  const refresh = useCallback(() => setReload((k) => k + 1), []);

  if (error && !data) return <LoadError text={error} onRetry={refresh} />;
  if (!data || !requests) {
    return (
      <div aria-busy="true" className="space-y-6">
        <p className="sr-only">Loading your assets…</p>
        <Skeleton className="h-20" />
        <Skeleton className="h-[160px]" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[180px]" />
          ))}
        </div>
      </div>
    );
  }

  const run = async (key: string, fn: () => Promise<unknown>, ok: string): Promise<boolean> => {
    setBusy(key);
    setActionError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(ok);
      refresh();
      return true;
    } catch (e) {
      setActionError(opsError(e));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const acknowledge = async (m: AssetMovement) => {
    const ok = await confirm({
      title: "Sign for this asset?",
      body: `You confirm you have received ${m.asset?.tagNo ?? ""} ${m.asset?.name ?? "the asset"}${m.accessories ? ` with ${m.accessories}` : ""}${m.condition ? `, in ${condition(m.condition).label.toLowerCase()} condition` : ""}. You become its custodian of record.`,
      confirmLabel: "Sign for it",
      tone: "primary",
    });
    if (ok) await run(`ack-${m.id}`, () => myAssets.acknowledge(m.id), `You signed for ${m.asset?.tagNo ?? "the asset"}. It is now yours to look after.`);
  };

  const cancel = async (r: AssetRequest) => {
    const ok = await confirm({
      title: "Cancel this request?",
      body: `${r.number ?? "The request"} is closed. You can raise it again later. This can't be undone.`,
      confirmLabel: "Cancel the request",
    });
    if (ok) await run(`cancel-${r.id}`, () => myAssets.cancel(r.id), `${r.number ?? "The request"} is cancelled.`);
  };

  const d = data;
  const today = todayYmd();

  return (
    <div>
      <PageHeader
        title="My assets"
        subtitle="What you hold, what is waiting for your signature and your requests about equipment."
        actions={
          <Button variant="primary" icon={MessageSquareWarning} onClick={() => setAsking({})}>
            Report a problem or ask for something
          </Button>
        }
      />

      <Notice text={notice} />
      {actionError && <ErrorNote className="mb-4">{actionError}</ErrorNote>}

      <div className="space-y-6">
        {d.handovers.length > 0 && (
          <section aria-labelledby="sign-heading" className="rounded-[1.25rem] bg-gradient-to-br from-primary-400 via-primary-500 to-primary-700 p-5 text-white shadow-lg shadow-primary-600/20">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/20">
                <PenLine size={18} aria-hidden />
              </span>
              <div>
                <h2 id="sign-heading" className="text-[15px] font-semibold">
                  Waiting for your signature
                </h2>
                <p className="text-xs text-white/85">Check what you received, then sign. Until you do, it stays with whoever sent it.</p>
              </div>
            </div>
            <ul className="grid gap-3 md:grid-cols-2">
              {d.handovers.map((m) => (
                <li key={m.id} className="rounded-2xl bg-white p-4 text-neutral-900">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <AssetTag tagNo={m.asset?.tagNo ?? null} />
                    <span className="font-mono text-xs text-neutral-500">{m.handoverNo}</span>
                  </div>
                  <p className="mt-2 text-[15px] font-semibold">{m.asset?.name ?? "An asset"}</p>
                  <p className="text-xs text-neutral-500">
                    {m.asset?.category}
                    {m.from && ` · from ${m.from}`}
                    {m.by && !m.from && ` · from ${m.by}`} · {stampOf(m.at)}
                  </p>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <dt className="text-neutral-500">Condition</dt>
                      <dd className="mt-0.5">{m.condition ? <ConditionChip value={m.condition} /> : "-"}</dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500">With</dt>
                      <dd className="mt-0.5 font-medium text-neutral-800">{m.accessories ?? "Nothing else"}</dd>
                    </div>
                  </dl>
                  {m.note && <p className="mt-2 rounded-xl bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-600">{m.note}</p>}
                  <Button variant="primary" icon={CheckCheck} className="mt-3 w-full" disabled={busy !== null} onClick={() => void acknowledge(m)}>
                    {busy === `ack-${m.id}` ? "Signing…" : "Acknowledge receipt"}
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {d.verification && <VerificationBanner v={d.verification} busy={busy} onConfirm={(tag) => run(`verify-${tag}`, () => myAssets.verify(tag), `${tag} confirmed. Thank you.`)} />}

        <Panel title="What I hold" subtitle={plural(d.assets.length, "asset")} icon={Laptop} hue="sky">
          {d.assets.length === 0 ? (
            <Empty icon={Laptop} title="You hold no assets" hint="Equipment Operations hands you shows here once you sign for it. Need something? Ask for it." />
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {d.assets.map((a) => (
                <HeldCard
                  key={a.id}
                  a={a}
                  today={today}
                  verifying={Boolean(d.verification)}
                  busy={busy}
                  onConfirm={() => void run(`verify-${a.id}`, () => myAssets.verify(a.id), `${a.tagNo ?? a.name} confirmed. Thank you.`)}
                  onFault={() => setAsking({ kind: "replacement", assetId: a.id })}
                />
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="My asset requests" icon={ClipboardList} hue="grape">
          {requests.length === 0 ? (
            <Empty icon={ClipboardList} hue="grape" title="No requests yet" hint="Report a fault, ask for equipment or arrange a take-out with the button above." />
          ) : (
            <ul className="divide-y divide-neutral-100">
              {requests.map((r) => (
                <li key={r.id} className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <MetaChip meta={requestKind(r.kind)} />
                      <Link
                        href={`/suite/operations/my/assets/requests/${r.id}`}
                        className="truncate rounded text-sm font-semibold text-neutral-900 outline-none hover:text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-300"
                      >
                        {r.asset ? `${r.asset.tagNo ?? ""} ${r.asset.name}`.trim() : (r.category ?? r.reason ?? "-")}
                      </Link>
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">
                      <span className="font-mono">{r.number ?? "Draft"}</span> · {stampOf(r.createdAt)}
                      {r.returnBy && ` · back by ${day(r.returnBy)}`}
                    </p>
                    {r.gatePass && (
                      <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-neutral-600">
                        <DoorOpen size={13} aria-hidden /> Gate pass <span className="font-mono font-semibold">{r.gatePass.number}</span>
                        <PassStateChip pass={r.gatePass} />
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <MetaChip meta={requestStatus(r.status)} />
                    <Link
                      href={`/suite/operations/my/assets/requests/${r.id}`}
                      className={buttonClass("ghost", "sm")}
                      aria-label={`Open ${r.number ?? "request"}`}
                    >
                      Open
                      <ChevronRight size={15} aria-hidden />
                    </Link>
                    {(r.status === "draft" || r.status === "approved") && (
                      <Button size="sm" variant="ghost" icon={Ban} disabled={busy !== null} onClick={() => void cancel(r)}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {asking && (
        <AskDialog
          held={d.assets}
          categories={d.categories}
          initialKind={asking.kind}
          initialAssetId={asking.assetId}
          onClose={() => setAsking(null)}
          onDone={(r) => {
            setAsking(null);
            setNotice(`${r.number ?? "Your request"} is sent${r.status === "approved" ? " and approved" : " for approval"}.`);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function VerificationBanner({ v, busy, onConfirm }: { v: NonNullable<MyAssetsData["verification"]>; busy: string | null; onConfirm: (tag: string) => Promise<boolean> }) {
  const uid = useId();
  const [tag, setTag] = useState("");
  const left = daysFrom(todayYmd(), v.endsOn);
  return (
    <Card className="border-sun-500/30 bg-sun-50/60 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sun-100 text-sun-700">
            <ScanLine size={20} aria-hidden />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold text-neutral-900">{v.name}: confirm what you hold</h2>
            <p className="mt-0.5 text-sm text-neutral-600">
              {v.pending > 0 ? `${plural(v.pending, "asset")} still to confirm` : "Everything you hold is confirmed. Thank you."}
              {v.endsOn && ` · ends ${day(v.endsOn)}`}
              {left !== null && left >= 0 && left <= 3 && v.pending > 0 && (
                <Chip hue="coral" className="ml-2">
                  {left === 0 ? "Ends today" : `${plural(left, "day")} left`}
                </Chip>
              )}
            </p>
          </div>
        </div>
        {v.pending > 0 && (
          <form
            className="flex w-full gap-2 lg:w-auto"
            onSubmit={(e) => {
              e.preventDefault();
              const t = tag.trim();
              if (t) void onConfirm(t).then((ok) => ok && setTag(""));
            }}
          >
            <label htmlFor={`${uid}-tag`} className="sr-only">
              Asset tag
            </label>
            <input
              id={`${uid}-tag`}
              className={cx(inputClass, "min-w-0 font-mono lg:w-56")}
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="Scan or type the tag"
              autoComplete="off"
              inputMode="text"
            />
            <Button type="submit" variant="primary" disabled={!tag.trim() || busy !== null}>
              Confirm
            </Button>
          </form>
        )}
      </div>
    </Card>
  );
}

function HeldCard({ a, today, verifying, busy, onConfirm, onFault }: { a: MyAsset; today: string; verifying: boolean; busy: string | null; onConfirm: () => void; onFault: () => void }) {
  const warranty = daysFrom(today, a.warrantyUntil);
  return (
    <li>
      <Card as="div" className={cx("flex h-full flex-col gap-3 p-5", a.toVerify && "ring-2 ring-sun-400/60")}>
        <div className="flex items-start justify-between gap-2">
          <AssetTag tagNo={a.tagNo} code={a.categoryCode} />
          {a.toVerify ? (
            <Chip hue="sun" icon={ScanLine}>
              To confirm
            </Chip>
          ) : verifying ? (
            <Chip hue="mint" icon={ShieldCheck}>
              Confirmed
            </Chip>
          ) : null}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-neutral-900">{a.name}</p>
          <p className="truncate text-xs text-neutral-500">{[a.category, a.make, a.model].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
          <ConditionChip value={a.condition} />
          {a.status !== "allocated" && <MetaChip meta={{ label: a.statusLabel, hue: "slate", icon: CalendarClock }} />}
          {a.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin size={12} aria-hidden />
              {a.location}
            </span>
          )}
        </div>
        {a.warrantyUntil && (
          <p className="text-xs text-neutral-500">
            Warranty {warranty !== null && warranty < 0 ? `ended ${day(a.warrantyUntil)}` : `until ${day(a.warrantyUntil)}`}
          </p>
        )}
        <div className="mt-auto flex flex-wrap gap-2 border-t border-neutral-100 pt-3">
          {a.toVerify && (
            <Button size="sm" variant="primary" icon={CheckCheck} disabled={busy !== null} onClick={onConfirm} aria-label={`Confirm you have ${a.tagNo ?? a.name}`}>
              Confirm I have it
            </Button>
          )}
          <Button size="sm" icon={MessageSquareWarning} onClick={onFault} aria-label={`Report a problem with ${a.tagNo ?? a.name}`}>
            Report a problem
          </Button>
        </div>
      </Card>
    </li>
  );
}
