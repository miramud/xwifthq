"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  Building2,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FolderKanban,
  Globe,
  Mail,
  MousePointerClick,
  Pencil,
  Phone,
  Plus,
  StickyNote,
  Trash2,
  UserPlus,
  Users,
  UserX,
  UserCheck,
} from "lucide-react";
import {
  Button,
  Chip,
  Empty,
  PageHeader,
  Panel,
  StatCard,
  StatGrid,
  cx,
} from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { HUE, hueFor } from "@/components/workspace/modules";
import {
  ApiError,
  companies as companiesApi,
  type ExternalCompany,
  type ExternalPerson,
} from "@/lib/api/projects-client";
import { Modal, Notice, Skeleton, inputCls, labelCls, plural } from "./ui/pkit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";
import { RichTextView } from "@/components/workspace/RichTextView";

/**
 * The clients this institution works for, and the people at them.
 *
 * **One screen, opened in place, rather than a list and a detail route.** The
 * question this screen answers is almost always "who do we know at X", asked
 * while writing an email — and a round trip to a second page to read three
 * phone numbers is the reason people keep the numbers in a spreadsheet
 * instead. Choosing a company opens its people beside the list.
 *
 * People are held once per company and mapped onto as many projects as they
 * touch. A contact duplicated per project is one whose number is right on one
 * project and stale on three, so the roster lives here and the per-project
 * judgement — how much influence, how much interest — lives on the project.
 *
 * Nobody is ever deleted. Somebody who left is marked inactive and kept,
 * because their placements are history and a deleted person makes a closed
 * project's sign-off unattributable.
 *
 * **Everything here is editable, and that is the point of the design.** The
 * argument for holding a contact once rather than per project is that a phone
 * number can be corrected in one place — a screen that could add a person and
 * not fix their number would have all the cost of the single record and none of
 * the benefit. The first version of this shipped exactly that way: a company's
 * name could be created and never changed, and since deleting one is refused
 * while it has work, a typo in a client's name was permanent.
 */
