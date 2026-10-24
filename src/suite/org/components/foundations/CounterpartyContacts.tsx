"use client";

import { useId, useState } from "react";
import { Mail, Pencil, Phone, Plus, Star, Trash2, UsersRound } from "lucide-react";
import {
  CONTACT_PURPOSES,
  orgFoundations,
  type ContactInput,
  type ContactPurpose,
  type Counterparty,
  type CounterpartyContact,
} from "@/lib/api/org-foundations-client";
import { Button, Chip, Panel, cx } from "@/components/workspace/kit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { ErrorNote, FaceAvatar, inputClass, textareaClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { FieldError, errorText, fieldErrors } from "./shared";

/**
 * The people at a client or vendor: who to send the invoice to, who chases
 * the remittance, who answers the technical questions. One is the main
 * contact - the "Send to" that Finance and Operations show. Removing one
 * sends it to the recycle bin; somebody who has left is better marked
 * inactive, which keeps them on record.
 */

const purposeLabel = (p: ContactPurpose) => CONTACT_PURPOSES.find((x) => x.value === p)?.label ?? p;

export default function ContactsPanel({ cp, onSaved }: { cp: Counterparty; onSaved: (c: Counterparty, text: string) => void }) {
  const confirm = useConfirm();
  const [editing, setEditing] = useState<CounterpartyContact | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const contacts = cp.contacts ?? [];

  const makePrimary = async (c: CounterpartyContact) => {
    setError(null);
    setBusy(c.id);
    try {
      onSaved(await orgFoundations.counterparties.makePrimaryContact(cp.id, c.id), `${c.name} is now the main contact.`);
    } catch (err) {
      setError(errorText(err, `${c.name} wasn't made the main contact.`));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (c: CounterpartyContact) => {
    const ok = await confirm({
      title: `Remove ${c.name}?`,
      body: c.isPrimary
        ? `${c.name} is the main contact, so ${cp.name} will have none until you choose another. They go to the recycle bin. If they have only left, mark them inactive instead.`
        : "They go to the recycle bin. If they have only left, mark them inactive instead.",
      confirmLabel: "Remove contact",
      recoverable: true,
    });
    if (!ok) return;
    setError(null);
    setBusy(c.id);
    try {
      onSaved(await orgFoundations.counterparties.removeContact(cp.id, c.id), `${c.name} removed. An admin can restore them from the recycle bin.`);
    } catch (err) {
      setError(errorText(err, `${c.name} wasn't removed.`));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Panel
      title="Contact people"
      subtitle="Who to talk to there. The main contact is who invoices and orders are sent to."
      icon={UsersRound}
      hue="coral"
      actions={
        <Button size="sm" icon={Plus} onClick={() => setEditing("new")}>
          Add contact
        </Button>
      }
    >
      {error && <ErrorNote className="mb-3">{error}</ErrorNote>}
      {contacts.length === 0 ? (
        <p className="flex items-start gap-3 rounded-2xl bg-coral-50/60 px-4 py-3 text-sm text-neutral-600">
          <UsersRound size={18} className="mt-0.5 shrink-0 text-coral-700" aria-hidden />
          No contacts yet. Add the person invoices and orders should go to. The first one you add becomes the main contact.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-100" aria-label="Contact people">
          {contacts.map((c) => (
            <li key={c.id} className={cx("flex flex-wrap items-start gap-3 py-3 first:pt-0 last:pb-0", !c.active && "opacity-70")}>
              <FaceAvatar name={c.name} size={36} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-neutral-900">
                  {c.name}
                  {c.isPrimary && (
                    <Chip hue="blue" icon={Star}>
                      Main contact
                    </Chip>
                  )}
                  {!c.active && <Chip hue="slate">Inactive</Chip>}
                </p>
                {c.jobTitle && <p className="text-xs text-neutral-500">{c.jobTitle}</p>}
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="inline-flex min-w-0 items-center gap-1.5 rounded hover:text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:outline-none">
                      <Mail size={12} aria-hidden />
                      <span className="truncate">{c.email}</span>
                    </a>
                  )}
                  {c.phone && (
                    <a href={`tel:${c.phone.replace(/\s+/g, "")}`} className="inline-flex items-center gap-1.5 rounded tabular-nums hover:text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:outline-none">
                      <Phone size={12} aria-hidden />
                      {c.phone}
                    </a>
                  )}
                </div>
                {c.purposes.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={`${c.name} is the contact for`}>
                    {c.purposes.map((p) => (
                      <li key={p}>
                        <Chip hue="slate">{purposeLabel(p)}</Chip>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-1">
                {!c.isPrimary && c.active && (
                  <Button size="sm" variant="ghost" icon={Star} disabled={busy === c.id} onClick={() => void makePrimary(c)}>
                    Make main
                  </Button>
                )}
                <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(c)} aria-label={`Edit ${c.name}`}>
                  <span className="hidden sm:inline">Edit</span>
                </Button>
                <Button size="sm" variant="ghost" icon={Trash2} disabled={busy === c.id} onClick={() => void remove(c)} aria-label={`Remove ${c.name}`} className="text-error-700 hover:text-error-700">
                  <span className="sr-only">Remove</span>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <ContactDialog
          cp={cp}
          contact={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved, text) => {
            setEditing(null);
            onSaved(saved, text);
          }}
        />
      )}
    </Panel>
  );
}

/** Only what changed, blanks as null. Exported for the tests. */
export function contactPatch(before: CounterpartyContact | null, after: Required<Omit<ContactInput, "isPrimary">> & { isPrimary: boolean }): ContactInput {
  const out: ContactInput = {};
  const text = (v: string | null | undefined) => (v ?? "").trim() || null;
  if (!before || text(after.name) !== before.name) out.name = (after.name ?? "").trim();
  if (!before || text(after.jobTitle) !== before.jobTitle) out.jobTitle = text(after.jobTitle);
  if (!before || text(after.email) !== before.email) out.email = text(after.email);
  if (!before || text(after.phone) !== before.phone) out.phone = text(after.phone);
  if (!before || text(after.notes) !== before.notes) out.notes = text(after.notes);
  if (!before || [...after.purposes].sort().join() !== [...before.purposes].sort().join()) out.purposes = after.purposes;
  if (before && after.active !== before.active) out.active = after.active;
  if (after.isPrimary && !before?.isPrimary) out.isPrimary = true;
  return out;
}

function ContactDialog({
  cp,
  contact,
  onClose,
  onSaved,
}: {
  cp: Counterparty;
  contact: CounterpartyContact | null;
  onClose: () => void;
  onSaved: (c: Counterparty, text: string) => void;
}) {
  const uid = useId();
  const [name, setName] = useState(contact?.name ?? "");
  const [jobTitle, setJobTitle] = useState(contact?.jobTitle ?? "");
  const [email, setEmail] = useState(contact?.email ?? "");
  const [phone, setPhone] = useState(contact?.phone ?? "");
  const [purposes, setPurposes] = useState<ContactPurpose[]>(contact?.purposes ?? []);
  const [notes, setNotes] = useState(contact?.notes ?? "");
  const [active, setActive] = useState(contact?.active ?? true);
  const [primary, setPrimary] = useState(contact?.isPrimary ?? (cp.contacts ?? []).every((c) => !c.isPrimary));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lbl = "mb-1.5 block text-sm font-medium text-neutral-700";
  const optional = <span className="font-normal text-neutral-500">(optional)</span>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (!name.trim()) found.name = "Give their name.";
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) found.email = "That doesn't look like an email address.";
    setErrors(found);
    setError(null);
    if (Object.keys(found).length > 0) return;
    const patch = contactPatch(contact, { name, jobTitle, email, phone, purposes, notes, active, isPrimary: primary && active });
    if (contact && Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    setBusy(true);
    try {
      const saved = contact
        ? await orgFoundations.counterparties.updateContact(cp.id, contact.id, patch)
        : await orgFoundations.counterparties.addContact(cp.id, { ...patch, name: name.trim() });
      onSaved(saved, contact ? `${name.trim()} saved.` : `${name.trim()} added.`);
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(errorText(err, contact ? "The contact wasn't saved." : "The contact wasn't added."));
      setBusy(false);
    }
  };

  const toggle = (p: ContactPurpose) => setPurposes((list) => (list.includes(p) ? list.filter((x) => x !== p) : [...list, p]));

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      titleId={`${uid}-title`}
      title={contact ? `Edit ${contact.name}` : `Add a contact at ${cp.name}`}
      subtitle="Their work details only. Anyone in your organisation can see the main contact on invoices and orders."
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Saving…" : contact ? "Save contact" : "Add contact"}
          </Button>
        </div>
      }
    >
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${uid}-name`} className={lbl}>
            Name
          </label>
          <input id={`${uid}-name`} value={name} onChange={(e) => setName(e.target.value)} maxLength={160} autoComplete="off" aria-invalid={errors.name ? true : undefined} className={inputClass} />
          <FieldError message={errors.name} />
        </div>
        <div>
          <label htmlFor={`${uid}-title-in`} className={lbl}>
            Job title {optional}
          </label>
          <input id={`${uid}-title-in`} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} maxLength={160} placeholder="Accounts officer" className={inputClass} />
        </div>
        <div>
          <label htmlFor={`${uid}-email`} className={lbl}>
            Email {optional}
          </label>
          <input id={`${uid}-email`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} autoComplete="off" aria-invalid={errors.email ? true : undefined} className={inputClass} />
          <FieldError message={errors.email} />
        </div>
        <div>
          <label htmlFor={`${uid}-phone`} className={lbl}>
            Phone {optional}
          </label>
          <input id={`${uid}-phone`} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={32} autoComplete="off" aria-invalid={errors.phone ? true : undefined} className={inputClass} />
          <FieldError message={errors.phone} />
        </div>
      </div>
      <div>
        <p id={`${uid}-purposes`} className={lbl}>
          The contact for {optional}
        </p>
        <div role="group" aria-labelledby={`${uid}-purposes`} className="flex flex-wrap gap-2">
          {CONTACT_PURPOSES.map((p) => {
            const on = purposes.includes(p.value);
            return (
              <button
                key={p.value}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(p.value)}
                className={cx(
                  "inline-flex h-11 cursor-pointer items-center rounded-xl border px-3.5 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary-300",
                  on ? "border-primary-600 bg-primary-600 text-white" : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300",
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <label htmlFor={`${uid}-notes`} className={lbl}>
          Notes {optional}
        </label>
        <textarea id={`${uid}-notes`} rows={2} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} className={textareaClass} />
      </div>
      <div className="space-y-2">
        {contact && (
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-neutral-700">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus-visible:ring-primary-300" />
            Still there (untick when they leave; they stay on record)
          </label>
        )}
        <label className={cx("flex min-h-11 items-center gap-3 text-sm text-neutral-700", active ? "cursor-pointer" : "cursor-not-allowed opacity-60")}>
          <input
            type="checkbox"
            checked={primary && active}
            disabled={!active || Boolean(contact?.isPrimary)}
            onChange={(e) => setPrimary(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus-visible:ring-primary-300"
          />
          Main contact: invoices and orders go to them
        </label>
      </div>
    </DialogFrame>
  );
}
