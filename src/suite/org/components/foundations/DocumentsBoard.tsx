"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Ban, CalendarDays, FileCheck2, FileText, Fingerprint, ShieldCheck } from "lucide-react";
import { orgFoundations, type IssuedDocument } from "@/lib/api/org-foundations-client";
import { Button, Chip, Empty, PageHeader, Segmented, StatGrid } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { ActionMenu } from "@/components/dashboard/ui";
import { ErrorNote, IconTile, Skeleton, StatCard, humanise, textareaClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { hueFor } from "@/components/workspace/modules";
import { dateLabel } from "./logic";
import { FieldError, LoadError, Notice, errorText } from "./shared";

/**
 * Issued documents: every letter, certificate, contract or receipt the
 * organisation has issued, with the fingerprint (SHA-256) taken when it was
 * issued. Revoking one marks it withdrawn everywhere it can be checked; it
 * never deletes it, and the reason is kept.
 */

export const shortSha = (sha: string | null) => (sha ? sha.slice(0, 12) : null);

type StateFilter = "all" | "valid" | "revoked";

export default function DocumentsBoard() {
  const [rows, setRows] = useState<IssuedDocument[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [kind, setKind] = useState("");
  const [state, setState] = useState<StateFilter>("all");
  const [revoking, setRevoking] = useState<IssuedDocument | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    orgFoundations.documents
      .list()
      .then((r) => {
        if (!alive) return;
        setRows(r);
        setLoadError(null);
      })
      .catch((e: unknown) => alive && setLoadError(errorText(e, "Issued documents didn't load.")));
    return () => {
      alive = false;
    };
  }, [reload]);

  const all = useMemo(() => rows ?? [], [rows]);
  const kinds = useMemo(() => Array.from(new Set(all.map((d) => d.kind))).sort(), [all]);
  const shown = useMemo(
    () => all.filter((d) => (!kind || d.kind === kind) && (state === "all" || (state === "revoked" ? Boolean(d.revokedAt) : !d.revokedAt))),
    [all, kind, state],
  );
  const stats = useMemo(() => {
    const now = new Date();
    return {
      total: all.length,
      revoked: all.filter((d) => d.revokedAt).length,
      month: all.filter((d) => {
        const t = new Date(d.issuedAt);
        return t.getFullYear() === now.getFullYear() && t.getMonth() === now.getMonth();
      }).length,
    };
  }, [all]);

  const title = (d: IssuedDocument, big = false) => (
    <span className="flex min-w-0 items-center gap-3">
      <IconTile icon={d.revokedAt ? Ban : FileText} hue={d.revokedAt ? "slate" : hueFor(d.kind)} size={big ? 40 : 34} />
      <span className="min-w-0">
        <span className={big ? "block truncate text-[15px] font-semibold text-neutral-900" : "block truncate font-medium text-neutral-900"}>{d.title}</span>
        {d.reference && <span className="block font-mono text-[11px] text-neutral-500">{d.reference}</span>}
      </span>
    </span>
  );

  const status = (d: IssuedDocument) =>
    d.revokedAt ? (
      <span className="flex flex-col gap-0.5">
        <Chip hue="rose" icon={Ban}>
          Revoked {dateLabel(d.revokedAt)}
        </Chip>
        {d.revokeReason && <span className="max-w-56 truncate text-xs text-neutral-500" title={d.revokeReason}>{d.revokeReason}</span>}
      </span>
    ) : (
      <Chip hue="mint" icon={ShieldCheck}>
        Valid
      </Chip>
    );

  const fingerprint = (d: IssuedDocument) =>
    d.sha256 ? (
      <span className="inline-flex items-center gap-1.5 font-mono text-xs text-neutral-600" title={`SHA-256 ${d.sha256}`}>
        <Fingerprint size={13} aria-hidden className="text-neutral-400" />
        <span className="sr-only">Fingerprint </span>
        <a href={`/verify/d/${d.token}`} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
          {shortSha(d.sha256)}…
        </a>
      </span>
    ) : (
      <span className="text-xs text-neutral-500">None taken</span>
    );

  const actions = (d: IssuedDocument) =>
    d.revokedAt ? null : <ActionMenu label={`Actions for ${d.title}`} items={[{ label: "Revoke", icon: Ban, danger: true, onClick: () => setRevoking(d) }]} />;

  const columns: Column<IssuedDocument>[] = [
    { key: "title", header: "Document", primary: true, sortable: true, value: (d) => `${d.title} ${d.reference ?? ""}`, render: (d) => title(d) },
    { key: "kind", header: "Kind", sortable: true, value: (d) => kindLabel(d.kind), render: (d) => <Chip hue={hueFor(d.kind)}>{kindLabel(d.kind)}</Chip> },
    { key: "issued", header: "Issued", sortable: true, value: (d) => d.issuedAt, render: (d) => <span className="whitespace-nowrap text-neutral-700">{dateLabel(d.issuedAt)}</span> },
    { key: "by", header: "Issued by", sortable: true, value: (d) => d.issuedBy ?? "", hideOnMobile: true },
    { key: "state", header: "Status", value: (d) => (d.revokedAt ? "Revoked" : "Valid"), render: status },
    { key: "sha", header: "Fingerprint", value: (d) => d.sha256 ?? "", render: fingerprint, hideOnMobile: true },
    { key: "actions", header: "", align: "right", tableOnly: true, render: actions },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Organisation"
        title="Issued documents"
        subtitle="Everything the organisation has issued, with the fingerprint taken at issue. Revoke a document to withdraw it; it is never deleted."
      />

      <Notice text={notice} />
      {loadError && <LoadError text={loadError} onRetry={() => setReload((k) => k + 1)} />}

      <div className="mb-5">
        <StatGrid cols={3}>
          <StatCard featured label="Issued" value={rows ? stats.total : "—"} icon={FileCheck2} />
          <StatCard label="Issued this month" value={rows ? stats.month : "—"} icon={CalendarDays} hue="sky" />
          <StatCard label="Revoked" value={rows ? stats.revoked : "—"} icon={Ban} hue="rose" />
        </StatGrid>
      </div>

      {rows === null && !loadError ? (
        <div aria-busy="true">
          <p className="sr-only">Loading issued documents…</p>
          <Skeleton className="h-[360px]" />
        </div>
      ) : rows !== null ? (
        <DataView
          rows={shown}
          columns={columns}
          rowKey={(d) => d.id}
          storageKey="org.documents"
          caption="Issued documents"
          searchPlaceholder="Search by title or reference"
          toolbar={
            <div className="flex flex-wrap items-center gap-2">
              <SearchableSelect
                value={kind}
                onChange={setKind}
                options={kinds.map((k) => ({ value: k, label: kindLabel(k) }))}
                clearable
                clearLabel="All kinds"
                placeholder="All kinds"
                aria-label="Kind"
                size="sm"
                className="w-44"
              />
              <Segmented
                label="Status"
                value={state}
                onChange={setState}
                options={[
                  { key: "all", label: "All" },
                  { key: "valid", label: "Valid" },
                  { key: "revoked", label: "Revoked" },
                ]}
              />
            </div>
          }
          empty={
            rows.length === 0 ? (
              <Empty icon={FileText} title="Nothing issued yet." hint="Letters, certificates and receipts appear here as each module issues them." />
            ) : (
              <Empty icon={FileText} title="No document matches." hint="Try another kind, status or search." />
            )
          }
          renderCard={(d) => (
            <div className="flex h-full flex-col gap-3 p-5">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">{title(d, true)}</div>
                {actions(d)}
              </div>
              <div className="flex flex-wrap gap-2">
                <Chip hue={hueFor(d.kind)}>{kindLabel(d.kind)}</Chip>
                {status(d)}
              </div>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-3 text-xs text-neutral-500">
                <span>
                  {dateLabel(d.issuedAt)}
                  {d.issuedBy ? ` · ${d.issuedBy}` : ""}
                </span>
                {fingerprint(d)}
              </div>
            </div>
          )}
        />
      ) : null}

      {revoking && (
        <RevokeDialog
          doc={revoking}
          onClose={() => setRevoking(null)}
          onRevoked={(d) => {
            setRows((list) => list?.map((x) => (x.id === d.id ? d : x)) ?? list);
            setRevoking(null);
            setNotice(`${d.title} revoked.`);
          }}
        />
      )}
    </div>
  );
}

