"use client";

import { useEffect, useId, useState } from "react";
import { BadgeCheck, CircleCheck, FileWarning, Hourglass, Plus, ShieldAlert } from "lucide-react";
import { Button, Chip, Empty, PageHeader, Segmented, StatGrid } from "@/components/workspace/kit";
import Link from "next/link";
import { DataView, type Column } from "@/components/workspace/DataView";
import { DetailDrawer } from "@/components/workspace/DetailDrawer";
import { csvAmount, csvDate, csvName, downloadCsv } from "@/components/workspace/csv";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { DialogFrame } from "@/suite/org/components/ui";
import { ErrorNote, Field, Skeleton, StatCard, inputClass } from "@/suite/lms/components/ui/ws";
import { FieldError, LoadError } from "@/suite/org/components/foundations/shared";
import { Money } from "@/suite/finance/components/banking/ui";
import { compact, day } from "@/suite/finance/lib/format";
import { useAuth } from "@/lib/auth-store";
import { mayDoOps } from "@/suite/operations/lib/operations-access";
import { maintenance, opsError, opsFieldErrors, type ClaimInput, type ClaimKind, type ClaimStatus, type InsuranceClaim } from "@/lib/api/operations-maintenance-client";
import { MoneyInput } from "@/suite/operations/components/travel/shared";
import { AssetTag } from "@/suite/operations/components/assets/parts";
import { CLAIM_KIND, CLAIM_STATUS, ymdOf } from "./labels";
import { maintenanceTabs, useMaintenancePickers } from "./parts";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";
import { RichTextView } from "@/components/workspace/RichTextView";
import { richExcerpt, richToPlain } from "@/lib/richText";

const OPEN: ClaimStatus[] = ["open", "submitted"];

/**
 * Insurance claims for damage, theft and accidents: what is still with the
 * insurer, what was claimed and what came back.
 */
