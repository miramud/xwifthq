"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { ArchiveRestore, BadgeCheck, CheckCircle2, CircleDollarSign, Hourglass, Info, ListChecks, PenLine, XCircle } from "lucide-react";
import { Button, Card, Chip, PageHeader, Panel, PersonAvatar, Progress, cx } from "@/components/workspace/kit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { BackLink, ErrorNote, Field, IconTile, Skeleton, textareaClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { FieldError, LoadError } from "@/suite/org/components/foundations/shared";
import { Money } from "@/suite/finance/components/banking/ui";
import { day } from "@/suite/finance/lib/format";
import { MoneyInput } from "@/suite/operations/components/travel/shared";
import { useAuth } from "@/lib/auth-store";
import { mayDoOps } from "@/suite/operations/lib/operations-access";
import { ApiError, exitClearances, opsError, opsFieldErrors, type AssetCondition, type ExitClearance, type ExitClearanceItem, type ExitDecision, type ExitSignoff } from "@/lib/api/operations-assets-client";
import { CONDITION, CONDITION_ORDER, exitItem, plural, stampOf } from "./labels";
import { MetaChip } from "./parts";

/**
 * One leaver's exit clearance: settle each asset they hold (returned,
 * deducted from final pay or written off) and collect the four
 * sign-offs. It clears itself when nothing is outstanding and all four
 * have signed.
 */
