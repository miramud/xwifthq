"use client";

import { useId, useState } from "react";
import { Button, Segmented } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { ErrorNote, Field, inputClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { FieldError } from "@/suite/org/components/foundations/shared";
import { opsError, opsFieldErrors, travel, type BookingInput, type NamedRef, type TripFull } from "@/lib/api/operations-travel-client";
import { MoneyInput } from "./shared";

/** The desk records what it booked: a flight, a hotel or ground transport, with the PNR or confirmation. */
export default function BookingDialog({
  trip,
  vendors,
  onDone,
  onClose,
}: {
  trip: TripFull;
  vendors: NamedRef[] | null;
  onDone: (trip: TripFull) => void;
  onClose: () => void;
}) {
  const uid = useId();
  const [kind, setKind] = useState<BookingInput["kind"]>("flight");
  const [travellerId, setTravellerId] = useState("");
  const [agencyId, setAgencyId] = useState("");
  const [reference, setReference] = useState("");
  const [details, setDetails] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onDone(
        await travel.desk.book(trip.id, {
          kind,
          travellerId: travellerId || null,
          agencyId: agencyId || null,
          reference: reference.trim() || null,
          details: details.trim() || null,
          amount: amount ?? 0,
        }),
      );
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
      title="Record a booking"
      subtitle={`${trip.number ?? "Trip"} to ${trip.destination}`}
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Saving…" : "Record the booking"}
          </Button>
        </div>
      }
    >
      <Segmented
        label="What was booked"
        value={kind}
        onChange={setKind}
        options={[
          { key: "flight", label: "Flight" },
          { key: "hotel", label: "Hotel" },
          { key: "ground", label: "Ground" },
        ]}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${uid}-who`} label="Traveller" hint="Optional">
          <SearchableSelect
            id={`${uid}-who`}
            value={travellerId}
            onChange={setTravellerId}
            options={trip.travellers.map((t) => ({ value: t.userId, label: t.name ?? "Traveller" }))}
            clearable
            clearLabel="Everyone on the trip"
            placeholder="Everyone on the trip"
            searchPlaceholder="Search travellers"
          />
        </Field>
        <Field id={`${uid}-agency`} label="Agency or supplier" hint="Optional">
          <SearchableSelect
            id={`${uid}-agency`}
            value={agencyId}
            onChange={setAgencyId}
            options={(vendors ?? []).map((v) => ({ value: v.id, label: v.name }))}
            clearable
            placeholder={vendors === null ? "Loading suppliers…" : "Booked directly"}
            clearLabel="Booked directly"
            searchPlaceholder="Search suppliers"
            noOptionsText={vendors === null ? "Loading suppliers…" : "No active suppliers."}
          />
          <FieldError message={errors.agencyId} />
        </Field>
      </div>
      <Field id={`${uid}-ref`} label={kind === "flight" ? "PNR or ticket number" : kind === "hotel" ? "Confirmation number" : "Reference"} hint="Optional">
        <input
          id={`${uid}-ref`}
          className={`${inputClass} font-mono`}
          value={reference}
          maxLength={120}
          autoComplete="off"
          onChange={(e) => setReference(e.target.value)}
          placeholder={kind === "flight" ? "PNR K7XQ2M" : kind === "hotel" ? "CONF-88412" : ""}
        />
        <FieldError message={errors.reference} />
      </Field>
      <Field id={`${uid}-details`} label="Details" hint="Optional">
        <input
          id={`${uid}-details`}
          className={inputClass}
          value={details}
          maxLength={255}
          onChange={(e) => setDetails(e.target.value)}
          placeholder={kind === "flight" ? "Air Peace P7 7121 / 7124, economy" : kind === "hotel" ? "Two rooms, two nights" : "Airport pick-up and drop-off"}
        />
        <FieldError message={errors.details} />
      </Field>
      <Field id={`${uid}-amount`} label="Amount (₦)">
        <MoneyInput id={`${uid}-amount`} value={amount} onChange={setAmount} invalid={Boolean(errors.amount)} />
        <FieldError message={errors.amount} />
      </Field>
      {error && <ErrorNote>{error}</ErrorNote>}
    </DialogFrame>
  );
}
