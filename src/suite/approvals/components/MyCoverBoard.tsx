"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { CalendarRange, Check, UserCheck, UserRoundPlus } from "lucide-react";
import { Button, Chip, Empty, PageHeader, Panel, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { BackLink, ErrorNote, Field, Skeleton, hintClass, inputClass, textareaClass } from "@/suite/lms/components/ui/ws";
import type { Hue } from "@/components/workspace/modules";
import { ApiError, approvals, formatMoney, type Delegation, type ProcessInfo } from "@/lib/api/approvals-client";
import { formatDateTime, nairaToKobo } from "../lib/labels";
import { ColleaguePicker } from "./ColleaguePicker";

/*
  My cover: who decides for me while I am away, and whom I decide for.

  Cover is for a window of time, optionally only some processes and only up
  to an amount. Requests that reach me in that window go to my cover, who
  decides "for" me — and the trail says so. Ending cover early is immediate.
*/

const STATUS: Record<Delegation["status"], { label: string; hue: Hue }> = {
  running: { label: "Running now", hue: "mint" },
  scheduled: { label: "Scheduled", hue: "sky" },
  ended: { label: "Ended", hue: "slate" },
  revoked: { label: "Ended early", hue: "slate" },
};

interface Form {
  delegateId: string;
  startsAt: string;
  endsAt: string;
  processes: string[];
  cap: string;
  reason: string;
}

function localInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function blank(): Form {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start.getTime() + 7 * 86_400_000);
  return { delegateId: "", startsAt: localInput(start), endsAt: localInput(end), processes: [], cap: "", reason: "" };
}

export function validateCover(f: Form): Record<string, string> {
  const out: Record<string, string> = {};
  if (!f.delegateId) out.delegateId = "Choose who covers for you.";
  if (!f.startsAt) out.startsAt = "Choose when cover starts.";
  if (!f.endsAt) out.endsAt = "Choose when cover ends.";
  if (f.startsAt && f.endsAt && new Date(f.endsAt) <= new Date(f.startsAt)) out.endsAt = "End after it starts.";
  const cap = nairaToKobo(f.cap);
  if (cap !== null && Number.isNaN(cap)) out.maxAmount = "Enter a cap in naira, or leave it blank.";
  return out;
}

