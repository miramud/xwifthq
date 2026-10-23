"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, CalendarClock, ClipboardList, DoorOpen, FolderKanban, Laptop, MapPin, MessageSquareText, PenLine, ShieldCheck, UserRound } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { Button, Panel } from "@/components/workspace/kit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { BackLink, ErrorNote, InfoList, InfoRow, Skeleton } from "@/suite/lms/components/ui/ws";
import { LoadError, Notice } from "@/suite/org/components/foundations/shared";
import { day } from "@/suite/finance/lib/format";
import { myAssets, opsError, type MyAssetRequestDetail as Detail } from "@/lib/api/operations-assets-client";
import { requestKind, requestStatus, stampOf } from "@/suite/operations/components/assets/labels";
import { AssetTag, MetaChip } from "@/suite/operations/components/assets/parts";
import { PassStateChip } from "@/suite/operations/components/assets/GatePasses";
import { ApprovalLink, DocNo, PdfLink } from "@/suite/operations/components/procurement/ui";

/**
 * One of my asset requests: what I asked for, where the approval is, the
 * gate pass for a take-out, and the handover notes once it was fulfilled,
 * each printable.
 */

const NEXT: Record<string, string> = {
  draft: "Not sent yet.",
  in_approval: "Next: the approvers decide. You are told when they do.",
  approved: "Approved. Operations fulfils it next.",
  fulfilled: "Done. Any handover waits for your signature in My assets.",
  rejected: "The approvers turned it down. Ask again if it is still needed.",
  cancelled: "Cancelled.",
  converted: "Nothing suitable was in store, so Operations is buying it.",
};

