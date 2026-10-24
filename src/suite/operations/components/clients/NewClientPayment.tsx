"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, HandCoins, Save, UserRound } from "lucide-react";
import { Button, ButtonLink, PageHeader, Panel, Segmented } from "@/components/workspace/kit";
import { SearchableSelect, type SelectOption } from "@/components/workspace/SearchableSelect";
import { BackLink, ErrorNote, Field, FormActions, Skeleton, inputClass } from "@/suite/lms/components/ui/ws";
import { FieldError, LoadError } from "@/suite/org/components/foundations/shared";
import { Money } from "@/suite/finance/components/banking/ui";
import { amount, day } from "@/suite/finance/lib/format";
import { useAuth } from "@/lib/auth-store";
import { mayDoOps } from "@/suite/operations/lib/operations-access";
import { clientPayments, opsError, opsFieldErrors, travel, type PaymentSources } from "@/lib/api/operations-travel-client";
import { MoneyInput } from "../travel/shared";

/**
 * Prepare a client payment request: from an issued Finance invoice (the
 * client, amount and project come with it), or by hand. The client's
 * document checklist is copied onto it; the pack is assembled next.
 */
export default function NewClientPayment() {
  const router = useRouter();
  const { user } = useAuth();
  const [sources, setSources] = useState<PaymentSources | null>(null);
  const [projects, setProjects] = useState<SelectOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [from, setFrom] = useState<"invoice" | "hand">("invoice");
  const [invoiceId, setInvoiceId] = useState("");
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [value, setValue] = useState<number | null>(null);
  const [projectId, setProjectId] = useState("");
  const [managerId, setManagerId] = useState(user?.id ?? "");
  const [expected, setExpected] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    clientPayments.sources().then(
      (s) => {
        if (!alive) return;
        setSources(s);
        setError(null);
        if (s.invoices.length === 0) setFrom("hand");
      },
      (e: unknown) => alive && setError(`The invoices and clients didn't load. ${opsError(e)}`),
    );
    travel.options().then(
      (o) => alive && setProjects(o.projects.map((p) => ({ value: p.id, label: p.name, hint: p.code ?? undefined }))),
      () => alive && setProjects([]),
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  const invoice = sources?.invoices.find((i) => i.id === invoiceId) ?? null;
  const invoiceOptions: SelectOption[] = useMemo(
    () => (sources?.invoices ?? []).map((i) => ({ value: i.id, label: `${i.invoiceNo} · ${i.client}`, hint: `${amount(i.total)} · issued ${day(i.date)}` })),
    [sources],
  );

  const pickInvoice = (id: string) => {
    setInvoiceId(id);
    const i = sources?.invoices.find((x) => x.id === id);
    if (!i) return;
    setClientId(i.clientId);
    setValue(i.total);
    setProjectId(i.projectId ?? "");
    setTitle((t) => t || `${i.invoiceNo}: payment`);
  };

  const save = async () => {
    const found: Record<string, string> = {};
    if (from === "invoice" && !invoiceId) found.invoiceId = "Choose the invoice, or prepare it by hand.";
    if (!clientId) found.clientId = "Choose the client.";
    if (!title.trim()) found.title = "Give the request a title the client will recognise.";
    if (value === null) found.amount = "Enter the amount.";
    setErrors(found);
    setSaveError(null);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    try {
      const r = await clientPayments.create({
        clientId,
        title: title.trim(),
        amount: value ?? 0,
        projectId: projectId || null,
        invoiceId: from === "invoice" ? invoiceId : null,
        milestoneId: from === "invoice" ? (invoice?.milestoneId ?? null) : null,
        accountManagerId: managerId || null,
        expectedPaymentOn: expected || null,
        nextFollowUpOn: followUp || null,
      });
      router.push(`/suite/operations/clients/requests/${r.id}`);
    } catch (e) {
      setErrors(opsFieldErrors(e));
      setSaveError(`The request wasn't prepared. ${opsError(e)}`);
      setSaving(false);
    }
  };

  if (!mayDoOps(user, "client_payments", "create")) {
    return (
      <div>
        <BackLink href="/suite/operations/clients/requests" label="Client payments" />
        <ErrorNote>Preparing client payment requests needs the account manager&apos;s permission. Ask an admin for it.</ErrorNote>
      </div>
    );
  }

  if (error && !sources) {
    return (
      <div>
        <BackLink href="/suite/operations/clients/requests" label="Client payments" />
        <LoadError text={error} onRetry={() => setReload((k) => k + 1)} />
      </div>
    );
  }

  if (!sources) {
    return (
      <div aria-busy="true" className="space-y-6">
        <p className="sr-only">Loading…</p>
        <Skeleton className="h-20" />
        <Skeleton className="h-[420px]" />
      </div>
    );
  }

  const clients: SelectOption[] = sources.clients.map((c) => ({ value: c.id, label: c.name }));
  const staff: SelectOption[] = sources.staff.map((s) => ({ value: s.id, label: s.name }));

  return (
    <div>
      <BackLink href="/suite/operations/clients/requests" label="Client payments" />
      <PageHeader title="Prepare a client payment request" subtitle="The client's document checklist is copied onto it. Attach the documents, get the pack approved, then submit it to the client." />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          <Panel title="What it is for" icon={FileText} hue="sky">
            <div className="space-y-4">
              <Segmented
                label="Prepare from"
                value={from}
                onChange={(v) => {
                  setFrom(v);
                  if (v === "hand") setInvoiceId("");
                }}
                options={[
                  { key: "invoice", label: "An issued invoice" },
                  { key: "hand", label: "By hand" },
                ]}
              />
              {from === "invoice" && (
                <Field id="cpr-invoice" label="Invoice">
                  <SearchableSelect
                    id="cpr-invoice"
                    value={invoiceId}
                    onChange={pickInvoice}
                    options={invoiceOptions}
                    placeholder="Choose an issued invoice"
                    searchPlaceholder="Search by number or client"
                    noOptionsText="Every issued invoice already has a request. Prepare one by hand instead."
                    aria-invalid={errors.invoiceId ? true : undefined}
                  />
                  <FieldError message={errors.invoiceId} />
                </Field>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="cpr-client" label="Client">
                  <SearchableSelect
                    id="cpr-client"
                    value={clientId}
                    onChange={setClientId}
                    options={clients}
                    disabled={from === "invoice" && Boolean(invoice)}
                    placeholder="Choose the client"
                    searchPlaceholder="Search clients"
                    noOptionsText="No active clients. Add them under Organisation › Counterparties."
                    aria-invalid={errors.clientId ? true : undefined}
                  />
                  <FieldError message={errors.clientId} />
                </Field>
                <Field id="cpr-amount" label="Amount (₦)">
                  <MoneyInput id="cpr-amount" value={value} onChange={setValue} invalid={Boolean(errors.amount)} />
                  <FieldError message={errors.amount} />
                </Field>
              </div>
              <Field id="cpr-title" label="Title">
                <input
                  id="cpr-title"
                  className={inputClass}
                  value={title}
                  maxLength={255}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Kiosk installation, training and go-live"
                  aria-invalid={errors.title ? true : undefined}
                />
                <FieldError message={errors.title} />
              </Field>
              <Field id="cpr-project" label="Project" hint="Optional">
                <SearchableSelect
                  id="cpr-project"
                  value={projectId}
                  onChange={setProjectId}
                  options={projects ?? []}
                  clearable
                  placeholder={projects === null ? "Loading projects…" : "No project"}
                  clearLabel="No project"
                  searchPlaceholder="Search projects"
                />
              </Field>
            </div>
          </Panel>

          <Panel title="The chase" icon={UserRound} hue="mint">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field id="cpr-manager" label="Account manager">
                <SearchableSelect id="cpr-manager" value={managerId} onChange={setManagerId} options={staff} placeholder="You" searchPlaceholder="Search staff" />
              </Field>
              <Field id="cpr-expected" label="Expected payment" hint="Optional">
                <input id="cpr-expected" type="date" className={inputClass} value={expected} onChange={(e) => setExpected(e.target.value)} />
              </Field>
              <Field id="cpr-follow" label="First follow-up" hint="In 3 days if empty">
                <input id="cpr-follow" type="date" className={inputClass} value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
              </Field>
            </div>
          </Panel>
        </div>

        <aside className="min-w-0" aria-label="Summary">
          <Panel title="The request" icon={HandCoins} hue="blue" className="xl:sticky xl:top-20">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-neutral-500">Client</dt>
                <dd className="font-semibold text-neutral-900">{clients.find((c) => c.value === clientId)?.label ?? "Not chosen"}</dd>
              </div>
              <div>
                <dt className="text-xs text-neutral-500">Invoice</dt>
                <dd className="font-mono font-semibold text-neutral-900">{invoice?.invoiceNo ?? "None"}</dd>
              </div>
              <div>
                <dt className="text-xs text-neutral-500">Amount</dt>
                <dd>
                  <Money value={value ?? 0} className="text-xl font-bold text-neutral-900" />
                </dd>
              </div>
            </dl>
          </Panel>
        </aside>
      </div>

      {saveError && <ErrorNote className="mt-6">{saveError}</ErrorNote>}
      <div className="mt-6">
        <FormActions>
          <ButtonLink href="/suite/operations/clients/requests" variant="ghost">
            Cancel
          </ButtonLink>
          <Button variant="primary" icon={Save} disabled={saving} onClick={() => void save()}>
            {saving ? "Preparing…" : "Prepare the request"}
          </Button>
        </FormActions>
      </div>
    </div>
  );
}
