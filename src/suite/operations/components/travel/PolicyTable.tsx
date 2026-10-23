"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Globe2, Info, MapPin, PencilLine } from "lucide-react";
import { Button, Card, PageHeader, cx } from "@/components/workspace/kit";
import { HUE } from "@/components/workspace/modules";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { BackLink, ErrorNote, Field, Skeleton } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { FieldError, LoadError } from "@/suite/org/components/foundations/shared";
import { Money } from "@/suite/finance/components/banking/ui";
import { useAuth } from "@/lib/auth-store";
import { mayDoOps } from "@/suite/operations/lib/operations-access";
import { opsError, opsFieldErrors, travel, type PolicyRate, type TravelPolicyTable } from "@/lib/api/operations-travel-client";
import { isInternational } from "./cost";
import { FLIGHT_CLASS } from "./labels";
import { MoneyInput } from "./shared";
import StaffGrades from "./StaffGrades";

/**
 * The travel policy: what each grade gets in each class of destination -
 * DTA a day, a hotel cap a night, the airport taxi and the flight class.
 * Every trip is costed from this table; changes apply to trips costed after.
 * Under it, each member of staff's grade, which a trip starts them at.
 */

type Rate = PolicyRate & { id: string };

export default function PolicyTable() {
  const { user } = useAuth();
  const [table, setTable] = useState<TravelPolicyTable | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState<Rate | null>(null);
  const canEdit = mayDoOps(user, "travel_desk", "update_rate");
  const canGrade = mayDoOps(user, "travel_desk", "set_grade");

  useEffect(() => {
    let alive = true;
    travel.desk.policy().then(
      (t) => {
        if (!alive) return;
        setTable(t);
        setError(null);
      },
      (e: unknown) => alive && setError(`The travel policy didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  const grades = useMemo(() => Object.entries(table?.grades ?? {}), [table]);
  const classes = useMemo(() => Object.entries(table?.classes ?? {}), [table]);
  const cell = (grade: string, cls: string) => table?.rates.find((r) => r.grade === grade && r.destinationClass === cls) ?? null;

  return (
    <div>
      <BackLink href="/suite/operations/travel" label="Travel desk" />
      <PageHeader
        title="Travel policy"
        subtitle="What each grade is paid in each class of destination. Trips are costed from this table when they are saved."
      />

      {error && !table && <LoadError text={error} onRetry={() => setReload((k) => k + 1)} />}

      {!table && !error && (
        <div aria-busy="true">
          <p className="sr-only">Loading the travel policy…</p>
          <Skeleton className="h-[520px]" />
        </div>
      )}

      {table && (
        <div className="space-y-5">
          <p className="flex items-start gap-2 text-sm text-neutral-600">
            <Info size={16} className="mt-0.5 shrink-0 text-primary-600" aria-hidden />
            DTA is paid for every day away, the hotel for every night, and the airport taxi twice when a leg flies or the trip is abroad. Costs above these need a justification and the MD.
          </p>

          {/* The matrix from `lg` up: destinations down, grades across. */}
          <Card className="hidden overflow-hidden lg:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Travel policy rates by destination class and grade</caption>
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50/70">
                    <th scope="col" className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Destination
                    </th>
                    {grades.map(([g, label]) => (
                      <th key={g} scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {classes.map(([c, label]) => (
                    <tr key={c} className="align-top">
                      <th scope="row" className="px-5 py-4 text-left">
                        <ClassName cls={c} label={label} />
                      </th>
                      {grades.map(([g, gLabel]) => {
                        const r = cell(g, c);
                        return (
                          <td key={g} className="px-4 py-4 text-right">
                            {r ? <RateCell rate={r} onEdit={canEdit ? () => setEditing(r) : undefined} name={`${gLabel}, ${label}`} /> : <span className="text-neutral-400">-</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Below `lg`: a card per destination, one row per grade. */}
          <div className="grid gap-4 sm:grid-cols-2 lg:hidden">
            {classes.map(([c, label]) => (
              <Card key={c} className="p-5">
                <ClassName cls={c} label={label} />
                <ul className="mt-4 divide-y divide-neutral-100">
                  {grades.map(([g, gLabel]) => {
                    const r = cell(g, c);
                    return (
                      <li key={g} className="flex items-start justify-between gap-3 py-3">
                        <span className="text-sm font-semibold text-neutral-800">{gLabel}</span>
                        {r ? <RateCell rate={r} onEdit={canEdit ? () => setEditing(r) : undefined} name={`${gLabel}, ${label}`} /> : <span className="text-neutral-400">-</span>}
                      </li>
                    );
                  })}
                </ul>
              </Card>
            ))}
          </div>
        </div>
      )}

      {table && (
        <div className="mt-6">
          <StaffGrades canEdit={canGrade} />
        </div>
      )}

      {editing && table && (
        <RateDialog
          rate={editing}
          gradeLabel={table.grades[editing.grade] ?? editing.grade}
          classLabel={table.classes[editing.destinationClass] ?? editing.destinationClass}
          onClose={() => setEditing(null)}
          onSaved={(r) => {
            setTable({ ...table, rates: table.rates.map((x) => (x.id === r.id ? r : x)) });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function ClassName({ cls, label }: { cls: string; label: string }) {
  const intl = isInternational(cls);
  const Icon = intl ? Globe2 : MapPin;
  return (
    <span className="flex items-center gap-2.5">
      <span className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", intl ? HUE.grape.soft : HUE.sky.soft)}>
        <Icon size={15} aria-hidden />
      </span>
      <span>
        <span className="block text-sm font-semibold text-neutral-900">{label}</span>
        <span className="block text-xs font-normal text-neutral-500">{intl ? "International" : "Local"}</span>
      </span>
    </span>
  );
}

function RateCell({ rate, onEdit, name }: { rate: Rate; onEdit?: () => void; name: string }) {
  return (
    <div className="text-right">
      <dl className="space-y-0.5 text-xs text-neutral-500">
        <div>
          <dt className="sr-only">DTA a day</dt>
          <dd>
            <Money value={rate.dtaDaily} className="text-sm font-semibold text-neutral-900" /> <span aria-hidden>/day</span>
          </dd>
        </div>
        <div>
          <dt className="sr-only">Hotel a night</dt>
          <dd>
            <Money value={rate.hotelNightly} className="font-medium text-neutral-700" /> <span aria-hidden>/night</span>
          </dd>
        </div>
        <div>
          <dt className="sr-only">Airport taxi</dt>
          <dd>
            taxi <Money value={rate.airportTaxi} className="font-medium text-neutral-700" />
          </dd>
        </div>
        <div>
          <dt className="sr-only">Flight class</dt>
          <dd className={rate.flightClass === "business" ? "font-semibold text-grape-700" : undefined}>{FLIGHT_CLASS[rate.flightClass] ?? rate.flightClass}</dd>
        </div>
      </dl>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit the rate for ${name}`}
          className="mt-1.5 inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-lg px-2 text-xs font-semibold text-primary-700 outline-none hover:bg-primary-50 focus-visible:ring-2 focus-visible:ring-primary-300"
        >
          <PencilLine size={13} aria-hidden />
          Edit
        </button>
      )}
    </div>
  );
}

