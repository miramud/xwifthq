"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Briefcase, Building2, CalendarDays, GraduationCap, UserPlus, Users } from "lucide-react";
import {
  Button,
  Chip,
  Empty,
  PageHeader,
  PersonAvatar,
  SearchField,
  StatCard,
  StatGrid,
} from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import HireDialog from "@/suite/hrm/components/console/HireDialog";
import {
  hrm,
  type Employee,
  type EmploymentType,
} from "@/lib/api/hrm-client";
import {
  countdownTone,
  employmentTone,
  formatCountdown,
  formatDate,
} from "@/suite/hrm/lib/format";
import { hueFor } from "@/components/workspace/modules";
import { LoadError, PersonCell, ToneChip } from "../ui/recordKit";

/**
 * Everybody who works here.
 *
 * Opens on current staff. A directory whose default view includes every leaver
 * since the institution opened is one people stop trusting as a headcount, so
 * departed records are behind an explicit filter rather than mixed in.
 */

/*
  The tab labels *are* the filter values and the map below turns each one into
  a query. Keeping the label as the value avoids a parallel array that can fall
  out of order — the failure where a control says "Interns" and filters for
  contractors.
*/
const FILTERS = [
  "Everyone here",
  "Permanent",
  "Contract",
  "Interns",
  "Departed",
] as const;

type Filter = (typeof FILTERS)[number];

const QUERY: Record<Filter, { employmentType?: EmploymentType; includeDeparted?: boolean }> = {
  "Everyone here": {},
  Permanent: { employmentType: "permanent" },
  Contract: { employmentType: "contract" },
  Interns: { employmentType: "intern" },
  // `includeDeparted` *adds* leavers rather than showing only them, so the
  // narrowing happens client-side — see `shown` below.
  Departed: { includeDeparted: true },
};

/**
 * Two flags that are not the status and must not be folded into it: a
 * probation past its date, and a term running out. Either can be true while
 * the status reads perfectly normal.
 */
function Flags({ employee }: { employee: Employee }) {
  return (
    <>
      {employee.probationOverdue && <ToneChip tone="error">Probation overdue</ToneChip>}
      {employee.isCurrent && employee.daysUntilEnd !== null && employee.daysUntilEnd <= 60 && (
        <ToneChip tone={countdownTone(employee.daysUntilEnd)}>{formatCountdown(employee.daysUntilEnd)}</ToneChip>
      )}
    </>
  );
}

function since(employee: Employee): string {
  return employee.startedOn
    ? `From ${formatDate(employee.startedOn)}`
    : `Starts ${formatDate(employee.hiredOn)}`;
}

