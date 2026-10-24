"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Check, Download, ExternalLink, FileText, Printer, Trash2, X } from "lucide-react";
import { Chip, buttonClass, cx } from "@/components/workspace/kit";
import { HUE } from "@/components/workspace/modules";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { SearchableSelect, type SelectOption } from "@/components/workspace/SearchableSelect";
import { ErrorNote } from "@/suite/lms/components/ui/ws";
import { UploadZone, fileSize } from "@/suite/finance/components/requests/ui";
import { day } from "@/suite/finance/lib/format";
import { opsError, procurement, type AttachmentOwner, type OpsAttachment } from "@/lib/api/operations-procurement-client";
import { poStatus, prStatus, type Road } from "./meta";

/* The pieces every procurement screen shares. */

export function PrStatusChip({ status }: { status: string }) {
  const s = prStatus(status);
  return (
    <Chip hue={s.hue} icon={s.icon}>
      {s.label}
    </Chip>
  );
}

export function PoStatusChip({ status }: { status: string }) {
  const s = poStatus(status);
  return (
    <Chip hue={s.hue} icon={s.icon}>
      {s.label}
    </Chip>
  );
}

const ORIGIN_LABEL: Record<string, string> = { reorder: "Restock draft", shortfall: "Shortfall draft" };

/** Marks a request the system drafted (a restock, a requisition's shortfall) while it is still a draft. */
export function PrOriginChip({ origin, status }: { origin?: string | null; status: string }) {
  if (!origin || status !== "draft") return null;
  return (
    <Chip hue="sky" className="!px-2 !py-0.5 !text-[11px]">
      {ORIGIN_LABEL[origin] ?? "System draft"}
    </Chip>
  );
}

/** A document number in the register's type: `MPT/LPO/2026/0001`. */
export function DocNo({ value, className }: { value: string | null | undefined; className?: string }) {
  return <span className={cx("font-mono text-[12px] tracking-tight text-neutral-500", className)}>{value ?? "Not numbered yet"}</span>;
}

/**
 * A printable document (GRN, certificate, voucher, handover note, gate
 * pass) as a verifiable PDF, opened in a new tab. `name` says which one to
 * screen readers when several sit in a list.
 */
export function PdfLink({ href, label = "PDF", name, className }: { href: string; label?: string; name?: string | null; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={cx(buttonClass("secondary", "sm"), className)} aria-label={name ? `${label}: ${name}` : undefined}>
      <Printer size={15} aria-hidden />
      {label}
    </a>
  );
}

/** "Open the approval", where the approval engine is following the document. */
export function ApprovalLink({ id, label = "Open the approval" }: { id: string | null | undefined; label?: string }) {
  if (!id) return null;
  return (
    <Link
      href={`/suite/approvals/${id}`}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-lg text-[13px] font-semibold text-primary-700 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-300"
    >
      {label}
      <ExternalLink size={13} aria-hidden />
    </Link>
  );
}

/**
 * A lifecycle as a row of segments: done in mint with a tick, the current
 * step in purple (rose when the document stopped there), the rest hatched,
 * each with its word, and a word for screen readers. Wraps to two rows of
 * four on a phone.
 */