export default function MyAssetRequestDetail({ id }: { id: string }) {
  const confirm = useConfirm();
  const { user } = useAuth();
  const [r, setR] = useState<Detail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    myAssets.show(id).then(
      (d) => {
        if (!alive) return;
        setR(d);
        setLoadError(null);
      },
      (e: unknown) => alive && setLoadError(`The request didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [id, reload]);

  const refresh = useCallback(() => setReload((n) => n + 1), []);

  const back = <BackLink href="/suite/operations/my/assets" label="My assets" />;
  if (loadError)
    return (
      <div>
        {back}
        <LoadError text={loadError} onRetry={refresh} />
      </div>
    );
  if (!r)
    return (
      <div aria-busy="true" className="space-y-5">
        <p className="sr-only">Loading your request…</p>
        <Skeleton className="h-24" />
        <Skeleton className="h-80" />
      </div>
    );

  const canCancel = (r.status === "draft" || r.status === "approved") && r.requesterId === user?.id;
  const what = r.asset ? `${r.asset.tagNo ?? ""} ${r.asset.name}`.trim() : (r.category ?? "Equipment");
  const pass = r.gatePass;

  const cancel = async () => {
    const ok = await confirm({
      title: "Cancel this request?",
      body: `${r.number ?? "The request"} is closed. You can raise it again later. This can't be undone.`,
      confirmLabel: "Cancel the request",
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await myAssets.cancel(r.id);
      setNotice(`${r.number ?? "The request"} is cancelled.`);
      refresh();
    } catch (e) {
      setError(`It wasn't cancelled. ${opsError(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {back}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="mb-1 flex flex-wrap items-center gap-2">
            <DocNo value={r.number ?? "Not sent yet"} className="text-primary-700" />
            <MetaChip meta={requestStatus(r.status)} />
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-[28px]">
            {r.kindLabel}: {what}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">Raised {stampOf(r.createdAt)}{r.requester && r.requesterId !== user?.id ? ` by ${r.requester}` : ""}</p>
        </div>
        {canCancel && (
          <Button variant="ghost" icon={Ban} disabled={busy} onClick={() => void cancel()}>
            {busy ? "Cancelling…" : "Cancel request"}
          </Button>
        )}
      </div>

      <Notice text={notice} />
      {error && <ErrorNote className="mb-5">{error}</ErrorNote>}

      <div className="mb-5 ws-card p-5">
        <p className="text-sm font-semibold text-neutral-900">{NEXT[r.status] ?? ""}</p>
        {r.approvalId && (
          <div className="mt-2">
            <ApprovalLink id={r.approvalId} label={r.status === "in_approval" ? "See who is deciding" : "See the approval"} />
          </div>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="min-w-0 space-y-5 xl:col-span-2">
          <Panel title="Your request" icon={ClipboardList} hue="grape">
            <InfoList cols={2}>
              <InfoRow icon={ClipboardList} label="Kind">
                <MetaChip meta={requestKind(r.kind)} />
              </InfoRow>
              <InfoRow icon={Laptop} label={r.asset ? "Asset" : "Category"}>
                {r.asset ? (
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <AssetTag tagNo={r.asset.tagNo} size="sm" />
                    {r.asset.name}
                  </span>
                ) : (
                  (r.category ?? "-")
                )}
              </InfoRow>
              {r.forUser && r.forUserId !== r.requesterId && (
                <InfoRow icon={UserRound} label="For">
                  {r.forUser}
                </InfoRow>
              )}
              {r.neededBy && (
                <InfoRow icon={CalendarClock} label="Needed by">
                  {day(r.neededBy)}
                </InfoRow>
              )}
              {r.returnBy && (
                <InfoRow icon={CalendarClock} label="Back by">
                  {day(r.returnBy)}
                </InfoRow>
              )}
              {r.toLocation && (
                <InfoRow icon={MapPin} label="To">
                  {r.toLocation}
                </InfoRow>
              )}
              {r.toUser && (
                <InfoRow icon={UserRound} label="Hand to">
                  {r.toUser}
                </InfoRow>
              )}
              {r.project && (
                <InfoRow icon={FolderKanban} label="Project">
                  {r.project.name}
                </InfoRow>
              )}
              {r.kit && r.kit.length > 0 && (
                <InfoRow icon={Laptop} label="Kit">
                  {r.kit.reduce((n, k) => n + k.quantity, 0)} items
                </InfoRow>
              )}
            </InfoList>
            {r.reason && (
              <div className="mt-4 flex gap-2 rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
                <MessageSquareText size={16} className="mt-0.5 shrink-0 text-neutral-400" aria-hidden />
                <p>{r.reason}</p>
              </div>
            )}
          </Panel>

          <Panel title="Handover notes" subtitle="What was handed to you for this request" icon={PenLine} hue="sky">
            {r.handovers.length === 0 ? (
              <p className="text-sm text-neutral-500">{r.status === "fulfilled" ? "No handover on this request." : "Once Operations hands something over, its note shows here."}</p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {r.handovers.map((m) => (
                  <li key={m.id} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2">
                        <AssetTag tagNo={m.asset?.tagNo ?? null} size="sm" />
                        <span className="truncate text-sm font-semibold text-neutral-900">{m.asset?.name ?? "An asset"}</span>
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">
                        <span className="font-mono">{m.handoverNo}</span> · {stampOf(m.at)}
                        {m.acknowledgedAt ? ` · signed ${stampOf(m.acknowledgedAt)}` : " · waiting for your signature"}
                      </p>
                    </div>
                    <PdfLink href={myAssets.handoverPdfUrl(m.id)} label="Handover note" name={m.handoverNo} className="self-start sm:self-auto" />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <aside className="min-w-0 space-y-5" aria-label="Gate pass">
          {pass ? (
            <Panel title="Gate pass" icon={DoorOpen} hue="sun" actions={<PdfLink href={myAssets.gatePassPdfUrl(pass.id)} label="Print" name={pass.number} />}>
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-semibold text-neutral-900">{pass.number}</span>
                <PassStateChip pass={pass} />
              </p>
              <InfoList>
                <InfoRow icon={CalendarClock} label="Out">
                  {stampOf(pass.outAt)}
                </InfoRow>
                <InfoRow icon={CalendarClock} label="Due back">
                  {pass.dueBackOn ? day(pass.dueBackOn) : "-"}
                </InfoRow>
                {pass.returnedAt && (
                  <InfoRow icon={ShieldCheck} label="Back">
                    {stampOf(pass.returnedAt)}
                  </InfoRow>
                )}
              </InfoList>
              {pass.assets.length > 0 && (
                <ul className="mt-3 space-y-1.5 text-sm">
                  {pass.assets.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center gap-2">
                      <AssetTag tagNo={a.tagNo} size="sm" />
                      <span className="text-neutral-800">{a.name}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-neutral-500">Show the printed pass at the gate. Its code lets security check it is genuine.</p>
            </Panel>
          ) : (
            r.kind === "take_out" && (
              <Panel title="Gate pass" icon={DoorOpen} hue="sun">
                <p className="text-sm text-neutral-600">Your gate pass is issued when Operations fulfils the request.</p>
              </Panel>
            )
          )}
        </aside>
      </div>
    </div>
  );
}