export default function ClaimsDesk() {
  const { user } = useAuth();
  const [claims, setClaims] = useState<InsuranceClaim[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState<InsuranceClaim | "new" | null>(null);
  const [viewing, setViewing] = useState<InsuranceClaim | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    maintenance.claims().then(
      (c) => {
        if (!alive) return;
        setClaims(c);
        setError(null);
      },
      (e: unknown) => alive && setError(`The claims didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  if (error && !claims) {
    return (
      <div>
        <PageHeader title="Maintenance" tabs={maintenanceTabs()} activeTab="claims" />
        <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  }

  if (!claims) {
    return (
      <div aria-busy="true" className="space-y-6">
        <p className="sr-only">Loading the claims…</p>
        <Skeleton className="h-24" />
        <Skeleton className="h-[360px]" />
      </div>
    );
  }

  const can = (a: string) => mayDoOps(user, "maintenance", a);
  const open = claims.filter((c) => OPEN.includes(c.status));
  const settled = claims.filter((c) => c.status === "settled");
  const claimedSettled = settled.reduce((s, c) => s + c.amountClaimed, 0);
  const recovered = settled.reduce((s, c) => s + (c.amountSettled ?? 0), 0);

  const columns: Column<InsuranceClaim>[] = [
    {
      key: "incident",
      header: "Incident",
      primary: true,
      sortable: true,
      value: (c) => `${c.incidentOn ?? ""} ${richExcerpt(c.incidentReport, 300)}`,
      render: (c) => (
        <span className="block min-w-0">
          <span className="block truncate font-semibold text-neutral-900">
            {CLAIM_KIND[c.kind] ?? c.kind} · {day(c.incidentOn)}
          </span>
          <span className="block max-w-[28rem] truncate text-xs text-neutral-500">{richExcerpt(c.incidentReport, 200)}</span>
        </span>
      ),
    },
    { key: "asset", header: "Asset", value: (c) => c.asset ?? "", render: (c) => (c.asset ? <AssetTag tagNo={c.asset} size="sm" /> : <span className="text-sm text-neutral-500">-</span>) },
    {
      key: "insurer",
      header: "Insurer",
      hideOnMobile: true,
      value: (c) => `${c.insurer ?? ""} ${c.claimNo ?? ""}`,
      render: (c) => (
        <span className="block text-sm">
          <span className="block text-neutral-800">{c.insurer ?? "-"}</span>
          {c.claimNo && <span className="block font-mono text-xs text-neutral-500">{c.claimNo}</span>}
        </span>
      ),
    },
    { key: "claimed", header: "Claimed", sortable: true, align: "right", value: (c) => c.amountClaimed, render: (c) => <Money value={c.amountClaimed} className="text-sm" /> },
    { key: "settled", header: "Settled", sortable: true, align: "right", value: (c) => c.amountSettled ?? -1, render: (c) => (c.amountSettled === null ? <span className="text-sm text-neutral-400">-</span> : <Money value={c.amountSettled} className="text-sm font-semibold text-mint-700" />) },
    {
      key: "status",
      header: "Status",
      sortable: true,
      value: (c) => c.status,
      render: (c) => {
        const m = CLAIM_STATUS[c.status] ?? CLAIM_STATUS.open;
        return (
          <Chip hue={m.hue} icon={m.icon}>
            {m.label}
          </Chip>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Maintenance"
        subtitle="Insurance claims for damaged, stolen and crashed assets."
        actions={
          can("create_claim") ? (
            <Button variant="primary" icon={Plus} onClick={() => setEditing("new")}>
              Record a claim
            </Button>
          ) : undefined
        }
        tabs={maintenanceTabs()}
        activeTab="claims"
      />

      {notice && (
        <p role="status" className="mb-4 flex items-start gap-2 rounded-2xl bg-mint-50 px-4 py-3 text-sm text-mint-700 ring-1 ring-mint-500/20">
          <CircleCheck size={16} className="mt-0.5 shrink-0" aria-hidden />
          {notice}
        </p>
      )}

      <div className="space-y-6">
        <StatGrid>
          <StatCard featured label="Open claims" value={open.length} icon={ShieldAlert} hint={`${compact(open.reduce((s, c) => s + c.amountClaimed, 0))} claimed`} />
          <StatCard label="With the insurer" value={claims.filter((c) => c.status === "submitted").length} icon={Hourglass} hue="grape" hint="Submitted, waiting to hear" />
          <StatCard label="Recovered" value={compact(recovered)} icon={BadgeCheck} hue="mint" hint={claimedSettled ? `${Math.round((100 * recovered) / claimedSettled)}% of what was claimed on settled claims` : "Nothing settled yet"} />
          <StatCard label="Rejected" value={claims.filter((c) => c.status === "rejected").length} icon={FileWarning} hue="rose" hint="Turned down by the insurer" />
        </StatGrid>

        <DataView
          rows={claims}
          columns={columns}
          rowKey={(c) => c.id}
          onRowClick={(c) => setViewing(c)}
          onDownload={(list) =>
            downloadCsv(csvName("insurance-claims", ymdOf(new Date())), [
              ["Kind", "Incident date", "Incident report", "Asset", "Insurer", "Policy number", "Claim number", "Status", "Currency", "Claimed", "Settled", "Reported by"],
              ...list.map((c) => [
                CLAIM_KIND[c.kind] ?? c.kind,
                csvDate(c.incidentOn),
                richToPlain(c.incidentReport),
                c.asset ?? "",
                c.insurer ?? "",
                c.policyNo ?? "",
                c.claimNo ?? "",
                (CLAIM_STATUS[c.status] ?? CLAIM_STATUS.open).label,
                "NGN",
                csvAmount(c.amountClaimed),
                csvAmount(c.amountSettled),
                c.reportedBy ?? "",
              ]),
            ])
          }
          storageKey="ops-maintenance-claims"
          views={["table", "list"]}
          searchPlaceholder="Search claims"
          caption="Insurance claims"
          empty={<Empty icon={ShieldAlert} hue="rose" title="No claims recorded" hint="When an asset is damaged, stolen or in an accident, record the claim here." />}
        />
      </div>

      {viewing && <ClaimDrawer claim={viewing} onClose={() => setViewing(null)} onEdit={can("update_claim") ? () => setEditing(viewing) : undefined} />}
      {editing && (
        <ClaimDialog
          claim={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onDone={(m) => {
            setEditing(null);
            setNotice(m);
            setReload((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}

const KINDS: ClaimKind[] = ["damage", "theft", "accident", "other"];

export function ClaimDialog({ claim, onClose, onDone }: { claim: InsuranceClaim | null; onClose: () => void; onDone: (message: string) => void }) {
  const uid = useId();
  const pickers = useMaintenancePickers();
  const [assetId, setAssetId] = useState(claim?.assetId ?? "");
  const [kind, setKind] = useState<ClaimKind>(claim?.kind ?? "damage");
  const [incidentOn, setIncidentOn] = useState(claim?.incidentOn ?? ymdOf(new Date()));
  const [report, setReport] = useState(claim?.incidentReport ?? "");
  const [insurer, setInsurer] = useState(claim?.insurer ?? "");
  const [policyNo, setPolicyNo] = useState(claim?.policyNo ?? "");
  const [claimNo, setClaimNo] = useState(claim?.claimNo ?? "");
  const [claimed, setClaimed] = useState<number | null>(claim?.amountClaimed ?? null);
  const [settled, setSettled] = useState<number | null>(claim?.amountSettled ?? null);
  const [status, setStatus] = useState<ClaimStatus>(claim?.status ?? "open");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const local: Record<string, string> = {};
    if (!report.trim()) local.incidentReport = "Write what happened: where, when, who was involved.";
    if (!incidentOn) local.incidentOn = "When did it happen?";
    if (status === "settled" && settled === null) local.amountSettled = "Enter what the insurer paid.";
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    const input: ClaimInput = {
      assetId: assetId || null,
      kind,
      incidentOn,
      incidentReport: report.trim(),
      insurer: insurer.trim() || null,
      policyNo: policyNo.trim() || null,
      claimNo: claimNo.trim() || null,
      amountClaimed: claimed ?? 0,
      ...(claim ? { amountSettled: settled, status } : {}),
    };
    setBusy(true);
    setErrors({});
    try {
      if (claim) await maintenance.updateClaim(claim.id, input);
      else await maintenance.createClaim(input);
      onDone(claim ? "Claim saved." : "Claim recorded.");
    } catch (e) {
      const f = opsFieldErrors(e);
      setErrors(Object.keys(f).length ? f : { general: opsError(e) });
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      size="lg"
      titleId={`${uid}-t`}
      title={claim ? "Update the claim" : "Record an insurance claim"}
      subtitle="The incident, the policy it is claimed on, and what the insurer pays."
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Saving…" : claim ? "Save claim" : "Record claim"}
          </Button>
        </div>
      }
    >
      {errors.general && <ErrorNote>{errors.general}</ErrorNote>}
      <div className="flex flex-wrap items-center gap-3">
        <Segmented label="What happened" value={kind} onChange={setKind} options={KINDS.map((k) => ({ key: k, label: CLAIM_KIND[k] }))} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${uid}-asset`} label="Asset" hint="Optional">
          <SearchableSelect
            id={`${uid}-asset`}
            value={assetId}
            onChange={setAssetId}
            options={pickers.assets ?? []}
            clearable
            clearLabel="No asset"
            placeholder={pickers.assets === null ? "Loading the register…" : "No asset"}
            searchPlaceholder="Search by name or tag"
          />
          <FieldError message={errors.assetId} />
        </Field>
        <Field id={`${uid}-on`} label="Incident date">
          <input id={`${uid}-on`} type="date" className={inputClass} value={incidentOn} max={ymdOf(new Date())} onChange={(e) => setIncidentOn(e.target.value)} aria-invalid={errors.incidentOn ? true : undefined} />
          <FieldError message={errors.incidentOn} />
        </Field>
      </div>
      <Field id={`${uid}-report`} label="Incident report">
        <RichTextEditor id={`${uid}-report`} minHeight={128} value={report} onChange={setReport} placeholder="Rear-ended at the Berger roundabout on 1 Oct; police report AB/1182." invalid={Boolean(errors.incidentReport ? true : undefined)} />
        <FieldError message={errors.incidentReport} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id={`${uid}-ins`} label="Insurer">
          <input id={`${uid}-ins`} className={inputClass} value={insurer} maxLength={160} onChange={(e) => setInsurer(e.target.value)} placeholder="AXA Mansard" />
        </Field>
        <Field id={`${uid}-pol`} label="Policy number">
          <input id={`${uid}-pol`} className={inputClass} value={policyNo} maxLength={80} onChange={(e) => setPolicyNo(e.target.value)} />
        </Field>
        <Field id={`${uid}-cno`} label="Claim number">
          <input id={`${uid}-cno`} className={inputClass} value={claimNo} maxLength={80} onChange={(e) => setClaimNo(e.target.value)} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id={`${uid}-claimed`} label="Amount claimed">
          <MoneyInput id={`${uid}-claimed`} value={claimed} onChange={setClaimed} />
          <FieldError message={errors.amountClaimed} />
        </Field>
        {claim && (
          <>
            <Field id={`${uid}-settled`} label="Amount settled">
              <MoneyInput id={`${uid}-settled`} value={settled} onChange={setSettled} invalid={Boolean(errors.amountSettled)} />
              <FieldError message={errors.amountSettled} />
            </Field>
            <Field id={`${uid}-status`} label="Status">
              <SearchableSelect id={`${uid}-status`} value={status} onChange={(v) => setStatus(v as ClaimStatus)} options={(Object.keys(CLAIM_STATUS) as ClaimStatus[]).map((s) => ({ value: s, label: CLAIM_STATUS[s].label }))} />
            </Field>
          </>
        )}
      </div>
    </DialogFrame>
  );
}

/** A claim read in full: the incident, the policy, the money, and the work order it came from. */
function ClaimDrawer({ claim, onClose, onEdit }: { claim: InsuranceClaim; onClose: () => void; onEdit?: () => void }) {
  const m = CLAIM_STATUS[claim.status] ?? CLAIM_STATUS.open;
  return (
    <DetailDrawer
      title={`${CLAIM_KIND[claim.kind] ?? claim.kind} claim`}
      subtitle={[claim.insurer, claim.claimNo].filter(Boolean).join(" · ") || "Insurance claim"}
      icon={ShieldAlert}
      hue="rose"
      onClose={onClose}
      onEdit={onEdit}
      editLabel="Update the claim"
      status={
        <Chip hue={m.hue} icon={m.icon}>
          {m.label}
        </Chip>
      }
      facts={[
        { label: "What happened", value: CLAIM_KIND[claim.kind] ?? claim.kind },
        { label: "Incident date", value: claim.incidentOn ? day(claim.incidentOn) : null },
        { label: "Asset", value: claim.asset ? <AssetTag tagNo={claim.asset} size="sm" /> : null },
        { label: "Reported by", value: claim.reportedBy },
        { label: "Insurer", value: claim.insurer },
        { label: "Policy number", value: claim.policyNo },
        { label: "Claim number", value: claim.claimNo },
        { label: "Status", value: m.label },
        { label: "Amount claimed", value: <Money value={claim.amountClaimed} /> },
        { label: "Amount settled", value: claim.amountSettled === null ? null : <Money value={claim.amountSettled} /> },
        {
          label: "Work order",
          value: claim.workOrderId ? (
            <Link href={`/suite/operations/maintenance/${claim.workOrderId}`} className="rounded font-semibold text-primary-700 underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-300">
              Open the work order
            </Link>
          ) : null,
        },
        { label: "Incident report", value: <RichTextView value={claim.incidentReport} size="sm" className="font-normal" />, wide: true },
      ]}
    />
  );
}
