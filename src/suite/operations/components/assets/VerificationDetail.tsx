"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { ClipboardCheck, Info, Lock, MapPin, ScanLine, UserRound } from "lucide-react";
import { Button, CalloutStrip, Card, Chip, Empty, PageHeader, Panel, Segmented, cx } from "@/components/workspace/kit";
import { Donut, SegmentedGauge } from "@/components/workspace/charts";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { BackLink, ErrorNote, Field, Skeleton, inputClass, textareaClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { useAuth } from "@/lib/auth-store";
import { mayDoOps } from "@/suite/operations/lib/operations-access";
import { ApiError, opsError, verifications, type AssetCondition, type VerificationDetail as Detail, type VerificationItem, type VerificationResult } from "@/lib/api/operations-assets-client";
import { dateSpan } from "@/suite/operations/components/travel/labels";
import { CONDITION, CONDITION_ORDER, VERIFY_RESULT, plural, stampOf, verifyResult } from "./labels";
import { AssetTag, MetaChip, usePickerOptions } from "./parts";

/**
 * One verification: how far it has got, the exceptions first (missing,
 * found elsewhere), and recording what was found for each asset. Closing
 * it records anything not seen as missing.
 */

type Filter = "all" | VerificationResult;

export default function VerificationDetail({ id }: { id: string }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [data, setData] = useState<Detail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");
  const [recording, setRecording] = useState<VerificationItem | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    let alive = true;
    verifications.get(id).then(
      (d) => {
        if (!alive) return;
        setData(d);
        setLoadError(null);
      },
      (e: unknown) => alive && setLoadError(e instanceof ApiError && e.status === 404 ? "This verification wasn't found." : `This verification didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [id, reload]);

  const refresh = useCallback(() => setReload((k) => k + 1), []);

  if (loadError && !data) {
    return (
      <div>
        <BackLink href="/suite/operations/assets/verification" label="Verification" />
        <LoadError text={loadError} onRetry={refresh} />
      </div>
    );
  }
  if (!data) {
    return (
      <div aria-busy="true" className="space-y-6">
        <p className="sr-only">Loading the verification…</p>
        <Skeleton className="h-20" />
        <Skeleton className="h-[240px]" />
        <Skeleton className="h-[360px]" />
      </div>
    );
  }

  const d = data;
  const s = d.summary;
  const isOpen = d.status === "open";
  const canRecord = isOpen && mayDoOps(user, "asset_verification", "record");
  const canClose = isOpen && mayDoOps(user, "asset_verification", "close");
  const shown = filter === "all" ? d.items : d.items.filter((i) => i.result === filter);

  const close = async () => {
    const ok = await confirm({
      title: "Close this verification?",
      body: (
        <p>
          {s.pending > 0 ? (
            <>
              <strong>{plural(s.pending, "asset")} not yet seen</strong> will be recorded as missing.
            </>
          ) : (
            "Every asset has been seen."
          )}{" "}
          Nothing more can be recorded once it is closed. The register itself does not change: investigate missing assets and mark them lost by hand.
        </p>
      ),
      confirmLabel: "Close the verification",
    });
    if (!ok) return;
    setClosing(true);
    setActionError(null);
    try {
      await verifications.close(d.id);
      refresh();
    } catch (e) {
      setActionError(opsError(e));
    } finally {
      setClosing(false);
    }
  };

  const slices = (["verified", "mismatch", "missing", "pending"] as const).map((k) => ({ label: VERIFY_RESULT[k].label, value: s[k], hue: VERIFY_RESULT[k].hue }));

  return (
    <div>
      <BackLink href="/suite/operations/assets/verification" label="Verification" />
      <PageHeader
        eyebrow={dateSpan(d.startsOn, d.endsOn)}
        title={d.name}
        subtitle={
          <span className="mt-1 inline-flex">
            {isOpen ? (
              <Chip hue="sky" dot>
                Open
              </Chip>
            ) : (
              <Chip hue="slate" icon={Lock}>
                Closed {stampOf(d.closedAt)}
              </Chip>
            )}
          </span>
        }
        actions={
          canClose ? (
            <Button variant="danger" icon={Lock} disabled={closing} onClick={() => void close()}>
              {closing ? "Closing…" : "Close the verification"}
            </Button>
          ) : undefined
        }
      />
      {actionError && <ErrorNote className="mb-4">{actionError}</ErrorNote>}

      <div className="mb-6 grid gap-6 lg:grid-cols-5">
        <Card className="flex flex-col items-center justify-center p-5 lg:col-span-2">
          <SegmentedGauge value={s.percent} label="Seen so far" hue={s.missing > 0 ? "coral" : "mint"} caption={`${s.verified + s.mismatch} of ${plural(s.total, "asset")} seen`} />
        </Card>
        <Panel title="Register against found" icon={ClipboardCheck} hue="mint" className="lg:col-span-3">
          <Donut data={slices} total={s.total} centerLabel="assets" caption="Verification results" />
          {s.conditionChanged > 0 && (
            <CalloutStrip icon={Info} hue="sun" className="mt-4" title={`${plural(s.conditionChanged, "asset was", "assets were")} found in a different condition from the register.`} />
          )}
        </Panel>
      </div>

      <Panel
        title="Assets"
        subtitle="Missing and found elsewhere first"
        icon={ScanLine}
        hue="blue"
        actions={
          <div className="hidden md:block">
            <Segmented
              label="Show"
              value={filter}
              onChange={setFilter}
              options={[
                { key: "all", label: `All ${s.total}` },
                { key: "missing", label: `Missing ${s.missing}` },
                { key: "mismatch", label: `Elsewhere ${s.mismatch}` },
                { key: "pending", label: `Not seen ${s.pending}` },
                { key: "verified", label: `Verified ${s.verified}` },
              ]}
            />
          </div>
        }
      >
        <div className="mb-3 md:hidden">
          <SearchableSelect
            aria-label="Show"
            value={filter}
            onChange={(v) => setFilter(v as Filter)}
            options={[
              { value: "all", label: "All", hint: String(s.total) },
              { value: "missing", label: "Missing", hint: String(s.missing) },
              { value: "mismatch", label: "Found elsewhere", hint: String(s.mismatch) },
              { value: "pending", label: "Not yet seen", hint: String(s.pending) },
              { value: "verified", label: "Verified", hint: String(s.verified) },
            ]}
          />
        </div>
        {shown.length === 0 ? (
          <Empty icon={ScanLine} hue="slate" title="Nothing here" hint="Try another filter." />
        ) : (
          <ul className="divide-y divide-neutral-100">
            {shown.map((i) => (
              <ItemRow key={i.id} item={i} onRecord={canRecord ? () => setRecording(i) : undefined} />
            ))}
          </ul>
        )}
      </Panel>

      {recording && (
        <RecordDialog
          campaignId={d.id}
          item={recording}
          onClose={() => setRecording(null)}
          onDone={() => {
            setRecording(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function ItemRow({ item: i, onRecord }: { item: VerificationItem; onRecord?: () => void }) {
  const exception = i.result === "missing" || i.result === "mismatch";
  return (
    <li className={cx("flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between", exception && "-mx-2 rounded-2xl px-2", i.result === "missing" && "bg-rose-50/50", i.result === "mismatch" && "bg-sun-50/60")}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <AssetTag tagNo={i.asset?.tagNo ?? null} code={i.asset?.categoryCode} size="sm" />
          <span className="truncate text-sm font-semibold text-neutral-900">{i.asset?.name ?? "An asset no longer on the register"}</span>
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-neutral-500">
          <span className="inline-flex items-center gap-1">
            <UserRound size={12} aria-hidden /> Expected with {i.expectedCustodian ?? "nobody"}
          </span>
          {i.expectedLocation && (
            <span className="inline-flex items-center gap-1">
              <MapPin size={12} aria-hidden /> {i.expectedLocation}
            </span>
          )}
        </p>
        {i.result === "mismatch" && (
          <p className="mt-1 text-xs font-medium text-sun-700">
            Found with {i.foundCustodian ?? "nobody"}
            {i.foundLocation && ` at ${i.foundLocation}`}
          </p>
        )}
        {i.note && <p className="mt-1 text-xs text-neutral-600">{i.note}</p>}
        {i.verifiedAt && (
          <p className="mt-0.5 text-xs text-neutral-500">
            {i.verifiedBy ? `By ${i.verifiedBy}, ` : ""}
            {stampOf(i.verifiedAt)}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <MetaChip meta={verifyResult(i.result)} />
        {onRecord && (
          <Button size="sm" onClick={onRecord}>
            {i.result === "pending" ? "Record" : "Change"}
          </Button>
        )}
      </div>
    </li>
  );
}

function RecordDialog({ campaignId, item, onDone, onClose }: { campaignId: string; item: VerificationItem; onDone: () => void; onClose: () => void }) {
  const uid = useId();
  const { staff } = usePickerOptions();
  const expectedId = item.asset?.custodianId ?? "";
  const [found, setFound] = useState<"yes" | "no">("yes");
  const [custodianId, setCustodianId] = useState(expectedId);
  const [location, setLocation] = useState(item.expectedLocation ?? "");
  const [cond, setCond] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <DialogFrame
      as="form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await verifications.record(
            campaignId,
            item.id,
            found === "no"
              ? { found: false, note: note.trim() || null }
              : {
                  found: true,
                  // Only send who has it when it is somebody other than the register expects.
                  ...(custodianId !== expectedId ? { foundCustodianId: custodianId || null } : {}),
                  foundLocation: location.trim() || null,
                  condition: (cond || null) as AssetCondition | null,
                  note: note.trim() || null,
                },
          );
          onDone();
        } catch (err) {
          setError(opsError(err));
          setBusy(false);
        }
      }}
      titleId={`${uid}-title`}
      title="Record what was found"
      subtitle={`${item.asset?.tagNo ?? ""} ${item.asset?.name ?? ""}`.trim()}
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant={found === "no" ? "danger" : "primary"} disabled={busy}>
            {busy ? "Saving…" : found === "no" ? "Record as missing" : "Record as found"}
          </Button>
        </div>
      }
    >
      <p className="rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
        The register expects it with <strong>{item.expectedCustodian ?? "nobody"}</strong>
        {item.expectedLocation ? (
          <>
            {" "}
            at <strong>{item.expectedLocation}</strong>
          </>
        ) : null}
        .
      </p>
      <Segmented
        label="Was it found?"
        value={found}
        onChange={setFound}
        options={[
          { key: "yes", label: "Found it" },
          { key: "no", label: "Not found" },
        ]}
      />
      {found === "yes" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={`${uid}-who`} label="Who has it">
              <SearchableSelect
                id={`${uid}-who`}
                value={custodianId}
                onChange={setCustodianId}
                options={staff ?? []}
                clearable
                clearLabel="Nobody (in a place)"
                placeholder={staff === null ? "Loading staff…" : "Nobody (in a place)"}
                searchPlaceholder="Search staff"
              />
            </Field>
            <Field id={`${uid}-loc`} label="Where" hint="Optional">
              <input id={`${uid}-loc`} className={inputClass} value={location} maxLength={255} onChange={(e) => setLocation(e.target.value)} />
            </Field>
          </div>
          <Field id={`${uid}-cond`} label="Condition" hint="Optional">
            <SearchableSelect
              id={`${uid}-cond`}
              value={cond}
              onChange={setCond}
              clearable
              clearLabel="Not checked"
              placeholder="Not checked"
              searchPlaceholder="Search conditions"
              options={CONDITION_ORDER.map((c) => ({ value: c, label: CONDITION[c].label }))}
            />
          </Field>
          <p className="text-xs text-neutral-500">If it is with somebody or somewhere the register does not expect, it is recorded as found elsewhere, for investigation.</p>
        </>
      )}
      <Field id={`${uid}-note`} label="Note" hint="Optional">
        <textarea id={`${uid}-note`} rows={2} className={textareaClass} value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} placeholder={found === "no" ? "Searched the office and store; custodian on leave" : ""} />
      </Field>
      {error && <ErrorNote>{error}</ErrorNote>}
    </DialogFrame>
  );
}