function RateDialog({
  rate,
  gradeLabel,
  classLabel,
  onClose,
  onSaved,
}: {
  rate: Rate;
  gradeLabel: string;
  classLabel: string;
  onClose: () => void;
  onSaved: (r: Rate) => void;
}) {
  const uid = useId();
  const [dta, setDta] = useState<number | null>(rate.dtaDaily);
  const [hotel, setHotel] = useState<number | null>(rate.hotelNightly);
  const [taxi, setTaxi] = useState<number | null>(rate.airportTaxi);
  const [flight, setFlight] = useState(String(rate.flightClass));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (dta === null) found.dtaDaily = "Enter the DTA a day.";
    if (hotel === null) found.hotelNightly = "Enter the hotel cap a night.";
    if (taxi === null) found.airportTaxi = "Enter the airport taxi.";
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    setError(null);
    const next = { dtaDaily: dta ?? 0, hotelNightly: hotel ?? 0, airportTaxi: taxi ?? 0, flightClass: flight };
    try {
      await travel.desk.updateRate(rate.id, next);
      onSaved({ ...rate, ...next });
    } catch (err) {
      setErrors(opsFieldErrors(err));
      setError(opsError(err));
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      titleId={`${uid}-title`}
      title={`${gradeLabel}: ${classLabel}`}
      subtitle="Applies to trips costed from now on. Trips already saved keep their figures."
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Saving…" : "Save the rate"}
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${uid}-dta`} label="DTA a day (₦)">
          <MoneyInput id={`${uid}-dta`} value={dta} onChange={setDta} invalid={Boolean(errors.dtaDaily)} />
          <FieldError message={errors.dtaDaily} />
        </Field>
        <Field id={`${uid}-hotel`} label="Hotel a night (₦)">
          <MoneyInput id={`${uid}-hotel`} value={hotel} onChange={setHotel} invalid={Boolean(errors.hotelNightly)} />
          <FieldError message={errors.hotelNightly} />
        </Field>
        <Field id={`${uid}-taxi`} label="Airport taxi, each way (₦)">
          <MoneyInput id={`${uid}-taxi`} value={taxi} onChange={setTaxi} invalid={Boolean(errors.airportTaxi)} />
          <FieldError message={errors.airportTaxi} />
        </Field>
        <Field id={`${uid}-flight`} label="Flight class">
          <SearchableSelect
            id={`${uid}-flight`}
            value={flight}
            onChange={setFlight}
            options={Object.entries(FLIGHT_CLASS).map(([value, label]) => ({ value, label }))}
            searchPlaceholder="Search classes"
          />
          <FieldError message={errors.flightClass} />
        </Field>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
    </DialogFrame>
  );
}
