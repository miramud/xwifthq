"use client";

import { useEffect, useId, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button, cx } from "@/components/workspace/kit";
import { ErrorNote, Skeleton, Switch, inputClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { clientPayments, opsError } from "@/lib/api/operations-travel-client";

/**
 * A client's own document checklist: what every payment pack for them must
 * hold, and which items are mandatory. It applies to requests prepared from
 * now on; a request already started keeps the list it was given.
 */

let rowKey = 0;

interface Row {
  key: number;
  label: string;
  mandatory: boolean;
}

export default function ChecklistEditor({ clientId, client, onClose, onSaved }: { clientId: string; client: string; onClose: () => void; onSaved?: () => void }) {
  const uid = useId();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [own, setOwn] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    clientPayments.checklist(clientId).then(
      (list) => {
        if (!alive) return;
        setRows(list.map((r) => ({ key: ++rowKey, label: r.label, mandatory: r.mandatory })));
        setOwn(list.some((r) => r.own));
      },
      (e: unknown) => alive && setLoadError(`The checklist didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [clientId]);

  const patch = (key: number, p: Partial<Row>) => setRows((rs) => (rs ?? []).map((r) => (r.key === key ? { ...r, ...p } : r)));
  const move = (i: number, by: -1 | 1) =>
    setRows((rs) => {
      const list = [...(rs ?? [])];
      const j = i + by;
      if (j < 0 || j >= list.length) return list;
      [list[i], list[j]] = [list[j], list[i]];
      return list;
    });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const items = (rows ?? []).map((r) => ({ label: r.label.trim(), mandatory: r.mandatory })).filter((r) => r.label !== "");
    if (items.length === 0) {
      setError("Keep at least one document on the list.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await clientPayments.saveChecklist(clientId, items);
      onSaved?.();
      onClose();
    } catch (err) {
      setError(opsError(err));
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={save}
      size="lg"
      titleId={`${uid}-title`}
      title={`${client}'s document checklist`}
      subtitle="Every payment pack for this client must hold these. Requests prepared from now on use this list; ones already started keep theirs."
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy || rows === null}>
            {busy ? "Saving…" : "Save the checklist"}
          </Button>
        </div>
      }
    >
      {loadError && <ErrorNote>{loadError}</ErrorNote>}
      {rows === null && !loadError && <Skeleton className="h-48" />}
      {rows !== null && (
        <>
          {!own && <p className="rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-700">This client uses the organisation&apos;s default list. Saving makes it the client&apos;s own.</p>}
          <ol className="space-y-2">
            {rows.map((r, i) => (
              <li key={r.key} className="flex flex-wrap items-center gap-2 rounded-2xl border border-neutral-100 bg-white p-3 sm:flex-nowrap">
                <label htmlFor={`${uid}-${r.key}`} className="sr-only">
                  Document {i + 1}
                </label>
                <input id={`${uid}-${r.key}`} className={cx(inputClass, "min-w-0 flex-1 basis-full sm:basis-auto")} value={r.label} maxLength={160} onChange={(e) => patch(r.key, { label: e.target.value })} placeholder="Certificate of completion" />
                <span className="flex items-center gap-2 text-xs font-medium text-neutral-600">
                  <Switch checked={r.mandatory} onChange={(v) => patch(r.key, { mandatory: v })} label={`${r.label || `Document ${i + 1}`} is mandatory`} />
                  {r.mandatory ? "Mandatory" : "Optional"}
                </span>
                <span className="ml-auto flex items-center">
                  <IconButton label={`Move ${r.label || `document ${i + 1}`} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp size={15} aria-hidden />
                  </IconButton>
                  <IconButton label={`Move ${r.label || `document ${i + 1}`} down`} disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown size={15} aria-hidden />
                  </IconButton>
                  <IconButton label={`Remove ${r.label || `document ${i + 1}`}`} danger onClick={() => setRows(rows.filter((x) => x.key !== r.key))}>
                    <Trash2 size={15} aria-hidden />
                  </IconButton>
                </span>
              </li>
            ))}
          </ol>
          <Button size="sm" variant="ghost" icon={Plus} onClick={() => setRows([...rows, { key: ++rowKey, label: "", mandatory: true }])}>
            Add a document
          </Button>
          {error && <ErrorNote>{error}</ErrorNote>}
        </>
      )}
    </DialogFrame>
  );
}

function IconButton({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cx(
        "flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-neutral-500 outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-40",
        danger ? "hover:bg-error-500/10 hover:text-error-700 focus-visible:ring-error-400" : "hover:bg-primary-50 hover:text-primary-700 focus-visible:ring-primary-300",
      )}
    >
      {children}
    </button>
  );
}
