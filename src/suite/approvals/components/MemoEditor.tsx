"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, CalendarClock, FileDown, Landmark, NotebookPen, Save, Send, Stamp, Tag, Trash2, Undo2, UserRound, Wallet } from "lucide-react";
import { Button, Chip, PageHeader, Panel, buttonClass } from "@/components/workspace/kit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { ApprovalRoutePreview } from "@/components/workspace/ApprovalRoutePreview";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";
import { RichTextView } from "@/components/workspace/RichTextView";
import { isRichBlank } from "@/lib/richText";
import { BackLink, ErrorNote, Field, InfoList, InfoRow, Skeleton, hintClass, inputClass } from "@/suite/lms/components/ui/ws";
import { ApiError, MEMO_CATEGORIES, formatMoney, memos, type Memo, type MemoCategory, type MemoInput } from "@/lib/api/approvals-client";
import { orgFoundations } from "@/lib/api/org-foundations-client";
import { MEMO_STATUS, formatDateTime, koboToNaira, nairaToKobo } from "../lib/labels";

/*
  One memo: written, saved, sent, followed.

  While a memo is a draft — or has come back returned — it is a form, and the
  route it would take is worked out live above the send button, so nobody
  sends a memo without knowing whose desk it lands on. Once sent it reads as
  a document: its status, its reference, the approval behind it and a PDF.
*/

export const MEMO_PROCESS = "core.approval_memo";

interface Draft {
  title: string;
  category: MemoCategory;
  body: string;
  amount: string;
  unitId: string;
  costCentreId: string;
  payeeId: string;
}

const BLANK: Draft = { title: "", category: "general", body: "", amount: "", unitId: "", costCentreId: "", payeeId: "" };

function fromMemo(m: Memo): Draft {
  return {
    title: m.title,
    category: m.category,
    body: m.body ?? "",
    amount: koboToNaira(m.amount),
    unitId: m.unit?.id ?? "",
    costCentreId: m.costCentre?.id ?? "",
    payeeId: m.payee?.id ?? "",
  };
}

/** Client-side checks the API would also make. Empty object = fine. */
export function validateMemo(d: Draft): Record<string, string> {
  const out: Record<string, string> = {};
  if (d.title.trim() === "") out.title = "Give the memo a title.";
  else if (d.title.length > 255) out.title = "Keep the title under 255 characters.";
  const k = nairaToKobo(d.amount);
  if (k !== null && Number.isNaN(k)) out.amount = "Enter an amount in naira, like 250000 or 1,250.50.";
  return out;
}

function toInput(d: Draft): MemoInput & { title: string } {
  return {
    title: d.title.trim(),
    category: d.category,
    body: isRichBlank(d.body) ? null : d.body,
    amount: nairaToKobo(d.amount),
    unitId: d.unitId || null,
    costCentreId: d.costCentreId || null,
    payeeId: d.payeeId || null,
  };
}

type Lookups = {
  units: { value: string; label: string; hint?: string }[];
  costCentres: { value: string; label: string; hint?: string }[];
  payees: { value: string; label: string; hint?: string }[];
};