export function Lifecycle({ road, label, dates }: { road: Road; label: string; /** Per step, `YYYY-MM-DD…`; shown under the steps that are done. */ dates?: (string | null | undefined)[] }) {
  const { steps, done, stopped } = road;
  return (
    <ol aria-label={label} className={cx("grid gap-x-1.5 gap-y-3", steps.length > 5 ? "grid-cols-4 sm:grid-cols-8" : "grid-cols-5")}>
      {steps.map((s, i) => {
        const complete = i < done;
        const halted = stopped && i === done;
        const current = !stopped && i === done;
        return (
          <li key={s} className="min-w-0" aria-current={current ? "step" : undefined}>
            <span
              aria-hidden
              className={cx(
                "block h-2 rounded-full",
                complete ? "bg-mint-500" : halted ? "bg-rose-500" : current ? "bg-primary-500" : "ws-hatch",
              )}
            />
            <span className="mt-2 flex items-center gap-1 text-[12px] font-semibold">
              <span
                aria-hidden
                className={cx(
                  "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                  complete ? "bg-mint-500 text-white" : halted ? "bg-rose-500 text-white" : current ? "bg-primary-600 text-white" : "border border-dashed border-neutral-300",
                )}
              >
                {complete ? <Check size={10} strokeWidth={3} /> : halted ? <X size={10} strokeWidth={3} /> : null}
              </span>
              <span className={cx("truncate", complete || current ? "text-neutral-900" : halted ? "text-rose-700" : "text-neutral-500")}>{s}</span>
            </span>
            {complete && dates?.[i] && <span className="mt-0.5 block pl-5 text-[11px] tabular-nums text-neutral-500">{day(dates[i])}</span>}
            <span className="sr-only">{complete ? " (done)" : halted ? " (stopped here)" : current ? " (now)" : " (not yet)"}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** A label over a value, in a definition list. */
export function Fact({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cx("min-w-0", className)}>
      <dt className="text-xs font-medium text-neutral-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-neutral-900">{children}</dd>
    </div>
  );
}

/** Where a block's files go and come from: the desk's routes by default, or the staff's own (`me/*`). */
export interface FileRoutes {
  upload: (file: File, kind: string) => Promise<unknown>;
  href: (id: string) => string;
  remove: (id: string) => Promise<unknown>;
}

/**
 * Files on a record: each opens in a new tab; with `canAdd` a drop zone adds
 * one, with `canRemove` each (or each the predicate allows) can be removed
 * after asking. With `kinds`, a picker says what the file is before it goes
 * up. The parent reloads the record on `onChange`, so the list is always the API's.
 */
export function AttachmentsBlock({
  ownerType,
  ownerId,
  routes,
  attachments,
  canAdd = false,
  canRemove = false,
  kind = "other",
  kinds,
  addLabel = "Attach a file",
  addHint = "Drag a file here, or choose one. Up to 50 MB.",
  empty = "No files yet.",
  onChange,
}: {
  ownerType?: AttachmentOwner;
  ownerId?: string;
  /** Overrides the desk's attachment routes (the staff's own files use `me/*`). */
  routes?: FileRoutes;
  attachments: OpsAttachment[];
  canAdd?: boolean;
  canRemove?: boolean | ((a: OpsAttachment) => boolean);
  kind?: string;
  /** What the file can be; shown as a picker above the drop zone. */
  kinds?: SelectOption[];
  addLabel?: string;
  addHint?: string;
  empty?: string;
  onChange: () => void;
}) {
  const uid = useId();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chosenKind, setChosenKind] = useState(kind);
  const files: FileRoutes = routes ?? {
    upload: (file, k) => procurement.attachments.upload(ownerType ?? "pr", ownerId ?? "", file, k),
    href: procurement.attachments.href,
    remove: procurement.attachments.remove,
  };
  const removable = (a: OpsAttachment) => (typeof canRemove === "function" ? canRemove(a) : canRemove);
  const kindLabel = (k: string) => kinds?.find((o) => o.value === k)?.label ?? null;

  const add = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      await files.upload(file, kinds ? chosenKind : kind);
      onChange();
    } catch (e) {
      setError(`${file.name} wasn't attached. ${opsError(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (a: OpsAttachment) => {
    const ok = await confirm({ title: `Remove ${a.name}?`, body: "The file is taken off this record and deleted.", confirmLabel: "Remove file" });
    if (!ok) return;
    setError(null);
    try {
      await files.remove(a.id);
      onChange();
    } catch (e) {
      setError(opsError(e));
    }
  };

  return (
    <div className="space-y-3">
      {attachments.length === 0 ? (
        <p className="text-sm text-neutral-500">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center gap-3 rounded-2xl border border-neutral-100 bg-white px-3 py-2">
              <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", HUE.sky.soft)}>
                <FileText size={16} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-neutral-900" title={a.name}>
                  {a.name}
                </span>
                <span className="block truncate text-xs text-neutral-500">
                  {kindLabel(a.kind) ? `${kindLabel(a.kind)} · ` : ""}
                  {fileSize(a.size)}
                  {a.uploadedBy ? ` · ${a.uploadedBy}` : ""}
                  {a.uploadedAt ? ` · ${day(a.uploadedAt)}` : ""}
                </span>
              </span>
              <a
                href={files.href(a.id)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-neutral-500 outline-none transition hover:bg-primary-50 hover:text-primary-700 focus-visible:ring-2 focus-visible:ring-primary-300"
                aria-label={`Open ${a.name}`}
                title="Open"
              >
                <Download size={16} aria-hidden />
              </a>
              {removable(a) && (
                <button
                  type="button"
                  onClick={() => void remove(a)}
                  className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-neutral-500 outline-none transition hover:bg-error-500/10 hover:text-error-700 focus-visible:ring-2 focus-visible:ring-error-400"
                  aria-label={`Remove ${a.name}`}
                  title="Remove"
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canAdd && kinds && kinds.length > 0 && (
        <div className="max-w-xs">
          <label htmlFor={`${uid}-kind`} className="mb-1 block text-xs font-medium text-neutral-600">
            What the file is
          </label>
          <SearchableSelect id={`${uid}-kind`} value={chosenKind} onChange={setChosenKind} options={kinds} searchPlaceholder="Search kinds of file" />
        </div>
      )}
      {canAdd && <UploadZone label={addLabel} hint={addHint} onFile={(f) => void add(f)} busy={busy} compact />}
      {error && <ErrorNote>{error}</ErrorNote>}
    </div>
  );
}

/** A small "Lowest" seal for the cheapest cell or vendor: the word, never colour alone. */
export function LowestTag({ children = "Lowest" }: { children?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-mint-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
      <Check size={10} strokeWidth={3} aria-hidden />
      {children}
    </span>
  );
}