export default function Directory() {
  const [rows, setRows] = useState<Employee[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("Everyone here");
  const [term, setTerm] = useState("");
  const [hiring, setHiring] = useState(false);

  const load = useCallback(() => {
    return hrm.employees
      .list({ ...QUERY[filter], q: term === "" ? undefined : term, perPage: 100 })
      .then((res) => {
        setRows(res.data);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, [filter, term]);

  useEffect(() => {
    let live = true;

    void load().finally(() => {
      if (!live) return;
    });

    return () => {
      live = false;
    };
  }, [load]);

  /*
    "Departed" is the one filter the API cannot express on its own, so it is
    narrowed here. Derived rather than stored: a second piece of state holding
    the filtered list would need an effect to keep it in step, and a
    synchronous setState in an effect body is a React 19 lint error.
  */
  const shown =
    rows === null
      ? null
      : filter === "Departed"
        ? rows.filter((r) => !r.isCurrent)
        : rows;

  const current = (rows ?? []).filter((r) => r.isCurrent);
  const departments = new Set(current.map((r) => r.department).filter(Boolean)).size;
  const flagged = current.filter(
    (r) => r.probationOverdue || (r.daysUntilEnd !== null && r.daysUntilEnd <= 60),
  ).length;

  const columns: Column<Employee>[] = [
    {
      key: "name",
      header: "Name",
      primary: true,
      sortable: true,
      value: (e) => e.person.name ?? "",
      render: (e) => (
        <PersonCell
          name={e.person.name}
          src={e.person.avatar}
          sub={e.person.email ?? e.employeeNumber ?? undefined}
        />
      ),
    },
    {
      key: "role",
      header: "Role",
      sortable: true,
      value: (e) => e.jobTitle,
      render: (e) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-neutral-800">{e.jobTitle}</p>
          {e.employeeNumber && <p className="text-xs text-neutral-500">{e.employeeNumber}</p>}
        </div>
      ),
    },
    {
      key: "department",
      header: "Department",
      sortable: true,
      hideOnMobile: true,
      value: (e) => e.department ?? "",
      render: (e) =>
        e.department ? <Chip hue={hueFor(e.department)} dot>{e.department}</Chip> : <span className="text-neutral-400">-</span>,
    },
    {
      key: "type",
      header: "Type",
      sortable: true,
      hideOnMobile: true,
      value: (e) => e.employmentTypeLabel,
    },
    {
      key: "since",
      header: "Service",
      sortable: true,
      hideOnMobile: true,
      value: (e) => e.startedOn ?? e.hiredOn ?? "",
      render: (e) => <span className="whitespace-nowrap text-neutral-600">{since(e)}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      value: (e) => e.statusLabel,
      render: (e) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Flags employee={e} />
          <ToneChip tone={employmentTone(e.status)}>{e.statusLabel}</ToneChip>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Directory"
        subtitle={
          shown === null
            ? "Everybody who works here."
            : `${shown.length} ${shown.length === 1 ? "person" : "people"} · everybody who works here, with their agreement and status.`
        }
        actions={
          <Button variant="primary" icon={UserPlus} onClick={() => setHiring(true)}>
            <span className="hidden sm:inline">Take somebody on</span>
            <span className="sm:hidden">Hire</span>
          </Button>
        }
        tabs={FILTERS.map((f) => ({ key: f, label: f }))}
        activeTab={filter}
        onTab={(k) => setFilter(k as Filter)}
      />

      {rows !== null && filter === "Everyone here" && term === "" && (
        <div className="mb-6">
          <StatGrid>
            <StatCard icon={Users} hue="blue" label="People here" value={current.length} hint="Current records" />
            <StatCard icon={Building2} hue="grape" label="Departments" value={departments} hint="With somebody in them" />
            <StatCard
              icon={GraduationCap}
              hue="sky"
              label="Interns"
              value={current.filter((r) => r.employmentType === "intern").length}
              hint="On a placement"
            />
            <StatCard
              icon={AlertTriangle}
              hue={flagged > 0 ? "coral" : "mint"}
              label="Need a date"
              value={flagged}
              hint="Probation overdue or term ending in 60 days"
            />
          </StatGrid>
        </div>
      )}

      {error !== null ? (
        <LoadError message={error} />
      ) : shown === null ? (
        <div className="ws-card divide-y divide-neutral-100 overflow-hidden" aria-busy="true" aria-label="Loading">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 animate-pulse bg-neutral-50" />
          ))}
        </div>
      ) : (
        <DataView
          rows={shown}
          columns={columns}
          rowKey={(e) => e.id}
          rowHref={(e) => `/suite/hrm/people/${e.id}`}
          storageKey="hrm.people"
          caption="People in the directory"
          defaultView="table"
          // The search goes to the API, so it finds people past the first page.
          searchable={false}
          toolbar={
            <SearchField
              value={term}
              onChange={setTerm}
              placeholder="Name, email, job title…"
              label="Search people"
              className="w-full sm:w-72"
            />
          }
          empty={
            <Empty
              icon={Users}
              title={term === "" ? "Nobody here yet" : "Nobody matched that"}
              hint={
                term === ""
                  ? "Take somebody on and their record, agreement and checklist are created together."
                  : "Try a name, an email address or a job title."
              }
            />
          }
          renderCard={(e) => (
            <div className="flex h-full flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <PersonAvatar name={e.person.name ?? "Unnamed"} src={e.person.avatar} size={52} />
                <ToneChip tone={employmentTone(e.status)}>{e.statusLabel}</ToneChip>
              </div>
              <p className="mt-4 truncate text-[15px] font-semibold text-neutral-900">{e.person.name ?? "Unnamed"}</p>
              <p className="truncate text-sm text-neutral-500">{e.jobTitle}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {e.department && <Chip hue={hueFor(e.department)} icon={Building2}>{e.department}</Chip>}
                <Chip hue="slate" icon={Briefcase}>{e.employmentTypeLabel}</Chip>
                <Flags employee={e} />
              </div>
              <p className="mt-auto flex items-center gap-1.5 border-t border-neutral-100 pt-3 text-xs text-neutral-500">
                <CalendarDays size={13} aria-hidden />
                {since(e)}
                {e.employeeNumber && <span className="ml-auto tabular-nums">{e.employeeNumber}</span>}
              </p>
            </div>
          )}
          renderListItem={(e) => (
            <div className="flex items-center gap-4 px-5 py-3.5">
              <PersonAvatar name={e.person.name ?? "Unnamed"} src={e.person.avatar} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-900">{e.person.name ?? "Unnamed"}</p>
                <p className="truncate text-xs text-neutral-500">
                  {e.jobTitle}
                  {e.department ? ` · ${e.department}` : ""}
                  {e.employeeNumber ? ` · ${e.employeeNumber}` : ""}
                </p>
              </div>
              <span className="hidden w-32 shrink-0 text-xs text-neutral-500 md:block">{since(e)}</span>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                <Flags employee={e} />
                <ToneChip tone={employmentTone(e.status)}>{e.statusLabel}</ToneChip>
              </div>
            </div>
          )}
        />
      )}

      <HireDialog
        open={hiring}
        onClose={() => setHiring(false)}
        onHired={() => {
          void load();
        }}
      />
    </div>
  );
}
