"use client";

import { useEffect, useId, useState } from "react";
import { Button, Segmented, cx } from "@/components/workspace/kit";
import { SearchableSelect, type SelectOption } from "@/components/workspace/SearchableSelect";
import { DialogFrame } from "@/suite/org/components/ui";
import { ErrorNote, Field, Switch, inputClass } from "@/suite/lms/components/ui/ws";
import { FieldError } from "@/suite/org/components/foundations/shared";
import { amount as money } from "@/suite/finance/lib/format";
import { ChargeTo, MoneyInput, type Funding } from "@/suite/operations/components/travel/shared";
import type { OpsOptions } from "@/lib/api/operations-travel-client";
import { fleet, opsError, opsFieldErrors, type FleetOptions, type FuelType, type PaidVia, type PaperKind, type Vehicle } from "@/lib/api/operations-fleet-client";
import { FUEL_LABEL, PAID_VIA_LABEL, Plate } from "./parts";

/* The fleet's forms: a vehicle, a trip, a fuel entry, and approving a pool booking. */

type Errors = Record<string, string>;

function apiErrors(e: unknown): Errors {
  const f = opsFieldErrors(e);
  return Object.keys(f).length ? f : { general: opsError(e) };
}

function Footer({ onClose, busy, label, busyLabel = "Saving…" }: { onClose: () => void; busy: boolean; label: string; busyLabel?: string }) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button onClick={onClose}>Cancel</Button>
      <Button type="submit" variant="primary" disabled={busy}>
        {busy ? busyLabel : label}
      </Button>
    </div>
  );
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

let optionsCache: Promise<FleetOptions> | null = null;

/** Staff, vendors, projects and cost centres, loaded once per page visit. Null while loading. */
export function useFleetOptions(): FleetOptions | null {
  const [o, setO] = useState<FleetOptions | null>(null);
  useEffect(() => {
    let alive = true;
    optionsCache ??= fleet.options();
    optionsCache.then(
      (d) => alive && setO(d),
      () => {
        optionsCache = null;
        if (alive) setO({ staff: [], vendors: [], projects: [], costCentres: [] });
      },
    );
    return () => {
      alive = false;
    };
  }, []);
  return o;
}

/** For tests. */
export function resetFleetOptions() {
  optionsCache = null;
}

const staffOptions = (o: FleetOptions | null): SelectOption[] => (o?.staff ?? []).map((s) => ({ value: s.id, label: s.name }));

/* ------------------------------ vehicle ----------------------------- */

const PAPER_KINDS: PaperKind[] = ["licence", "roadworthiness", "insurance", "hackney"];