export function RevokeDialog({ doc, onClose, onRevoked }: { doc: IssuedDocument; onClose: () => void; onRevoked: (d: IssuedDocument) => void }) {
  const uid = useId();
  const [reason, setReason] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim() === "") {
      setFieldError("Say why it's being revoked. Anyone checking it later sees this.");
      return;
    }
    setFieldError(null);
    setError(null);
    setBusy(true);
    try {
      const r = await orgFoundations.documents.revoke(doc.id, reason.trim());
      onRevoked({ ...doc, revokedAt: r.revokedAt, revokeReason: reason.trim() });
    } catch (err) {
      setError(errorText(err, `${doc.title} wasn't revoked.`));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      titleId={`${uid}-title`}
      title={`Revoke ${doc.title}?`}
      subtitle="It stays on record, marked revoked with your reason. This can't be undone; issue a new document if one is still needed."
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="danger" icon={Ban} disabled={busy}>
            {busy ? "Revoking…" : "Revoke document"}
          </Button>
        </div>
      }
    >
      {error && <ErrorNote>{error}</ErrorNote>}
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-xl bg-neutral-50 px-4 py-3 text-sm">
        <dt className="text-neutral-500">Reference</dt>
        <dd className="font-mono text-neutral-900">{doc.reference ?? "—"}</dd>
        <dt className="text-neutral-500">Issued</dt>
        <dd className="text-neutral-900">
          {dateLabel(doc.issuedAt)}
          {doc.issuedBy ? ` by ${doc.issuedBy}` : ""}
        </dd>
        <dt className="text-neutral-500">Fingerprint</dt>
        <dd className="break-all font-mono text-xs text-neutral-700">{doc.sha256 ?? "None taken"}</dd>
      </dl>
      <div>
        <label htmlFor={`${uid}-reason`} className="mb-1.5 block text-sm font-medium text-neutral-700">
          Reason
        </label>
        <textarea
          id={`${uid}-reason`}
          rows={3}
          maxLength={255}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Issued with the wrong salary figure"
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? `${uid}-reason-err` : undefined}
          className={textareaClass}
        />
        <FieldError id={`${uid}-reason-err`} message={fieldError ?? undefined} />
      </div>
    </DialogFrame>
  );
}

/** Names for the kinds the platform issues; anything new falls back to the code, humanised. */
const KIND_LABELS: Record<string, string> = {
  doa_matrix: "DoA matrix",
  approval_record: "Approval record",
  memo: "Memo",
};

function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? humanise(kind);
}
