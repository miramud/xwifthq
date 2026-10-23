"use client";

import { useEffect, useState } from "react";
import { BookCheck, CalendarDays, FolderKanban, ShieldAlert, TriangleAlert, Users } from "lucide-react";
import { errorText, labour, type LabourRunDetail as Run } from "@/lib/api/finance-labour-client";
import { ButtonLink, Card, Chip, Panel } from "@/components/workspace/kit";
import { BackLink, Skeleton } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { amount, compact, day, monthLabel } from "@/suite/finance/lib/format";
import { ExceptionList, LabourSplit, ProjectShares } from "./LabourParts";
import { METHOD, RUN_KIND, RUN_STATUS, hoursText } from "./meta";

/**
 * A posted labour run as it went into the books: the split, each project's
 * share, the exceptions it carried, any Finance override, and its journal.
 * People and their rates only for those allowed to see individual pay.
 */
export default function LabourRunDetail({ id }: { id: string }) {
  const [run, setRun] = useState<Run | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    labour.run(id).then(
      (r) => {
        if (!alive) return;
        setRun(r);
        setLoadError(null);
      },
      (e: unknown) => alive && setLoadError(`The run didn't load. ${errorText(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [id, reload]);

  if (loadError)
    return (
      <div>
        <BackLink href="/suite/finance/labour" label="Labour costing" />
        <LoadError text={loadError} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  if (!run)
    return (
      <div aria-busy="true">
        <BackLink href="/suite/finance/labour" label="Labour costing" />
        <p className="sr-only">Loading the run…</p>
        <Skeleton className="mb-5 h-48" />
        <Skeleton className="h-72" />
      </div>
    );

  const kind = RUN_KIND[run.kind] ?? { label: run.kind, hue: "slate" as const, hint: "" };
  const status = RUN_STATUS[run.status] ?? { label: run.status, hue: "slate" as const };

  return (
    <div>
      <BackLink href="/suite/finance/labour" label="Labour costing" />

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">{kind.label} run</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-neutral-900 sm:text-[28px]">Labour for {monthLabel(run.month)}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-neutral-600">
            <Chip hue={kind.hue}>{kind.label}</Chip>
            <Chip hue={status.hue} dot>
              {status.label}
            </Chip>
            {run.kind === "provisional" ? `Hours to ${day(run.asOf)}` : `${METHOD[run.method]?.label ?? run.method}, standard month ${run.standardHours} h`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/suite/finance/labour/${run.month}`} icon={CalendarDays}>
            Preview {monthLabel(run.month, true)}
          </ButtonLink>
          {run.journalId && (
            <ButtonLink href={`/suite/finance/journals/${run.journalId}`} icon={BookCheck} variant="primary">
              Open journal
            </ButtonLink>
          )}
        </div>
      </div>

      {run.status === "reversed" && (
        <p className="mb-5 rounded-xl bg-neutral-100 px-4 py-3 text-sm text-neutral-700">
          This run was reversed: a later allocation or provisional charge for {monthLabel(run.month)} replaced it. Its journal stays in the books with its reversal beside it.
        </p>
      )}

      {run.override && (
        <div className="mb-5 flex items-start gap-3 rounded-[1.125rem] border border-sun-500/25 bg-sun-50 p-4 text-sm text-sun-700">
          <ShieldAlert size={18} aria-hidden className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Posted with a Finance override</p>
            <p className="mt-0.5 text-neutral-700">{run.override}</p>
          </div>
        </div>
      )}

      <Card className="mb-5 p-5 sm:p-6">
        <div className="mb-5">
          <p className="text-sm font-medium text-neutral-500">{run.kind === "provisional" ? "Charged provisionally" : "Loaded payroll cost"}</p>
          <p className="mt-1 text-[36px] font-bold leading-none tracking-tight tabular-nums text-neutral-900">{compact(run.loaded)}</p>
          <p className="mt-1 text-xs tabular-nums text-neutral-500">{amount(run.loaded)}</p>
        </div>
        <LabourSplit loaded={run.loaded} allocated={run.allocated} bench={run.bench} />
      </Card>

      <div className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel title="Projects" subtitle={`${run.projects.length} charged`} icon={FolderKanban} bodyClassName="p-0 pt-4">
          <ProjectShares caption={`Labour charged to each project, ${monthLabel(run.month)}`} rows={run.projects.map((x) => ({ ...x }))} />
        </Panel>
        <Panel title="Exceptions" subtitle={run.exceptions.length ? `${run.exceptions.length} carried by this run` : "None"} icon={TriangleAlert} hue="sun">
          <ExceptionList exceptions={run.exceptions} />
        </Panel>
      </div>

      {run.seesPeople && run.people && (
        <Panel title="People" subtitle="Each person's hourly rate, hours and where their cost went" icon={Users} hue="grape" bodyClassName="p-0 pt-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <caption className="sr-only">People in the run, with hourly rates, hours, project and bench cost</caption>
              <thead>
                <tr className="border-y border-neutral-100 bg-neutral-50/70 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  <th scope="col" className="py-2.5 pl-5 pr-3">Person</th>
                  <th scope="col" className="px-3 py-2.5 text-right">Hourly rate</th>
                  <th scope="col" className="px-3 py-2.5 text-right">Hours</th>
                  <th scope="col" className="px-3 py-2.5">Projects</th>
                  <th scope="col" className="px-3 py-2.5 text-right">To projects</th>
                  <th scope="col" className="py-2.5 pl-3 pr-5 text-right">Bench</th>
                </tr>
              </thead>
              <tbody>
                {run.people.map((x) => (
                  <tr key={x.userId} className="border-b border-neutral-100 align-top last:border-b-0">
                    <td className="py-3 pl-5 pr-3 font-semibold text-neutral-900">{x.name ?? "Someone"}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-neutral-700">{amount(x.hourlyRate)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-neutral-700">{hoursText(x.hours)}</td>
                    <td className="px-3 py-3 text-xs text-neutral-700">
                      {x.lines.length === 0 ? <span className="text-neutral-500">None</span> : x.lines.map((l) => `${l.project ?? "A project"} (${hoursText(l.hours)})`).join(", ")}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums text-neutral-900">{amount(x.projects)}</td>
                    <td className="whitespace-nowrap py-3 pl-3 pr-5 text-right tabular-nums text-neutral-700">{amount(x.bench)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