export function VehicleDialog({
  vehicle,
  unregistered,
  papers,
  onClose,
  onDone,
}: {
  vehicle: Vehicle | null;
  unregistered: { id: string; tagNo: string | null; name: string }[];
  papers: Record<string, string>;
  onClose: () => void;
  onDone: (v: Vehicle, message: string) => void;
}) {
  const uid = useId();
  const options = useFleetOptions();
  const [assetId, setAssetId] = useState(unregistered.length === 1 ? unregistered[0].id : "");
  const [reg, setReg] = useState(vehicle?.registrationNo ?? "");
  const [chassis, setChassis] = useState(vehicle?.chassisNo ?? "");
  const [engine, setEngine] = useState(vehicle?.engineNo ?? "");
  const [driverId, setDriverId] = useState(vehicle?.driverId ?? "");
  const [pool, setPool] = useState(vehicle?.pool ?? true);
  const [fuel, setFuel] = useState<FuelType>(vehicle?.fuelType ?? "petrol");
  const [kpl, setKpl] = useState(vehicle?.expectedKmPerLitre ? String(vehicle.expectedKmPerLitre) : "");
  const [odo, setOdo] = useState(vehicle ? String(vehicle.odometer) : "");
  const [kinds, setKinds] = useState<PaperKind[]>(["licence", "roadworthiness", "insurance"]);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const local: Errors = {};
    if (!vehicle && !assetId) local.assetId = "Choose the vehicle on the asset register.";
    if (!reg.trim()) local.registrationNo = "Enter the registration number.";
    const k = kpl.trim() ? Number(kpl) : null;
    if (k !== null && (!Number.isFinite(k) || k < 0)) local.expectedKmPerLitre = "A number, like 9.5.";
    const o = odo.trim() ? Number(odo.replace(/,/g, "")) : null;
    if (o !== null && (!Number.isInteger(o) || o < 0)) local.odometer = "Whole km, like 48210.";
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      const input = {
        registrationNo: reg.trim().toUpperCase(),
        chassisNo: chassis.trim() || null,
        engineNo: engine.trim() || null,
        driverId: driverId || null,
        pool,
        fuelType: fuel,
        expectedKmPerLitre: k,
        ...(o !== null ? { odometer: o } : {}),
      };
      const v = vehicle ? await fleet.update(vehicle.id, input) : await fleet.create({ ...input, assetId, papers: kinds });
      onDone(v, vehicle ? `${v.registrationNo} saved.` : `${v.registrationNo} added. Its papers are on the compliance register; record each one there.`);
    } catch (e) {
      setErrors(apiErrors(e));
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      size="lg"
      titleId={`${uid}-t`}
      title={vehicle ? `Edit ${vehicle.registrationNo}` : "Add a vehicle"}
      subtitle={vehicle ? undefined : "A vehicle already on the asset register, with its registration, driver and fuel."}
      onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} label={vehicle ? "Save vehicle" : "Add vehicle"} />}
    >
      {errors.general && <ErrorNote>{errors.general}</ErrorNote>}
      {!vehicle && (
        <Field id={`${uid}-asset`} label="Vehicle on the register">
          <SearchableSelect
            id={`${uid}-asset`}
            value={assetId}
            onChange={setAssetId}
            options={unregistered.map((a) => ({ value: a.id, label: a.name, hint: a.tagNo ?? undefined }))}
            placeholder="Choose the vehicle"
            searchPlaceholder="Search by name or tag"
            noOptionsText="Every vehicle on the register is in the fleet. Add new ones to the register first."
            aria-invalid={errors.assetId ? true : undefined}
          />
          <FieldError message={errors.assetId} />
        </Field>
      )}
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <Field id={`${uid}-reg`} label="Registration number">
          <input id={`${uid}-reg`} className={cx(inputClass, "font-mono uppercase")} value={reg} maxLength={20} onChange={(e) => setReg(e.target.value)} placeholder="ABC-123-XY" aria-invalid={errors.registrationNo ? true : undefined} />
          <FieldError message={errors.registrationNo} />
        </Field>
        {reg.trim() && <Plate number={reg.trim().toUpperCase()} className="justify-self-start" />}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${uid}-chassis`} label="Chassis number" hint="Optional">
          <input id={`${uid}-chassis`} className={cx(inputClass, "font-mono")} value={chassis} maxLength={40} onChange={(e) => setChassis(e.target.value)} />
        </Field>
        <Field id={`${uid}-engine`} label="Engine number" hint="Optional">
          <input id={`${uid}-engine`} className={cx(inputClass, "font-mono")} value={engine} maxLength={40} onChange={(e) => setEngine(e.target.value)} />
        </Field>
        <Field id={`${uid}-driver`} label="Driver" hint="Optional">
          <SearchableSelect id={`${uid}-driver`} value={driverId} onChange={setDriverId} options={staffOptions(options)} clearable clearLabel="No regular driver" placeholder="No regular driver" searchPlaceholder="Search staff" />
          <FieldError message={errors.driverId} />
        </Field>
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-200/80 bg-neutral-50/50 px-4 py-3">
          <span>
            <span className="block text-sm font-medium text-neutral-800">Pool vehicle</span>
            <span className="block text-xs text-neutral-500">Staff can book it. Otherwise it stays with its driver.</span>
          </span>
          <Switch checked={pool} onChange={setPool} label="Pool vehicle" />
        </div>
      </div>
      <div className="space-y-3">
        <Segmented label="Fuel" value={fuel} onChange={setFuel} options={(Object.keys(FUEL_LABEL) as FuelType[]).map((f) => ({ key: f, label: FUEL_LABEL[f] }))} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${uid}-kpl`} label="Expected km per litre" hint="Optional. Its own average otherwise">
            <input id={`${uid}-kpl`} inputMode="decimal" className={inputClass} value={kpl} onChange={(e) => setKpl(e.target.value)} placeholder="9.5" aria-invalid={errors.expectedKmPerLitre ? true : undefined} />
            <FieldError message={errors.expectedKmPerLitre} />
          </Field>
          <Field id={`${uid}-odo`} label="Odometer (km)">
            <input id={`${uid}-odo`} inputMode="numeric" className={inputClass} value={odo} onChange={(e) => setOdo(e.target.value)} placeholder="48210" aria-invalid={errors.odometer ? true : undefined} />
            <FieldError message={errors.odometer} />
          </Field>
        </div>
      </div>
      {!vehicle && (
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-neutral-700">Papers to track</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {PAPER_KINDS.map((k) => (
              <label key={k} className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-2xl border border-neutral-200/80 px-3 text-sm text-neutral-800 hover:border-neutral-300">
                <input type="checkbox" className="h-4 w-4 accent-primary-600" checked={kinds.includes(k)} onChange={(e) => setKinds((cur) => (e.target.checked ? [...cur, k] : cur.filter((x) => x !== k)))} />
                {papers[k] ?? k}
              </label>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-neutral-500">Each goes on the compliance register as a certificate, with expiry reminders.</p>
        </fieldset>
      )}
    </DialogFrame>
  );
}