export default function MemoEditor({ id }: { id?: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const uid = useId();

  const [memo, setMemo] = useState<Memo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [lookups, setLookups] = useState<Lookups>({ units: [], costCentres: [], payees: [] });

  useEffect(() => {
    if (!id) return;
    let alive = true;
    memos
      .get(id)
      .then((m) => {
        if (!alive) return;
        setMemo(m);
        setDraft(fromMemo(m));
        setLoadError(null);
      })
      .catch((e: unknown) =>
        alive && setLoadError(e instanceof ApiError && e.status === 404 ? "No memo with that link." : "The memo didn't load. Try again."),
      );
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      orgFoundations.lookups.units(),
      orgFoundations.lookups.costCentres(),
      orgFoundations.lookups.counterparties({ role: "vendor" }),
    ]).then(([u, c, p]) => {
      if (!alive) return;
      setLookups({
        units: u.status === "fulfilled" ? u.value.map((x) => ({ value: x.id, label: `${" ".repeat(Math.min(x.depth, 4))}${x.name}`, hint: x.code })) : [],
        costCentres: c.status === "fulfilled" ? c.value.map((x) => ({ value: x.id, label: x.name, hint: x.code })) : [],
        payees: p.status === "fulfilled" ? p.value.map((x) => ({ value: x.id, label: x.name, hint: x.code ?? undefined })) : [],
      });
    });
    return () => {
      alive = false;
    };
  }, []);

  const editable = !id || (memo !== null && memo.editable && memo.isMine);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setErrors((e) => {
      if (!e[k]) return e;
      const next = { ...e };
      delete next[k];
      return next;
    });
  };

  // What the route preview simulates: the same context the memo would carry.
  const amountKobo = nairaToKobo(draft.amount);
  const context = useMemo(
    () => ({
      amount: amountKobo !== null && !Number.isNaN(amountKobo) ? amountKobo : null,
      category: draft.category,
      unitId: draft.unitId || null,
      costCentreId: draft.costCentreId || null,
      payeeId: draft.payeeId || null,
      projectIds: memo?.projectIds ?? [],
    }),
    [amountKobo, draft.category, draft.unitId, draft.costCentreId, draft.payeeId, memo?.projectIds],
  );

  const fail = (e: unknown, fallback: string) => {
    if (e instanceof ApiError && e.status === 422) {
      const fe: Record<string, string> = {};
      for (const [k, v] of Object.entries(e.errors ?? {})) fe[k] = v[0];
      setErrors(fe);
      setError(fe.memo ?? (Object.keys(fe).length ? "Check the fields marked below." : e.message));
    } else if (e instanceof ApiError && e.status === 403) {
      setError(e.message || "Only the person who wrote this memo can change it.");
    } else {
      setError(fallback);
    }
  };

  /** Creates or updates; returns the saved memo, or null after showing errors. */
  const persist = async (): Promise<Memo | null> => {
    const fe = validateMemo(draft);
    if (Object.keys(fe).length) {
      setErrors(fe);
      document.getElementById(`${uid}-${Object.keys(fe)[0]}`)?.focus();
      return null;
    }
    const input = toInput(draft);
    return memo ? memos.update(memo.id, input) : memos.create(input);
  };

  const save = async () => {
    setBusy("save");
    setError(null);
    setNotice(null);
    try {
      const saved = await persist();
      if (!saved) return;
      setMemo(saved);
      setNotice("Draft saved.");
      if (!id) router.replace(`/suite/memos/${saved.id}`);
    } catch (e) {
      fail(e, "The memo wasn't saved. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const send = async () => {
    setBusy("send");
    setError(null);
    setNotice(null);
    try {
      const saved = await persist();
      if (!saved) return;
      setMemo(saved);
      const sent = await memos.submit(saved.id);
      setMemo(sent);
      setDraft(fromMemo(sent));
      setNotice(sent.status === "approved" ? "Sent, and approved straight away. Nobody needed to sign it off." : "Sent for approval. You'll be told when it is decided.");
      if (!id) router.replace(`/suite/memos/${sent.id}`);
    } catch (e) {
      fail(e, "The memo wasn't sent. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const withdraw = async () => {
    if (!memo) return;
    const ok = await confirm({
      title: "Withdraw this memo?",
      body: "Approvers stop seeing it and nothing more is decided. You can't resend a withdrawn memo; write a new one if you need to.",
      confirmLabel: "Withdraw memo",
    });
    if (!ok) return;
    setBusy("recall");
    setError(null);
    try {
      const m = await memos.recall(memo.id);
      setMemo(m);
      setNotice("Withdrawn.");
    } catch (e) {
      fail(e, "The memo wasn't withdrawn. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!memo) return;
    const ok = await confirm({ title: `Delete “${memo.title}”?`, recoverable: true, confirmLabel: "Delete draft" });
    if (!ok) return;
    setBusy("delete");
    try {
      await memos.remove(memo.id);
      router.push("/suite/memos");
    } catch (e) {
      fail(e, "The draft wasn't deleted. Try again.");
      setBusy(null);
    }
  };

  /* ------------------------------ render ------------------------------ */

  if (loadError) {
    return (
      <div>
        <BackLink href="/suite/memos" label="My memos" />
        <ErrorNote>{loadError}</ErrorNote>
      </div>
    );
  }

  if (id && !memo) {
    return (
      <div aria-busy="true" aria-label="Loading the memo" className="space-y-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-80" />
      </div>
    );
  }

  const status = memo ? MEMO_STATUS[memo.status] : null;
  const feedback = (
    <>
      {error && <ErrorNote className="mb-4">{error}</ErrorNote>}
      {notice && !error && (
        <p role="status" className="mb-4 rounded-xl border border-mint-100 bg-mint-50 px-4 py-3 text-sm font-medium text-mint-700">
          {notice}
        </p>
      )}
    </>
  );

  const docActions = memo && (
    <>
      {memo.approvalId && (
        <Link href={`/suite/approvals?open=${memo.approvalId}`} className={buttonClass("secondary")}>
          <Stamp size={17} aria-hidden />
          Follow its approval
        </Link>
      )}
      {memo.status !== "draft" && (
        <a href={memos.pdfUrl(memo.id)} download className={buttonClass("secondary")}>
          <FileDown size={17} aria-hidden />
          Download PDF
        </a>
      )}
      {memo.status === "pending" && memo.isMine && (
        <Button icon={Undo2} onClick={withdraw} disabled={busy !== null}>
          Withdraw
        </Button>
      )}
      {memo.status === "draft" && memo.isMine && (
        <Button icon={Trash2} onClick={remove} disabled={busy !== null} className="text-error-700 hover:border-error-500/40 hover:bg-error-500/5">
          Delete draft
        </Button>
      )}
    </>
  );

  /* Read view: sent, decided, or somebody else's. */
  if (memo && !editable) {
    return (
      <div>
        <BackLink href="/suite/memos" label="My memos" />
        <PageHeader
          eyebrow={memo.reference ?? "Memo"}
          title={memo.title}
          subtitle={
            <span className="inline-flex flex-wrap items-center gap-2">
              {status && (
                <Chip hue={status.hue} dot>
                  {status.label}
                </Chip>
              )}
              {memo.requester && <span>Written by {memo.requester.name}</span>}
            </span>
          }
          actions={docActions}
        />
        {feedback}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Panel title="Memo" icon={NotebookPen}>
            {memo.body ? (
              <RichTextView value={memo.body} />
            ) : (
              <p className="text-sm text-neutral-500">This memo has no body text.</p>
            )}
          </Panel>
          <Panel title="Details" icon={Tag} hue="slate">
            <InfoList>
              <InfoRow icon={Tag} label="Category">
                {MEMO_CATEGORIES.find((c) => c.value === memo.category)?.label ?? memo.category}
              </InfoRow>
              <InfoRow icon={Wallet} label="Amount">
                {memo.amount == null ? "None" : <span className="tabular-nums">{formatMoney(memo.amount, memo.currency)}</span>}
              </InfoRow>
              {memo.unit && (
                <InfoRow icon={Building2} label="Unit">
                  {memo.unit.name}
                </InfoRow>
              )}
              {memo.costCentre && (
                <InfoRow icon={Landmark} label="Cost centre">
                  {memo.costCentre.code} · {memo.costCentre.name}
                </InfoRow>
              )}
              {memo.payee && (
                <InfoRow icon={UserRound} label="Payee">
                  {memo.payee.name}
                </InfoRow>
              )}
              <InfoRow icon={CalendarClock} label={memo.decidedAt ? "Decided" : "Sent"}>
                {formatDateTime(memo.decidedAt ?? memo.submittedAt)}
              </InfoRow>
            </InfoList>
          </Panel>
        </div>
      </div>
    );
  }

  /* Form: a new memo, a draft, or a returned memo. */
  const returned = memo?.status === "returned";
  const err = (k: string) => errors[k];

  return (
    <div>
      <BackLink href="/suite/memos" label="My memos" />
      <PageHeader
        eyebrow={memo?.reference ?? (memo ? "Draft memo" : "New memo")}
        title={memo ? memo.title || "Untitled memo" : "Write a memo"}
        subtitle={
          returned
            ? "An approver returned this memo. Make the changes they asked for, then resend it."
            : "Ask for approval of anything without its own form. Save a draft any time."
        }
        actions={memo ? docActions : undefined}
      />
      {returned && memo?.approvalId && (
        <p className="mb-4 rounded-xl border border-sun-100 bg-sun-50 px-4 py-3 text-sm text-sun-700">
          Read the approver&apos;s reason on{" "}
          <Link href={`/suite/approvals?open=${memo.approvalId}`} className="font-semibold underline underline-offset-2">
            its approval
          </Link>
          .
        </p>
      )}
      {feedback}

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]"
      >
        <Panel title="The memo" icon={NotebookPen}>
          <div className="space-y-4">
            <Field id={`${uid}-title`} label="Title" hint="Required">
              <input
                id={`${uid}-title`}
                className={inputClass}
                value={draft.title}
                maxLength={255}
                onChange={(e) => set("title", e.target.value)}
                aria-invalid={Boolean(err("title"))}
                aria-describedby={err("title") ? `${uid}-title-err` : undefined}
              />
              {err("title") && (
                <p id={`${uid}-title-err`} role="alert" className={`${hintClass} text-error-700`}>
                  {err("title")}
                </p>
              )}
            </Field>
            <Field id={`${uid}-category`} label="Category">
              <SearchableSelect
                id={`${uid}-category`}
                value={draft.category}
                onChange={(v) => set("category", v as MemoCategory)}
                options={MEMO_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
              />
            </Field>
            <Field id={`${uid}-body`} label="What you are asking for" hint="Headings, lists and tables keep their shape">
              <RichTextEditor
                id={`${uid}-body`}
                variant="full"
                value={draft.body}
                onChange={(html) => set("body", html)}
                invalid={Boolean(err("body"))}
                placeholder="Say what you are asking for, why, and what it costs…"
              />
              {err("body") && <p className={`${hintClass} text-error-700`}>{err("body")}</p>}
            </Field>
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel title="Money and ownership" icon={Wallet} hue="mint">
            <div className="space-y-4">
              <Field id={`${uid}-amount`} label="Amount (₦)" hint="Optional">
                <input
                  id={`${uid}-amount`}
                  inputMode="decimal"
                  className={inputClass}
                  value={draft.amount}
                  placeholder="0"
                  onChange={(e) => set("amount", e.target.value)}
                  aria-invalid={Boolean(err("amount"))}
                  aria-describedby={`${uid}-amount-hint`}
                />
                <p id={`${uid}-amount-hint`} className={`${hintClass} ${err("amount") ? "text-error-700" : ""}`}>
                  {err("amount") ??
                    (amountKobo && !Number.isNaN(amountKobo) ? formatMoney(amountKobo) : "Leave blank if nothing is to be spent.")}
                </p>
              </Field>
              <Field id={`${uid}-unit`} label="Unit">
                <SearchableSelect id={`${uid}-unit`} value={draft.unitId} onChange={(v) => set("unitId", v)} options={lookups.units} clearable clearLabel="No unit" placeholder="Choose a unit" />
                {err("unitId") && <p className={`${hintClass} text-error-700`}>{err("unitId")}</p>}
              </Field>
              <Field id={`${uid}-cc`} label="Cost centre">
                <SearchableSelect id={`${uid}-cc`} value={draft.costCentreId} onChange={(v) => set("costCentreId", v)} options={lookups.costCentres} clearable clearLabel="No cost centre" placeholder="Choose a cost centre" />
                {err("costCentreId") && <p className={`${hintClass} text-error-700`}>{err("costCentreId")}</p>}
              </Field>
              <Field id={`${uid}-payee`} label="Payee" hint="A vendor">
                <SearchableSelect id={`${uid}-payee`} value={draft.payeeId} onChange={(v) => set("payeeId", v)} options={lookups.payees} clearable clearLabel="No payee" placeholder="Choose a vendor" noOptionsText="No vendors on file yet." />
                {err("payeeId") && <p className={`${hintClass} text-error-700`}>{err("payeeId")}</p>}
              </Field>
            </div>
          </Panel>

          <div className="ws-card space-y-4 p-5">
            <ApprovalRoutePreview process={MEMO_PROCESS} context={context} />
            <div className="flex flex-col gap-2">
              <Button type="submit" variant="primary" icon={Send} disabled={busy !== null}>
                {busy === "send" ? "Sending…" : returned ? "Resend for approval" : "Send for approval"}
              </Button>
              <Button icon={Save} onClick={save} disabled={busy !== null}>
                {busy === "save" ? "Saving…" : memo ? "Save changes" : "Save draft"}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