export default function MyCoverBoard() {
  const confirm = useConfirm();
  const uid = useId();

  const [rows, setRows] = useState<Delegation[] | null>(null);
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [form, setForm] = useState<Form>(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    approvals.delegations
      .list()
      .then((r) => {
        if (!alive) return;
        setRows(r);
        setLoadError(null);
      })
      .catch(() => alive && setLoadError("Your cover didn't load. Try again."));
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  useEffect(() => {
    let alive = true;
    approvals
      .processes()
      .then((p) => alive && setProcesses(p.filter((x) => x.enabled)))
      .catch(() => {
        /* cover then applies to everything, which is the default anyway */
      });
    return () => {
      alive = false;
    };
  }, []);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fe = validateCover(form);
    setErrors(fe);
    setNotice(null);
    setError(null);
    if (Object.keys(fe).length) return;
    setBusy("create");
    try {
      const made = await approvals.delegations.create({
        delegateId: form.delegateId,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
        processes: form.processes.length ? form.processes : null,
        maxAmount: nairaToKobo(form.cap),
        reason: form.reason.trim() || null,
      });
      setNotice(`${made.delegate?.name ?? "Your colleague"} covers for you from ${formatDateTime(made.startsAt)} to ${formatDateTime(made.endsAt)}.`);
      setForm(blank());
      setReloadKey((k) => k + 1);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(err.errors ?? {})) out[k] = v[0];
        setErrors(out);
        if (Object.keys(out).length === 0) setError(err.message);
      } else {
        setError("Cover wasn't set. Try again.");
      }
    } finally {
      setBusy(null);
    }
  };

  const end = async (d: Delegation) => {
    const who = d.mine ? d.delegate?.name : d.delegator?.name;
    const ok = await confirm({
      title: d.mine ? `Stop ${who ?? "your colleague"} covering for you?` : `Stop covering for ${who ?? "this colleague"}?`,
      body: "It ends now. Requests already with the cover stay with them; new ones go to the usual approver.",
      confirmLabel: "End cover",
    });
    if (!ok) return;
    setBusy(d.id);
    setError(null);
    try {
      await approvals.delegations.revoke(d.id);
      setNotice("Cover ended.");
      setReloadKey((k) => k + 1);
    } catch {
      setError("Cover wasn't ended. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const processName = (code: string) => processes.find((p) => p.code === code)?.name ?? code;

  const columns: Column<Delegation>[] = useMemo(
    () => [
      {
        key: "who",
        header: "Cover",
        primary: true,
        sortable: true,
        value: (d) => (d.mine ? d.delegate?.name : d.delegator?.name) ?? "",
        render: (d) => (
          <span className="block">
            <span className="block font-semibold text-neutral-900">
              {d.mine ? `${d.delegate?.name ?? "Someone"} covers for you` : `You cover for ${d.delegator?.name ?? "someone"}`}
            </span>
            {d.reason && <span className="block text-xs text-neutral-500">{d.reason}</span>}
          </span>
        ),
      },
      {
        key: "when",
        header: "When",
        sortable: true,
        value: (d) => d.startsAt,
        render: (d) => (
          <span className="tabular-nums">
            {formatDateTime(d.startsAt)} – {formatDateTime(d.endsAt)}
          </span>
        ),
      },
      {
        key: "scope",
        header: "Covers",
        value: (d) => (d.processes?.length ? d.processes.map(processName).join(", ") : "Everything"),
        render: (d) => (
          <span className="text-sm">
            {d.processes?.length ? d.processes.map(processName).join(", ") : "Every process"}
            {d.maxAmount != null && <span className="block text-xs text-neutral-500">Up to {formatMoney(d.maxAmount)}</span>}
          </span>
        ),
      },
      {
        key: "status",
        header: "Status",
        sortable: true,
        value: (d) => STATUS[d.status].label,
        render: (d) => (
          <Chip hue={STATUS[d.status].hue} dot>
            {STATUS[d.status].label}
          </Chip>
        ),
      },
      {
        key: "actions",
        header: "",
        align: "right",
        tableOnly: false,
        render: (d) =>
          d.status === "running" || d.status === "scheduled" ? (
            <Button size="sm" onClick={() => void end(d)} disabled={busy !== null}>
              End cover
            </Button>
          ) : null,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [processes, busy],
  );

  return (
    <div>
      <BackLink href="/suite/approvals" label="All approvals" />
      <PageHeader title="My cover" subtitle="Choose who decides for you while you are away, and see whom you are covering for." />

      {error && <ErrorNote className="mb-4">{error}</ErrorNote>}
      {notice && !error && (
        <p role="status" className="mb-4 rounded-xl border border-mint-100 bg-mint-50 px-4 py-3 text-sm font-medium text-mint-700">
          {notice}
        </p>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0">
          {loadError ? (
            <ErrorNote>{loadError}</ErrorNote>
          ) : rows === null ? (
            <Skeleton className="h-56" />
          ) : (
            <DataView
              rows={rows}
              columns={columns}
              rowKey={(d) => d.id}
              storageKey="approvals-cover"
              views={["table", "list"]}
              searchable={rows.length > 6}
              caption="Cover you have set and cover you give"
              empty={
                <Empty
                  icon={UserCheck}
                  title="No cover set"
                  hint="Going on leave? Set a colleague to decide your approvals while you're away, using the form beside this list."
                />
              }
            />
          )}
        </div>

        <Panel title="Set cover" icon={UserRoundPlus} hue="grape" subtitle="Your approvals go to them for these dates.">
          <form onSubmit={submit} noValidate className="space-y-4">
            <Field id={`${uid}-who`} label="Who covers for you">
              <ColleaguePicker id={`${uid}-who`} value={form.delegateId} onChange={(v) => set("delegateId", v)} invalid={Boolean(errors.delegateId)} />
              {errors.delegateId && <p className={cx(hintClass, "text-error-700")}>{errors.delegateId}</p>}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <Field id={`${uid}-from`} label="From">
                <input id={`${uid}-from`} type="datetime-local" className={inputClass} value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} aria-invalid={Boolean(errors.startsAt)} />
                {errors.startsAt && <p className={cx(hintClass, "text-error-700")}>{errors.startsAt}</p>}
              </Field>
              <Field id={`${uid}-to`} label="Until">
                <input id={`${uid}-to`} type="datetime-local" className={inputClass} value={form.endsAt} onChange={(e) => set("endsAt", e.target.value)} aria-invalid={Boolean(errors.endsAt)} />
                {errors.endsAt && <p className={cx(hintClass, "text-error-700")}>{errors.endsAt}</p>}
              </Field>
            </div>

            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-neutral-700">Which requests</legend>
              <p className="mb-2 text-xs text-neutral-500">Leave all unticked to cover everything.</p>
              {processes.length === 0 ? (
                <p className="text-sm text-neutral-500">Every process.</p>
              ) : (
                <ul className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-neutral-200 p-2">
                  {processes.map((p) => {
                    const on = form.processes.includes(p.code);
                    return (
                      <li key={p.code}>
                        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm text-neutral-800 hover:bg-neutral-50">
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => set("processes", on ? form.processes.filter((c) => c !== p.code) : [...form.processes, p.code])}
                            className="h-4 w-4 accent-primary-600"
                          />
                          <span className="min-w-0 flex-1">{p.name}</span>
                          {on && <Check size={14} className="text-primary-600" aria-hidden />}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
              {errors.processes && <p className={cx(hintClass, "text-error-700")}>{errors.processes}</p>}
            </fieldset>

            <Field id={`${uid}-cap`} label="Up to (₦)" hint="Optional">
              <input id={`${uid}-cap`} inputMode="decimal" className={inputClass} value={form.cap} onChange={(e) => set("cap", e.target.value)} aria-invalid={Boolean(errors.maxAmount)} />
              <p className={cx(hintClass, errors.maxAmount && "text-error-700")}>{errors.maxAmount ?? "Anything above stays with you."}</p>
            </Field>
            <Field id={`${uid}-reason`} label="Reason" hint="Optional">
              <textarea id={`${uid}-reason`} rows={2} className={textareaClass} value={form.reason} onChange={(e) => set("reason", e.target.value)} placeholder="Annual leave" />
            </Field>
            <Button type="submit" variant="primary" icon={CalendarRange} disabled={busy !== null} className="w-full">
              {busy === "create" ? "Setting cover…" : "Set cover"}
            </Button>
          </form>
        </Panel>
      </div>
    </div>
  );
}