/* ------------------------------- trip ------------------------------- */

export function TripDialog({ vehicle, onClose, onDone }: { vehicle: Vehicle; onClose: () => void; onDone: (message: string) => void }) {
  const uid = useId();
  const options = useFleetOptions();
  const [tripOn, setTripOn] = useState(today());
  const [purpose, setPurpose] = useState("");
  const [funding, setFunding] = useState<Funding>("project");
  const [projectId, setProjectId] = useState("");
  const [costCentreId, setCostCentreId] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [start, setStart] = useState(String(vehicle.odometer || ""));
  const [end, setEnd] = useState("");
  const [driverId, setDriverId] = useState(vehicle.driverId ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const s = Number(start.replace(/,/g, ""));
  const e2 = Number(end.replace(/,/g, ""));
  const km = start.trim() && end.trim() && Number.isFinite(s) && Number.isFinite(e2) ? e2 - s : null;

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const local: Errors = {};
    if (!purpose.trim()) local.purpose = "Say what the trip was for.";
    if (!start.trim() || !Number.isInteger(s) || s < 0) local.startOdometer = "Whole km at the start.";
    if (!end.trim() || !Number.isInteger(e2) || e2 < 0) local.endOdometer = "Whole km at the end.";
    else if (e2 <= s) local.endOdometer = "The odometer at the end is more than at the start.";
    if (funding === "project" ? !projectId : !costCentreId) local.projectId = funding === "project" ? "Choose the project to charge." : "Choose the cost centre to charge.";
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      const r = await fleet.addTrip(vehicle.id, {
        tripOn,
        purpose: purpose.trim(),
        projectId: funding === "project" ? projectId : null,
        costCentreId: funding === "costCentre" ? costCentreId : null,
        origin: origin.trim() || null,
        destination: destination.trim() || null,
        startOdometer: s,
        endOdometer: e2,
        driverId: driverId || null,
      });
      onDone(`Trip logged: ${e2 - s} km. The odometer reads ${r.odometer.toLocaleString("en-GB")} km.`);
    } catch (e) {
      setErrors(apiErrors(e));
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      size="lg"
      titleId={`${uid}-t`}
      title="Log a trip"
      subtitle={`${vehicle.registrationNo}: the odometer feeds its km-based servicing.`}
      onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} label="Log trip" />}
    >
      {errors.general && <ErrorNote>{errors.general}</ErrorNote>}
      <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <Field id={`${uid}-on`} label="Date">
          <input id={`${uid}-on`} type="date" className={inputClass} value={tripOn} max={today()} onChange={(e) => setTripOn(e.target.value)} />
          <FieldError message={errors.tripOn} />
        </Field>
        <Field id={`${uid}-purpose`} label="Purpose">
          <input id={`${uid}-purpose`} className={inputClass} value={purpose} maxLength={255} onChange={(e) => setPurpose(e.target.value)} placeholder="Site survey at the Eastgate plant" aria-invalid={errors.purpose ? true : undefined} />
          <FieldError message={errors.purpose} />
        </Field>
        <Field id={`${uid}-from`} label="From" hint="Optional">
          <input id={`${uid}-from`} className={inputClass} value={origin} maxLength={160} onChange={(e) => setOrigin(e.target.value)} placeholder="Head office" />
        </Field>
        <Field id={`${uid}-to`} label="To" hint="Optional">
          <input id={`${uid}-to`} className={inputClass} value={destination} maxLength={160} onChange={(e) => setDestination(e.target.value)} placeholder="Eastgate, Kubwa" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id={`${uid}-start`} label="Odometer at start">
          <input id={`${uid}-start`} inputMode="numeric" className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} aria-invalid={errors.startOdometer ? true : undefined} />
          <FieldError message={errors.startOdometer} />
        </Field>
        <Field id={`${uid}-end`} label="Odometer at end">
          <input id={`${uid}-end`} inputMode="numeric" className={inputClass} value={end} onChange={(e) => setEnd(e.target.value)} aria-invalid={errors.endOdometer ? true : undefined} />
          <FieldError message={errors.endOdometer} />
        </Field>
        <div>
          <p className="mb-1.5 text-sm font-medium text-neutral-700">Distance</p>
          <p className={cx("flex h-11 items-center rounded-xl px-3.5 text-sm font-semibold tabular-nums", km !== null && km > 0 ? "bg-sky-50 text-sky-700" : "bg-neutral-50 text-neutral-500")}>{km !== null && km > 0 ? `${km.toLocaleString("en-GB")} km` : "-"}</p>
        </div>
      </div>
      <ChargeTo
        idPrefix={uid}
        options={options as unknown as OpsOptions | null}
        funding={funding}
        projectId={projectId}
        costCentreId={costCentreId}
        onFunding={setFunding}
        onProject={setProjectId}
        onCostCentre={setCostCentreId}
        error={errors.projectId ?? errors.costCentreId}
      />
      <Field id={`${uid}-driver`} label="Driver">
        <SearchableSelect id={`${uid}-driver`} value={driverId} onChange={setDriverId} options={staffOptions(options)} clearable clearLabel="Its regular driver, or you" placeholder="Its regular driver, or you" searchPlaceholder="Search staff" />
      </Field>
    </DialogFrame>
  );
}