export default function ExternalCompanies() {
  const confirm = useConfirm();
  const [list, setList] = useState<ExternalCompany[] | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);

  const [activeOnly, setActiveOnly] = useState(false);

  /** Which company is open, and its roster once fetched. */
  const [open, setOpen] = useState<string | null>(null);
  const [people, setPeople] = useState<Record<string, ExternalPerson[]>>({});

  const [adding, setAdding] = useState(false);
  /** The company whose details are being corrected, if any. */
  const [editing, setEditing] = useState<ExternalCompany | null>(null);

  const reload = useCallback(() => setReloads((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    companiesApi
      .list()
      .then((res) => {
        if (cancelled) return;

        setList(res.data);
        setCanManage(res.meta.canManage);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;

        setError(e instanceof ApiError ? e.message : "That did not load.");
        setList([]);
      });

    return () => {
      cancelled = true;
    };
  }, [reloads]);

  /*
    Filtered here rather than by re-fetching per keystroke. A client list is
    tens of rows, not thousands, and the server filter exists for the day it
    is not — but typing should not be a request per character. The text search
    is the list view's own; this only applies "current clients only".
  */
  const shown = useMemo(() => (list ?? []).filter((c) => !activeOnly || c.isActive), [list, activeOnly]);

  const run = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);

    try {
      await action();
      reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not go through.");
    } finally {
      setBusy(null);
    }
  };

  /** Fetched on open, so opening a company is one request and not N. */
  const expand = async (company: ExternalCompany) => {
    if (open === company.id) {
      setOpen(null);

      return;
    }

    setOpen(company.id);

    if (people[company.id] !== undefined) return;

    try {
      const full = await companiesApi.get(company.slug);

      setPeople((prev) => ({ ...prev, [company.id]: full.stakeholders ?? [] }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That roster did not load.");
    }
  };

  const addPerson = async (company: ExternalCompany, input: NewPerson) => {
    const person = await companiesApi.addPerson(company.slug, input);

    setPeople((prev) => ({ ...prev, [company.id]: [...(prev[company.id] ?? []), person] }));
    reload();
  };

  const savePerson = async (
    company: ExternalCompany,
    person: ExternalPerson,
    input: Record<string, unknown>,
  ) => {
    const updated = await companiesApi.updatePerson(company.slug, person.id, input);

    setPeople((prev) => ({
      ...prev,
      [company.id]: (prev[company.id] ?? []).map((p) => (p.id === person.id ? updated : p)),
    }));
  };

  const setPersonActive = async (
    company: ExternalCompany,
    person: ExternalPerson,
    isActive: boolean,
  ) => {
    const updated = await companiesApi.updatePerson(company.slug, person.id, { isActive });

    setPeople((prev) => ({
      ...prev,
      [company.id]: (prev[company.id] ?? []).map((p) => (p.id === person.id ? updated : p)),
    }));
  };

  const header = (
    <PageHeader
      eyebrow="Projects"
      title="External companies"
      subtitle="Who we work for, and the people there. Stakeholder judgements live on each project."
      actions={
        canManage && (
          <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
            Add a company
          </Button>
        )
      }
    />
  );

  if (list === null) {
    return (
      <div aria-busy="true" aria-label="Loading">
        {header}
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[124px]" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const selected = list.find((c) => c.id === open) ?? null;
  const peopleOnRecord = list.reduce((s, c) => s + (c.stakeholderCount ?? 0), 0);

  /* The buttons that change a company, the same in every view. */
  const companyActions = (company: ExternalCompany) =>
    canManage && (
      <div className="flex items-center justify-end gap-1">
        <IconButton label={`Edit ${company.name}`} icon={Pencil} onClick={() => setEditing(company)} />

        <button
          type="button"
          onClick={() =>
            void run(`status-${company.id}`, () =>
              companiesApi.update(company.slug, {
                status: company.isActive ? "former" : "active",
              }),
            )
          }
          disabled={busy !== null}
          className="inline-flex h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl border border-neutral-200 bg-white px-3 text-[13px] font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {company.isActive ? <Archive size={14} aria-hidden /> : <ArchiveRestore size={14} aria-hidden />}
          {company.isActive ? "Mark former" : "Mark current"}
        </button>

        {/*
          Refused while any project is for them, and the API says how many.
          Marking them former is what a finished relationship is for, which is
          why that button sits beside this one rather than behind a
          confirmation.
        */}
        <IconButton
          label={`Delete ${company.name}`}
          icon={Trash2}
          danger
          disabled={busy !== null}
          onClick={async () => {
            const ok = await confirm({
              title: `Delete ${company.name}?`,
              body: "Its contacts go with it. It moves to the organisation's recycle bin, where an admin can restore it. If the relationship has just ended, marking them former keeps them on file instead.",
              confirmLabel: "Delete company",
              recoverable: true,
            });
            if (ok) await run(`delete-${company.id}`, () => companiesApi.remove(company.slug));
          }}
        />
      </div>
    );

  /*
    The project count was readable and not followable. A number somebody can
    read and not open is worse than no number - they go and look for the
    projects by hand.
  */
  const projectsLink = (company: ExternalCompany) =>
    (company.projectCount ?? 0) > 0 ? (
      <Link
        href={`/suite/projects?companyId=${encodeURIComponent(company.id)}`}
        className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700 outline-none transition-colors hover:bg-primary-100 focus-visible:ring-2 focus-visible:ring-primary-300"
      >
        <ExternalLink size={11} aria-hidden />
        {company.projectCount === 1 ? "The project" : "The projects"}
      </Link>
    ) : null;

  const nameButton = (company: ExternalCompany) => (
    <button
      type="button"
      onClick={() => void expand(company)}
      aria-expanded={open === company.id}
      aria-controls="company-roster"
      className="flex min-w-0 cursor-pointer items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
    >
      <CompanyTile company={company} />
      <span className="min-w-0">
        <span
          className={cx(
            "block truncate text-sm font-semibold",
            open === company.id ? "text-primary-700" : "text-neutral-900",
          )}
        >
          {company.name}
        </span>
        <span className="block truncate text-xs text-neutral-500">{summary(company)}</span>
      </span>
    </button>
  );

  const columns: Column<ExternalCompany>[] = [
    {
      key: "name",
      header: "Company",
      primary: true,
      sortable: true,
      value: (c) => c.name,
      render: nameButton,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      value: (c) => (c.isActive ? "Current" : "Former"),
      render: (c) => <StatusChip company={c} />,
    },
    {
      key: "sector",
      header: "Sector",
      sortable: true,
      hideOnMobile: true,
      value: (c) => c.sector ?? "",
    },
    {
      key: "people",
      header: "People",
      sortable: true,
      align: "right",
      hideOnMobile: true,
      value: (c) => c.stakeholderCount ?? 0,
    },
    {
      key: "projects",
      header: "Work",
      sortable: true,
      value: (c) => c.projectCount ?? 0,
      render: (c) => projectsLink(c) ?? <span className="text-xs text-neutral-500">None you are on</span>,
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      tableOnly: true,
      render: (c) => companyActions(c) || null,
    },
  ];

  return (
    <div className="space-y-6">
      {header}

      {error !== null && <Notice>{error}</Notice>}

      {/*
        Numbers a reader would otherwise count by hand. `withWork` is the one
        that matters: a client list is mostly history, and how many of them
        have something live is the question somebody is actually asking.
      */}
      {list.length > 0 && (
        <StatGrid>
          <StatCard featured label="Companies" value={list.length} icon={Building2} />
          <StatCard
            label="Current clients"
            value={list.filter((c) => c.isActive).length}
            icon={CheckCircle2}
            hue="mint"
          />
          <StatCard
            label="With live work"
            value={list.filter((c) => (c.projectCount ?? 0) > 0).length}
            icon={FolderKanban}
            hue="sky"
            hint="Projects you are on"
          />
          <StatCard label="People on record" value={peopleOnRecord} icon={Users} hue="grape" hint="Across every company" />
        </StatGrid>
      )}

      {list.length === 0 ? (
        <Panel>
          <Empty
            icon={Building2}
            title="No companies yet"
            hint="Add the organisations you deliver for. A project can then be created against one, and its stakeholders mapped."
            action={
              canManage ? (
                <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
                  Add a company
                </Button>
              ) : undefined
            }
          />
        </Panel>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-3">
          <div className="min-w-0 xl:col-span-2">
            <DataView
              rows={shown}
              columns={columns}
              rowKey={(c) => c.id}
              storageKey="projects.companies"
              searchPlaceholder="Search by name or sector"
              caption="External companies"
              gridCols={2}
              matches={(c, needle) =>
                c.name.toLowerCase().includes(needle) || (c.sector ?? "").toLowerCase().includes(needle)
              }
              toolbar={
                <label
                  className={cx(
                    "inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border px-3 text-[13px] font-semibold transition-colors",
                    activeOnly
                      ? "border-primary-200 bg-primary-50 text-primary-700"
                      : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={activeOnly}
                    onChange={(e) => setActiveOnly(e.target.checked)}
                    className="h-4 w-4 rounded border-neutral-300 accent-primary-600"
                  />
                  Current clients only
                </label>
              }
              empty={
                shown.length === 0 ? (
                  <Empty icon={Building2} title="Nothing matches that" hint="Try a different name or sector." />
                ) : undefined
              }
              renderCard={(c) => (
                <div className={cx("flex h-full flex-col gap-4 p-5", open === c.id && "rounded-[1.125rem] ring-2 ring-primary-300")}>
                  <div className="flex items-start justify-between gap-3">
                    {nameButton(c)}
                    <StatusChip company={c} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {c.sector && <Chip hue={hueFor(c.sector)}>{c.sector}</Chip>}
                    <Chip hue="slate" icon={Users}>
                      {plural(c.stakeholderCount ?? 0, "person", "people")}
                    </Chip>
                    {projectsLink(c)}
                  </div>
                  {canManage && <div className="mt-auto border-t border-neutral-100 pt-3">{companyActions(c)}</div>}
                </div>
              )}
              renderListItem={(c) => (
                <div className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">{nameButton(c)}</div>
                  <StatusChip company={c} />
                  {projectsLink(c)}
                  {companyActions(c)}
                </div>
              )}
            />
          </div>

          <div id="company-roster" className={cx("order-first xl:order-none", selected === null && "hidden xl:block")}>
            {selected === null ? (
              <Panel>
                <Empty
                  icon={MousePointerClick}
                  hue="sky"
                  title="Choose a company"
                  hint="Its people open here: who they are, how to reach them, and what is worth knowing first."
                />
              </Panel>
            ) : (
              <CompanyPanel
                company={selected}
                roster={people[selected.id]}
                canManage={canManage}
                onClose={() => setOpen(null)}
                onAdd={addPerson}
                onSave={savePerson}
                onSetActive={setPersonActive}
                onError={setError}
              />
            )}
          </div>
        </div>
      )}

      {adding && (
        <NewCompanyForm
          busy={busy === "new"}
          onCancel={() => setAdding(false)}
          onSubmit={async (input) => {
            await run("new", () => companiesApi.create(input));
            setAdding(false);
          }}
        />
      )}

      {canManage && editing !== null && (
        <CompanyForm
          company={editing}
          busy={busy === `edit-${editing.id}`}
          onCancel={() => setEditing(null)}
          onSubmit={async (input) => {
            await run(`edit-${editing.id}`, () => companiesApi.update(editing.slug, input));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Small pieces                                                       */
/* ------------------------------------------------------------------ */

function summary(company: ExternalCompany): string {
  return (
    [
      company.sector,
      company.stakeholderCount === undefined
        ? null
        : `${company.stakeholderCount} ${company.stakeholderCount === 1 ? "person" : "people"}`,
      /*
        Counted from what this viewer may see, so a company never advertises
        an engagement somebody is not staffed on.
      */
      company.projectCount === undefined || company.projectCount === 0
        ? null
        : `${company.projectCount} ${company.projectCount === 1 ? "project" : "projects"}`,
    ]
      .filter(Boolean)
      .join(" · ") || "No details yet"
  );
}

function CompanyTile({ company, size = 36 }: { company: ExternalCompany; size?: number }) {
  return (
    <span
      aria-hidden
      className={cx(
        "flex shrink-0 items-center justify-center rounded-xl",
        company.isActive ? HUE[hueFor(company.name)].soft : HUE.slate.soft,
      )}
      style={{ width: size, height: size }}
    >
      <Building2 size={Math.round(size * 0.48)} />
    </span>
  );
}

function StatusChip({ company }: { company: ExternalCompany }) {
  return company.isActive ? (
    <Chip hue="mint" dot>
      Current
    </Chip>
  ) : (
    <Chip hue="slate" icon={Archive}>
      Former client
    </Chip>
  );
}

function IconButton({
  label,
  icon: Icon,
  onClick,
  disabled,
  danger = false,
  title,
}: {
  label: string;
  icon: typeof Pencil;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={title ?? label}
      className={cx(
        "flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-neutral-500 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-300 disabled:cursor-not-allowed disabled:opacity-50",
        danger ? "hover:bg-error-500/10 hover:text-error-700" : "hover:bg-neutral-100 hover:text-neutral-800",
      )}
    >
      <Icon size={15} aria-hidden />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  The open company                                                   */
/* ------------------------------------------------------------------ */

interface NewPerson {
  name: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  notes?: string;
}

function CompanyPanel({
  company,
  roster,
  canManage,
  onClose,
  onAdd,
  onSave,
  onSetActive,
  onError,
}: {
  company: ExternalCompany;
  roster: ExternalPerson[] | undefined;
  canManage: boolean;
  onClose: () => void;
  onAdd: (company: ExternalCompany, input: NewPerson) => Promise<void>;
  onSave: (company: ExternalCompany, person: ExternalPerson, input: Record<string, unknown>) => Promise<void>;
  onSetActive: (company: ExternalCompany, person: ExternalPerson, isActive: boolean) => Promise<void>;
  onError: (message: string) => void;
}) {
  return (
    <Panel
      title={`People at ${company.name}`}
      subtitle={company.sector ?? (company.isActive ? "Current client" : "Former client")}
      icon={Building2}
      hue={company.isActive ? hueFor(company.name) : "slate"}
      actions={
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the roster"
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800"
        >
          <ChevronRight size={17} aria-hidden />
        </button>
      }
    >
      {(company.website || company.notes) && (
        <div className="mb-4 space-y-2 rounded-2xl bg-neutral-50 p-3.5 text-sm">
          {company.website !== null && company.website !== "" && (
            <a
              href={company.website}
              target="_blank"
              rel="noreferrer noopener"
              className="flex items-center gap-2 font-medium text-primary-700 hover:underline"
            >
              <Globe size={14} aria-hidden />
              Website
            </a>
          )}
          {company.notes && (
            <div className="flex items-start gap-2 text-neutral-600">
              <StickyNote size={14} className="mt-0.5 shrink-0 text-neutral-400" aria-hidden />
              <RichTextView value={company.notes} size="sm" className="min-w-0 flex-1 text-neutral-600" />
            </div>
          )}
        </div>
      )}

      {roster === undefined ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading the roster">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : (
        <Roster
          company={company}
          people={roster}
          canManage={canManage}
          onAdd={onAdd}
          onSave={onSave}
          onSetActive={onSetActive}
          onError={onError}
        />
      )}
    </Panel>
  );
}

function Roster({
  company,
  people,
  canManage,
  onAdd,
  onSave,
  onSetActive,
  onError,
}: {
  company: ExternalCompany;
  people: ExternalPerson[];
  canManage: boolean;
  onAdd: (company: ExternalCompany, input: NewPerson) => Promise<void>;
  onSave: (company: ExternalCompany, person: ExternalPerson, input: Record<string, unknown>) => Promise<void>;
  onSetActive: (company: ExternalCompany, person: ExternalPerson, isActive: boolean) => Promise<void>;
  onError: (message: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  /** Who is being corrected. The whole reason the roster is one record. */
  const [editing, setEditing] = useState<ExternalPerson | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  const submit = async () => {
    if (name.trim() === "") return;

    setBusy(true);

    try {
      await onAdd(company, {
        name: name.trim(),
        jobTitle: jobTitle.trim() === "" ? undefined : jobTitle.trim(),
        email: email.trim() === "" ? undefined : email.trim(),
        phone: phone.trim() === "" ? undefined : phone.trim(),
        notes: notes.trim() === "" ? undefined : notes.trim(),
      });

      setName("");
      setJobTitle("");
      setEmail("");
      setPhone("");
      setNotes("");
      setAdding(false);
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "That did not go through.");
    } finally {
      setBusy(false);
    }
  };

  /* Current people first; somebody who left stays on the list, greyed. */
  const ordered = [...people].sort((a, b) =>
    a.isActive === b.isActive ? a.name.localeCompare(b.name) : a.isActive ? -1 : 1,
  );

  return (
    <div className="space-y-3">
      {canManage && (
        <Button size="sm" icon={UserPlus} onClick={() => setAdding(true)} className="w-full">
          Add somebody
        </Button>
      )}

      {ordered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-neutral-200 px-4 py-6 text-center text-sm text-neutral-500">
          Nobody recorded yet. Add the people you deal with here, then map them onto the projects they are involved
          in.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {ordered.map((person) => (
            <li
              key={person.id}
              className={cx(
                "rounded-2xl border border-neutral-200 bg-white p-3.5 transition-colors",
                !person.isActive && "bg-neutral-50",
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className={cx(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    person.isActive ? HUE[hueFor(person.name)].soft : HUE.slate.soft,
                  )}
                >
                  {person.initials}
                </span>

                <div className="min-w-0 flex-1">
                  <p className={cx("truncate text-sm font-semibold", person.isActive ? "text-neutral-900" : "text-neutral-500")}>
                    {person.name}
                  </p>
                  <p className="truncate text-xs text-neutral-500">{person.jobTitle ?? "Role not recorded"}</p>
                  {!person.isActive && (
                    <Chip hue="slate" icon={UserX} className="mt-1.5 !px-2 !py-0.5 text-[11px]">
                      No longer there
                    </Chip>
                  )}
                </div>

                {canManage && (
                  <div className="-mr-1 -mt-1 flex shrink-0">
                    <IconButton label={`Edit ${person.name}`} icon={Pencil} onClick={() => setEditing(person)} />
                    {/*
                      Marked, never deleted. Their placements on closed projects
                      are the record of who signed what off, and a deleted person
                      makes that unattributable.
                    */}
                    <IconButton
                      label={person.isActive ? `Mark ${person.name} as no longer there` : `Mark ${person.name} as current`}
                      title={person.isActive ? "They have left. Kept on past projects." : "Mark as current again"}
                      icon={person.isActive ? UserX : UserCheck}
                      onClick={() => void onSetActive(company, person, !person.isActive)}
                    />
                  </div>
                )}
              </div>

              {((person.email !== null && person.email !== "") || (person.phone !== null && person.phone !== "")) && (
                <div className="mt-2.5 flex flex-wrap gap-2 pl-12">
                  {person.email !== null && person.email !== "" && (
                    <a
                      href={`mailto:${person.email}`}
                      className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700 hover:bg-primary-100"
                    >
                      <Mail size={12} aria-hidden />
                      {person.email}
                    </a>
                  )}
                  {person.phone !== null && person.phone !== "" && (
                    <a
                      href={`tel:${person.phone}`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-200"
                    >
                      <Phone size={12} aria-hidden />
                      {person.phone}
                    </a>
                  )}
                </div>
              )}

              {/* Accepted by the API since the first commit and shown nowhere. */}
              {person.notes !== null && person.notes !== "" && (
                <RichTextView value={person.notes} size="sm" className="mt-2 pl-12 text-xs text-neutral-600" />
              )}
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <Modal
          title="Add somebody"
          subtitle={`At ${company.name}`}
          icon={UserPlus}
          onClose={() => setAdding(false)}
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          footer={
            <>
              <Button type="button" variant="ghost" onClick={() => setAdding(false)} className="ml-auto">
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={busy || name.trim() === ""}>
                {busy ? "Adding…" : "Add"}
              </Button>
            </>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="np-person-name" label="Name">
              <input
                id="np-person-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Adaeze Okafor"
                autoFocus
                className={inputCls}
              />
            </Field>
            <Field id="np-person-title" label="Job title">
              <input
                id="np-person-title"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Finance Director"
                className={inputCls}
              />
            </Field>
            <Field id="np-person-email" label="Email">
              <input
                id="np-person-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field id="np-person-phone" label="Phone">
              <input
                id="np-person-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field id="np-person-notes" label="Notes" className="sm:col-span-2">
              <input
                id="np-person-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Prefers a call to an email"
                className={inputCls}
              />
            </Field>
          </div>
        </Modal>
      )}

      {editing !== null && (
        <PersonForm
          person={editing}
          onCancel={() => setEditing(null)}
          onSubmit={async (input) => {
            try {
              await onSave(company, editing, input);
              setEditing(null);
            } catch (e) {
              onError(e instanceof ApiError ? e.message : "That did not go through.");
            }
          }}
        />
      )}
    </div>
  );
}

function Field({
  id,
  label,
  className,
  children,
}: {
  id: string;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Forms                                                              */
/* ------------------------------------------------------------------ */

function NewCompanyForm({
  busy,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
  onCancel: () => void;
  onSubmit: (input: { name: string; website?: string; sector?: string; notes?: string }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [sector, setSector] = useState("");
  const [website, setWebsite] = useState("");

  return (
    <Modal
      title="Add a company"
      subtitle="Only the name is needed now. A project can then be created against it."
      icon={Building2}
      onClose={onCancel}
      onSubmit={(e) => {
        e.preventDefault();
        if (busy || name.trim() === "") return;
        void onSubmit({
          name: name.trim(),
          sector: sector.trim() === "" ? undefined : sector.trim(),
          website: website.trim() === "" ? undefined : website.trim(),
        });
      }}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onCancel} className="ml-auto">
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={busy || name.trim() === ""}>
            {busy ? "Adding…" : "Add company"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field id="nc-name" label="Company name">
          <input
            id="nc-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Industries"
            autoFocus
            className={inputCls}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="nc-sector" label="Sector">
            <input
              id="nc-sector"
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              placeholder="Manufacturing"
              className={inputCls}
            />
          </Field>
          <Field id="nc-website" label="Website">
            <input
              id="nc-website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://acme.com"
              className={inputCls}
            />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Correcting a company's details.
 *
 * Only what changed is sent. `notes` and `website` are sent as `null` when
 * cleared rather than omitted — an emptied field means "I deleted what was
 * there", and omitting it would mean "I sent nothing", which are different
 * instructions and would silently keep the old value.
 */
function CompanyForm({
  company,
  busy,
  onCancel,
  onSubmit,
}: {
  company: ExternalCompany;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (input: Record<string, unknown>) => Promise<void>;
}) {
  const [name, setName] = useState(company.name);
  const [sector, setSector] = useState(company.sector ?? "");
  const [website, setWebsite] = useState(company.website ?? "");
  const [notes, setNotes] = useState(company.notes ?? "");

  return (
    <Modal
      title="Edit company"
      subtitle={company.name}
      icon={Pencil}
      hue="grape"
      onClose={onCancel}
      onSubmit={(e) => {
        e.preventDefault();
        if (busy || name.trim() === "") return;
        void onSubmit({
          name: name.trim(),
          sector: sector.trim() === "" ? null : sector.trim(),
          website: website.trim() === "" ? null : website.trim(),
          notes: notes.trim() === "" ? null : notes.trim(),
        });
      }}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onCancel} className="ml-auto">
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={busy || name.trim() === ""}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field id="ec-name" label="Company name">
          <input id="ec-name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="ec-sector" label="Sector">
            <input id="ec-sector" value={sector} onChange={(e) => setSector(e.target.value)} className={inputCls} />
          </Field>
          <Field id="ec-website" label="Website">
            <input id="ec-website" value={website} onChange={(e) => setWebsite(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <Field id="ec-notes" label="Notes">
          <RichTextEditor
            id="ec-notes"
            value={notes}
            onChange={setNotes}
            placeholder="Anything worth knowing before somebody rings them"
          />
        </Field>
      </div>
    </Modal>
  );
}

/**
 * Correcting a person's details.
 *
 * The reason the roster is one record per person rather than one per project:
 * a number is fixed here and is right everywhere they are mapped.
 */
function PersonForm({
  person,
  onCancel,
  onSubmit,
}: {
  person: ExternalPerson;
  onCancel: () => void;
  onSubmit: (input: Record<string, unknown>) => Promise<void>;
}) {
  const [name, setName] = useState(person.name);
  const [jobTitle, setJobTitle] = useState(person.jobTitle ?? "");
  const [email, setEmail] = useState(person.email ?? "");
  const [phone, setPhone] = useState(person.phone ?? "");
  const [notes, setNotes] = useState(person.notes ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);

    try {
      await onSubmit({
        name: name.trim(),
        jobTitle: jobTitle.trim() === "" ? null : jobTitle.trim(),
        email: email.trim() === "" ? null : email.trim(),
        phone: phone.trim() === "" ? null : phone.trim(),
        notes: notes.trim() === "" ? null : notes.trim(),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Edit contact"
      subtitle={person.name}
      icon={Pencil}
      hue="grape"
      onClose={onCancel}
      onSubmit={(e) => {
        e.preventDefault();
        if (busy || name.trim() === "") return;
        void save();
      }}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onCancel} className="ml-auto">
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={busy || name.trim() === ""}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="ep-name" label="Name">
          <input
            id="ep-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label={`Name of ${person.name}`}
            className={inputCls}
          />
        </Field>
        <Field id="ep-title" label="Job title">
          <input
            id="ep-title"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            aria-label={`Job title of ${person.name}`}
            className={inputCls}
          />
        </Field>
        <Field id="ep-email" label="Email">
          <input
            id="ep-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label={`Email of ${person.name}`}
            className={inputCls}
          />
        </Field>
        <Field id="ep-phone" label="Phone">
          <input
            id="ep-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            aria-label={`Phone of ${person.name}`}
            className={inputCls}
          />
        </Field>
        <Field id="ep-notes" label="Notes" className="sm:col-span-2">
          <input
            id="ep-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            aria-label={`Notes on ${person.name}`}
            className={inputCls}
          />
        </Field>
      </div>
    </Modal>
  );
}
