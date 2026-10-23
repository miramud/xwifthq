"use client";

import { useEffect, useId, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { ApiError, orgFoundations, type StepUpSetting } from "@/lib/api/org-foundations-client";
import { formatMoney } from "@/lib/api/approvals-client";
import { Button, Panel, Progress, cx } from "@/components/workspace/kit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { ErrorNote, Skeleton, inputClass } from "@/suite/lms/components/ui/ws";
import { koboToNaira, nairaToKobo } from "./policy-logic";

/*
  Organisation › Approvals › the step-up amount. At or above it, whoever
  approves a request - or a payment schedule - types the code from their
  authenticator app. Off by default. Shows how ready the organisation is:
  of the people who could be asked, how many have an app set up.
*/

export default function StepUpPanel() {
  const confirm = useConfirm();
  const fieldId = useId();
  const hintId = useId();
  const [setting, setSetting] = useState<StepUpSetting | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    orgFoundations.approvals
      .stepUp()
      .then((s) => {
        if (!alive) return;
        setSetting(s);
        setText(koboToNaira(s.amount));
      })
      .catch((e: unknown) => alive && setLoadError(e instanceof ApiError ? e.message : "The verification setting didn't load."));
    return () => {
      alive = false;
    };
  }, []);

  if (loadError) return <ErrorNote className="mb-5">{loadError}</ErrorNote>;
  if (!setting) return <Skeleton className="mb-5 h-40" />;

  const minor = nairaToKobo(text);
  const bad = text.trim() !== "" && (minor === null || minor <= 0);
  const on = setting.amount !== null;
  const changed = minor !== setting.amount;
  const readiness = setting.people > 0 ? (setting.enrolled / setting.people) * 100 : 0;

  const save = async (amount: number | null) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const next = await orgFoundations.approvals.updateStepUp(amount, setting.currency);
      setSetting(next);
      setText(koboToNaira(next.amount));
      setNotice(
        next.amount === null
          ? "Turned off. Approvals no longer ask for a code."
          : `Saved. Approvals of ${formatMoney(next.amount, next.currency)} and above now need a code.`,
      );
    } catch (e) {
      setError(e instanceof ApiError ? (e.errors?.amount?.[0] ?? e.errors?.currency?.[0] ?? e.message) : "The setting wasn't saved.");
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    const ok = await confirm({
      title: "Stop asking for a code?",
      body: "Large approvals and payment schedules will go through on a click again. Requests already waiting stop needing a code too.",
      confirmLabel: "Turn off",
    });
    if (ok) void save(null);
  };

  return (
    <Panel
      className="mb-5"
      icon={ShieldCheck}
      hue="blue"
      title="Authenticator code for large approvals"
      subtitle="Whoever approves at or above this amount - a request or a payment schedule - types the code from their authenticator app."
    >
      <p role="status" aria-live="polite" className="sr-only">
        {notice ?? ""}
      </p>
      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,22rem)]">
        <form
          className="min-w-0"
          onSubmit={(e) => {
            e.preventDefault();
            if (!bad && minor !== null && changed && !busy) void save(minor);
          }}
        >
          <label htmlFor={fieldId} className="mb-1.5 block text-sm font-medium text-neutral-700">
            Ask for a code from
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative sm:w-72">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-neutral-500" aria-hidden>
                {setting.currency}
              </span>
              <input
                id={fieldId}
                inputMode="decimal"
                value={text}
                placeholder="Off"
                onChange={(e) => setText(e.target.value)}
                onBlur={() => minor !== null && setText(koboToNaira(minor))}
                aria-invalid={bad || undefined}
                aria-describedby={hintId}
                className={cx(inputClass, "pl-12 tabular-nums")}
              />
            </div>
            <Button type="submit" variant="primary" disabled={busy || bad || minor === null || !changed}>
              {busy ? "Saving…" : on ? "Save amount" : "Turn on"}
            </Button>
            {on && (
              <Button variant="ghost" onClick={() => void turnOff()} disabled={busy}>
                Turn off
              </Button>
            )}
          </div>
          <p id={hintId} className={cx("mt-1.5 text-xs", bad ? "text-error-700" : "text-neutral-500")}>
            {bad
              ? "Type an amount, like 5,000,000."
              : on
                ? `On: approvals of ${formatMoney(setting.amount, setting.currency)} and above need a code. Other currencies are converted at your recorded rate; with no rate, the code is asked for.`
                : "Off: nobody is asked for a code. Signing in is never affected."}
          </p>
          {error && <ErrorNote className="mt-3">{error}</ErrorNote>}
          {notice && <p className="mt-3 rounded-xl border border-mint-500/25 bg-mint-50 px-3 py-2 text-sm text-mint-700">{notice}</p>}
        </form>

        <div className="rounded-2xl bg-neutral-50 p-4">
          <p className="text-sm font-semibold text-neutral-900">
            <span className="tabular-nums">{setting.enrolled}</span> of <span className="tabular-nums">{setting.people}</span> people have an authenticator app
          </p>
          <div className="mt-3">
            <Progress value={readiness} hue="mint" label="People with an authenticator app" size="sm" />
          </div>
          <p className="mt-3 text-xs text-neutral-600">
            Each person sets theirs up under My account › Security. Somebody without one is told how when a code is first asked of them.
          </p>
          {setting.waiting > 0 && (
            <p className="mt-2 text-xs font-medium text-neutral-700">
              <span className="tabular-nums">{setting.waiting}</span> open {setting.waiting === 1 ? "task needs" : "tasks need"} a code now.
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}