/* ------------------------------- fuel ------------------------------- */

export function FuelDialog({ vehicle, onClose, onDone }: { vehicle: Vehicle; onClose: () => void; onDone: (message: string) => void }) {
  const uid = useId();
  const options = useFleetOptions();
  const [enteredOn, setEnteredOn] = useState(today());
  const [litres, setLitres] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [paidVia, setPaidVia] = useState<PaidVia | "">("card");
  const [vendorId, setVendorId] = useState("");
  const [reading, setReading] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const l = Number(litres.replace(/,/g, ""));
  const perLitre = amount && l > 0 ? Math.round(amount / l) : null;

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const local: Errors = {};
    if (!litres.trim() || !Number.isFinite(l) || l < 0.1) local.litres = "How many litres?";
    const r = reading.trim() ? Number(reading.replace(/,/g, "")) : null;
    if (r !== null && (!Number.isFinite(r) || r < 0)) local.reading = "Whole km, like 48210.";
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      await fleet.addFuel(vehicle.id, { enteredOn, litres: l, amount: amount ?? 0, paidVia: paidVia || null, vendorId: vendorId || null, reading: r });
      onDone(`${l} litres recorded for ${vehicle.registrationNo}.`);
    } catch (e) {
      setErrors(apiErrors(e));
      setBusy(false);
    }
  };

  return (
    <DialogFrame as="form" onSubmit={submit} titleId={`${uid}-t`} title="Record fuel" subtitle={vehicle.registrationNo} onClose={onClose} footer={<Footer onClose={onClose} busy={busy} label="Record fuel" />}>
      {errors.general && <ErrorNote>{errors.general}</ErrorNote>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${uid}-on`} label="Date">
          <input id={`${uid}-on`} type="date" className={inputClass} value={enteredOn} max={today()} onChange={(e) => setEnteredOn(e.target.value)} />
        </Field>
        <Field id={`${uid}-l`} label="Litres">
          <input id={`${uid}-l`} inputMode="decimal" className={inputClass} value={litres} onChange={(e) => setLitres(e.target.value)} placeholder="40" aria-invalid={errors.litres ? true : undefined} />
          <FieldError message={errors.litres} />
        </Field>
        <Field id={`${uid}-amt`} label="Amount paid" hint={perLitre ? `${money(perLitre)} a litre` : undefined}>
          <MoneyInput id={`${uid}-amt`} value={amount} onChange={setAmount} />
          <FieldError message={errors.amount} />
        </Field>
        <Field id={`${uid}-via`} label="Paid with">
          <SearchableSelect id={`${uid}-via`} value={paidVia} onChange={(v) => setPaidVia(v as PaidVia | "")} options={(Object.keys(PAID_VIA_LABEL) as PaidVia[]).map((p) => ({ value: p, label: PAID_VIA_LABEL[p] }))} clearable clearLabel="Not recorded" />
        </Field>
        <Field id={`${uid}-vendor`} label="Filling station" hint="Optional">
          <SearchableSelect id={`${uid}-vendor`} value={vendorId} onChange={setVendorId} options={(options?.vendors ?? []).map((v) => ({ value: v.id, label: v.name }))} clearable clearLabel="Not a listed vendor" placeholder="Not a listed vendor" searchPlaceholder="Search vendors" />
          <FieldError message={errors.vendorId} />
        </Field>
        <Field id={`${uid}-odo`} label="Odometer" hint="Optional">
          <input id={`${uid}-odo`} inputMode="numeric" className={inputClass} value={reading} onChange={(e) => setReading(e.target.value)} placeholder={String(vehicle.odometer || "")} aria-invalid={errors.reading ? true : undefined} />
          <FieldError message={errors.reading} />
        </Field>
      </div>
    </DialogFrame>
  );
}

/* ----------------------------- booking ------------------------------ */

export function ApproveBookingDialog({
  booking,
  onClose,
  onDone,
}: {
  booking: { id: string; registrationNo: string | null; purpose: string; requestedBy: string | null };
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const uid = useId();
  const options = useFleetOptions();
  const [driverId, setDriverId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await fleet.decide(booking.id, true, driverId || null);
      onDone(`Booking approved${booking.registrationNo ? ` on ${booking.registrationNo}` : ""}.`);
    } catch (e) {
      setError(opsError(e));
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      titleId={`${uid}-t`}
      title="Approve the booking"
      subtitle={`${booking.purpose}${booking.requestedBy ? ` · for ${booking.requestedBy}` : ""}`}
      onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} label="Approve booking" busyLabel="Approving…" />}
    >
      {error && <ErrorNote>{error}</ErrorNote>}
      <Field id={`${uid}-driver`} label="Driver" hint="Optional">
        <SearchableSelect id={`${uid}-driver`} value={driverId} onChange={setDriverId} options={staffOptions(options)} clearable clearLabel="They drive themselves" placeholder="They drive themselves" searchPlaceholder="Search staff" />
      </Field>
    </DialogFrame>
  );
}
