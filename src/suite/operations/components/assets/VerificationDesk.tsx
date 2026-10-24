"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarRange, Plus, ScanLine } from "lucide-react";
import { Button, Card, Chip, Empty, PageHeader } from "@/components/workspace/kit";
import { todayYmd } from "@/components/workspace/Calendar";
import { hueHex } from "@/components/workspace/charts";
import { ErrorNote, Field, IconTile, Skeleton, inputClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { FieldError, LoadError } from "@/suite/org/components/foundations/shared";
import { useAuth } from "@/lib/auth-store";
import { mayDoOps } from "@/suite/operations/lib/operations-access";
import { opsError, opsFieldErrors, verifications, type VerificationCampaign, type VerificationSummary } from "@/lib/api/operations-assets-client";
import { dateSpan } from "@/suite/operations/components/travel/labels";
import { VERIFY_RESULT, daysFrom, plural } from "./labels";

/**
 * Verification campaigns: count everything on the register against what is
 * actually found. Custodians confirm what they hold from My assets; the
 * desk checks the rest.
 */

const ORDER = ["verified", "mismatch", "missing", "pending"] as const;

/** One bar of a campaign's results: verified, found elsewhere, missing, not yet seen. */
export function ResultBar({ summary }: { summary: VerificationSummary }) {
  const total = Math.max(1, summary.total);
  return (
    <div>
      <div
        className="flex h-2.5 gap-0.5 overflow-hidden rounded-full"
        role="img"
        aria-label={ORDER.map((k) => `${VERIFY_RESULT[k].label}: ${summary[k]}`).join(", ")}
      >
        {ORDER.filter((k) => k !== "pending" && summary[k] > 0).map((k) => (
          <span key={k} className="h-full" style={{ width: `${(summary[k] / total) * 100}%`, background: hueHex(VERIFY_RESULT[k].hue) }} />
        ))}
        <span className="ws-hatch h-full flex-1" />
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-600">
        {ORDER.map((k) => (
          <li key={k}>
            {VERIFY_RESULT[k].label} <span className="font-semibold tabular-nums text-neutral-900">{summary[k]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function VerificationDesk() {
  const router = useRouter();
  const { user } = useAuth();
  const [rows, setRows] = useState<VerificationCampaign[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    let alive = true;
    verifications.list().then(
      (r) => {
        if (!alive) return;
        setRows(r);
        setError(null);
      },
      (e: unknown) => alive && setError(`Verifications didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  if (error && !rows) return <LoadError text={error} onRetry={() => setReload((k) => k + 1)} />;
  if (!rows) {
    return (
      <div aria-busy="true" className="space-y-6">
        <p className="sr-only">Loading verifications…</p>
        <Skeleton className="h-20" />
        <Skeleton className="h-[240px]" />
      </div>
    );
  }

  const open = rows.find((c) => c.status === "open");
  const canOpen = mayDoOps(user, "asset_verification", "create") && !open;
  const today = todayYmd();

  return (
    <div>
      <PageHeader
        title="Asset verification"
        subtitle="Check the register against what is really there. Staff confirm what they hold from My assets; you check the rest."
        actions={
          canOpen ? (
            <Button variant="primary" icon={Plus} onClick={() => setOpening(true)}>
              Start a verification
            </Button>
          ) : undefined
        }
      />

      {rows.length === 0 ? (
        <Card>
          <Empty
            icon={ScanLine}
            title="No verification yet"
            hint="Start one to list every tagged asset with who should have it and where. Run one at least once a year and before the auditors arrive."
          />
        </Card>
      ) : (
        <ul className="grid gap-6 md:grid-cols-2">
          {rows.map((c) => {
            const left = c.status === "open" ? daysFrom(today, c.endsOn) : null;
            return (
              <li key={c.id}>
                <Link href={`/suite/operations/assets/verification/${c.id}`} className="block rounded-[1.25rem] outline-none focus-visible:ring-2 focus-visible:ring-primary-300">
                  <Card as="div" className="flex h-full flex-col gap-4 p-5 transition-shadow hover:shadow-md">
                    <div className="flex items-start justify-between gap-3">
                      <IconTile icon={ScanLine} hue={c.status === "open" ? "sky" : "slate"} size={40} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold text-neutral-900">{c.name}</p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-500">
                          <CalendarRange size={13} aria-hidden />
                          {dateSpan(c.startsOn, c.endsOn)}
                        </p>
                      </div>
                      {c.status === "open" ? (
                        <Chip hue={left !== null && left < 0 ? "rose" : "sky"} dot>
                          {left === null ? "Open" : left < 0 ? "Past its end date" : left === 0 ? "Ends today" : `${plural(left, "day")} left`}
                        </Chip>
                      ) : (
                        <Chip hue="slate">Closed</Chip>
                      )}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-[28px] font-bold leading-none tracking-tight tabular-nums text-neutral-900">{Math.round(c.summary.percent)}%</span>
                      <span className="text-sm text-neutral-500">seen of {plural(c.summary.total, "asset")}</span>
                    </div>
                    <ResultBar summary={c.summary} />
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {opening && (
        <OpenDialog
          onClose={() => setOpening(false)}
          onDone={(c) => {
            setOpening(false);
            router.push(`/suite/operations/assets/verification/${c.id}`);
          }}
        />
      )}
    </div>
  );
}

function OpenDialog({ onDone, onClose }: { onDone: (c: VerificationCampaign) => void; onClose: () => void }) {
  const uid = useId();
  const today = todayYmd();
  const [name, setName] = useState(`Asset verification ${today.slice(0, 4)}`);
  const [startsOn, setStartsOn] = useState(today);
  const [endsOn, setEndsOn] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <DialogFrame
      as="form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!endsOn) {
          setErrors({ endsOn: "Say when it ends." });
          return;
        }
        setBusy(true);
        setErrors({});
        setError(null);
        try {
          onDone(await verifications.open({ name: name.trim(), startsOn, endsOn }));
        } catch (err) {
          setErrors(opsFieldErrors(err));
          setError(opsError(err));
          setBusy(false);
        }
      }}
      titleId={`${uid}-title`}
      title="Start a verification"
      subtitle="Every tagged asset not lost, stolen or disposed of is listed with who should have it and where."
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Starting…" : "Start the verification"}
          </Button>
        </div>
      }
    >
      <Field id={`${uid}-name`} label="Name">
        <input id={`${uid}-name`} className={inputClass} value={name} maxLength={160} onChange={(e) => setName(e.target.value)} />
        <FieldError message={errors.name} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${uid}-start`} label="Starts">
          <input id={`${uid}-start`} type="date" className={inputClass} value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
          <FieldError message={errors.startsOn} />
        </Field>
        <Field id={`${uid}-end`} label="Ends">
          <input id={`${uid}-end`} type="date" className={inputClass} value={endsOn} min={startsOn} onChange={(e) => setEndsOn(e.target.value)} aria-invalid={errors.endsOn ? true : undefined} />
          <FieldError message={errors.endsOn} />
        </Field>
      </div>
      <p className="text-sm text-neutral-600">Staff see a banner in My assets asking them to confirm what they hold until it closes.</p>
      {error && !errors.endsOn && <ErrorNote>{error}</ErrorNote>}
    </DialogFrame>
  );
}