export default function ExitClearanceDetail({ id }: { id: string }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [c, setC] = useState<ExitClearance | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [deciding, setDeciding] = useState<{ item: ExitClearanceItem; status: ExitDecision["status"] } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [signing, setSigning] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    exitClearances.get(id).then(
      (x) => {
        if (!alive) return;
        setC(x);
        setLoadError(null);
      },
      (e: unknown) => alive && setLoadError(e instanceof ApiError && e.status === 404 ? "This clearance wasn't found." : `This clearance didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [id, reload]);

  const refresh = useCallback(() => setReload((k) => k + 1), []);

  if (loadError && !c) {
    return (
      <div>
        <BackLink href="/suite/operations/assets/exit-clearances" label="Exit clearances" />
        <LoadError text={loadError} onRetry={refresh} />
      </div>
    );
  }
  if (!c) {
    return (
      <div aria-busy="true" className="space-y-6">
        <p className="sr-only">Loading the clearance…</p>
        <Skeleton className="h-20" />
        <Skeleton className="h-[320px]" />
      </div>
    );
  }

  const isOpen = c.status === "open";
  const canDecide = isOpen && mayDoOps(user, "exit_clearances", "decide");
  const canSign = isOpen && mayDoOps(user, "exit_clearances", "sign_off") && user?.id !== c.userId;
  const settled = c.items.length - c.outstanding;
  const deductions = c.items.filter((i) => i.status === "deduct").reduce((s, i) => s + (i.value ?? 0), 0);

  const sign = async (s: ExitSignoff) => {
    const ok = await confirm({
      title: `Sign off for ${s.label}?`,
      body: `You confirm ${c.leaver ?? "the leaver"} owes ${s.label === "Head of unit" ? "their unit" : s.label} nothing more. Your name and the time are recorded.`,
      confirmLabel: `Sign for ${s.label}`,
      tone: "primary",
    });
    if (!ok) return;
    setSigning(s.key);
    setActionError(null);
    try {
      setC(await exitClearances.sign(c.id, s.key));
    } catch (e) {
      setActionError(opsError(e));
    } finally {
      setSigning(null);
    }
  };

  return (
    <div>
      <BackLink href="/suite/operations/assets/exit-clearances" label="Exit clearances" />
      <PageHeader
        eyebrow={c.leavingOn ? `Leaving ${day(c.leavingOn)}` : "Leaving date not set"}
        title={
          <span className="flex items-center gap-3">
            <PersonAvatar name={c.leaver} size={40} />
            {c.leaver ?? "Leaver"}
          </span>
        }
        subtitle={
          <span className="mt-1 inline-flex">
            {isOpen ? (
              <Chip hue="sun" icon={Hourglass}>
                Open
              </Chip>
            ) : (
              <Chip hue="mint" icon={BadgeCheck}>
                Cleared {stampOf(c.clearedAt)}
              </Chip>
            )}
          </span>
        }
      />

      <div className={cx("mb-6 flex items-start gap-3 rounded-2xl px-5 py-4 text-sm", c.outstanding > 0 ? "bg-sun-50 text-sun-700" : "bg-mint-50 text-mint-700")} role="status">
        <Info size={18} className="mt-0.5 shrink-0" aria-hidden />
        <p>
          {c.outstanding > 0 ? (
            <>
              <strong>Final pay is on hold.</strong> HR can&rsquo;t settle {c.leaver ?? "the leaver"}&rsquo;s final pay while {plural(c.outstanding, "item is", "items are")} outstanding. Settle each one below: returned, deducted or written off.
            </>
          ) : (
            <>
              <strong>Nothing is outstanding.</strong> HR can settle final pay{deductions > 0 ? <>, deducting <Money value={deductions} /></> : ""}. The clearance closes once all four have signed.
            </>
          )}
        </p>
      </div>

      {actionError && <ErrorNote className="mb-4">{actionError}</ErrorNote>}

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="What they hold" subtitle={`${settled} of ${plural(c.items.length, "item")} settled`} icon={ListChecks} hue="sky" className="xl:col-span-2">
          {c.items.length > 0 && (
            <div className="mb-4">
              <Progress value={c.items.length ? (settled / c.items.length) * 100 : 100} hue="mint" label="Items settled" />
            </div>
          )}
          {c.items.length === 0 ? (
            <p className="py-6 text-center text-sm text-neutral-500">They held no assets when the clearance opened.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {c.items.map((i) => (
                <li key={i.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-semibold text-neutral-900">{i.description}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                      <MetaChip meta={exitItem(i.status)} />
                      {i.value !== null && (
                        <span>
                          {i.status === "deduct" ? "Deduct" : "Valued at"} <Money value={i.value} className="font-semibold text-neutral-700" />
                        </span>
                      )}
                      {i.decidedBy && <span>by {i.decidedBy}</span>}
                    </p>
                    {i.note && <p className="mt-1 text-xs text-neutral-600">{i.note}</p>}
                  </div>
                  {canDecide && i.status === "outstanding" && (
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button size="sm" variant="primary" icon={ArchiveRestore} onClick={() => setDeciding({ item: i, status: "returned" })}>
                        Returned
                      </Button>
                      <Button size="sm" icon={CircleDollarSign} onClick={() => setDeciding({ item: i, status: "deduct" })}>
                        Deduct
                      </Button>
                      <Button size="sm" icon={XCircle} onClick={() => setDeciding({ item: i, status: "write_off" })}>
                        Write off
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Sign-offs" subtitle="It clears when all four sign and nothing is outstanding" icon={PenLine} hue="grape">
          <ul className="space-y-3">
            {c.signoffs.map((s) => (
              <li key={s.key}>
                <Card as="div" className={cx("flex items-center justify-between gap-3 !rounded-2xl p-3.5", s.at && "!border-mint-500/30 bg-mint-50/40")}>
                  <div className="flex min-w-0 items-center gap-3">
                    {s.at ? <IconTile icon={CheckCircle2} hue="mint" /> : <IconTile icon={Hourglass} hue="slate" />}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-neutral-900">{s.label}</p>
                      <p className="truncate text-xs text-neutral-500">{s.at ? `${s.name ?? "Signed"} · ${stampOf(s.at)}` : "Not signed"}</p>
                    </div>
                  </div>
                  {!s.at && canSign && (
                    <Button size="sm" disabled={signing !== null} onClick={() => void sign(s)} aria-label={`Sign off for ${s.label}`}>
                      {signing === s.key ? "Signing…" : "Sign"}
                    </Button>
                  )}
                </Card>
              </li>
            ))}
          </ul>
          {isOpen && user?.id === c.userId && <p className="mt-3 text-xs text-neutral-500">You can&rsquo;t sign your own clearance.</p>}
        </Panel>
      </div>

      {deciding && (
        <DecideDialog
          clearance={c}
          item={deciding.item}
          status={deciding.status}
          onClose={() => setDeciding(null)}
          onDone={(next) => {
            setC(next);
            setDeciding(null);
          }}
        />
      )}
    </div>
  );
}

const DECIDE_COPY: Record<ExitDecision["status"], { title: string; button: string; hint: string }> = {
  returned: { title: "Mark it returned", button: "Returned to store", hint: "It goes back into store with its condition checked." },
  deduct: { title: "Deduct it from final pay", button: "Deduct from final pay", hint: "HR deducts this value from their final pay. The asset is recorded as lost, for Finance to write off or recover." },
  write_off: { title: "Write it off", button: "Write it off", hint: "Nothing is deducted. The asset is recorded as lost, for Finance to write off." },
};

function DecideDialog({
  clearance,
  item,
  status,
  onDone,
  onClose,
}: {
  clearance: ExitClearance;
  item: ExitClearanceItem;
  status: ExitDecision["status"];
  onDone: (c: ExitClearance) => void;
  onClose: () => void;
}) {
  const uid = useId();
  const copy = DECIDE_COPY[status];
  const [value, setValue] = useState<number | null>(status === "deduct" ? item.value : null);
  const [note, setNote] = useState("");
  const [cond, setCond] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <DialogFrame
      as="form"
      onSubmit={async (e) => {
        e.preventDefault();
        const local: Record<string, string> = {};
        if (status === "deduct" && !(value && value > 0)) local.value = "Value what is being deducted.";
        if (status !== "returned" && !note.trim()) local.note = "Say why it is not coming back.";
        if (Object.keys(local).length) {
          setErrors(local);
          return;
        }
        setBusy(true);
        setErrors({});
        setError(null);
        try {
          onDone(
            await exitClearances.decide(clearance.id, item.id, {
              status,
              ...(status === "deduct" ? { value } : {}),
              note: note.trim() || null,
              ...(status === "returned" && cond ? { condition: cond as AssetCondition } : {}),
            }),
          );
        } catch (err) {
          setErrors(opsFieldErrors(err));
          setError(opsError(err));
          setBusy(false);
        }
      }}
      titleId={`${uid}-title`}
      title={copy.title}
      subtitle={item.description}
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant={status === "returned" ? "primary" : "danger"} disabled={busy}>
            {busy ? "Saving…" : copy.button}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-neutral-600">{copy.hint}</p>
      {status === "returned" && (
        <Field id={`${uid}-cond`} label="Condition it came back in" hint="Optional">
          <SearchableSelect
            id={`${uid}-cond`}
            value={cond}
            onChange={setCond}
            clearable
            clearLabel="As recorded"
            placeholder="As recorded"
            searchPlaceholder="Search conditions"
            options={CONDITION_ORDER.map((k) => ({ value: k, label: CONDITION[k].label }))}
          />
        </Field>
      )}
      {status === "deduct" && (
        <Field id={`${uid}-value`} label="Value to deduct (₦)" hint={item.value ? "Starts at its cost" : undefined}>
          <MoneyInput id={`${uid}-value`} value={value} onChange={setValue} invalid={Boolean(errors.value)} describedBy={errors.value ? `${uid}-value-err` : undefined} />
          <FieldError id={`${uid}-value-err`} message={errors.value} />
        </Field>
      )}
      <Field id={`${uid}-note`} label={status === "returned" ? "Note" : "Why it is not coming back"} hint={status === "returned" ? "Optional" : "Required"}>
        <textarea
          id={`${uid}-note`}
          rows={3}
          className={textareaClass}
          value={note}
          maxLength={2000}
          onChange={(e) => setNote(e.target.value)}
          aria-invalid={errors.note ? true : undefined}
          aria-describedby={errors.note ? `${uid}-note-err` : undefined}
        />
        <FieldError id={`${uid}-note-err`} message={errors.note} />
      </Field>
      {error && !errors.value && !errors.note && <ErrorNote>{error}</ErrorNote>}
    </DialogFrame>
  );
}
