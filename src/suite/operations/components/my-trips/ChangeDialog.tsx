"use client";

import { useId, useState } from "react";
import { Button, Segmented } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { ErrorNote, Field, textareaClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { FieldError } from "@/suite/org/components/foundations/shared";
import { opsError, opsFieldErrors, travel, type TripFull } from "@/lib/api/operations-travel-client";
import { BOOKING_KIND } from "../travel/labels";
import { MoneyInput, optionsFrom } from "../travel/shared";

/**
 * Ask to change or cancel a trip. Nothing happens at the agency until it is
 * approved; the reason and the fee are kept so the cost of changes shows by
 * reason and project.
 */
export default function ChangeDialog({
  trip,
  reasons,
  onDone,
  onClose,
}: {
  trip: TripFull;
  reasons: Record<string, string>;
  onDone: (trip: TripFull) => void;
  onClose: () => void;
}) {
  const uid = useId();
  const [kind, setKind] = useState<"change" | "cancellation">("change");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [fee, setFee] = useState<number | null>(null);
  const [bookingId, setBookingId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const bookings = trip.bookings
    .filter((b) => b.status !== "cancelled")
    .map((b) => ({ value: b.id, label: `${BOOKING_KIND[b.kind]?.label ?? b.kind}${b.reference ? `: ${b.reference}` : ""}`, hint: b.traveller ?? b.details ?? undefined }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (!reason) found.reason = "Say why it is changing.";
    if (!description.trim()) found.description = "Describe the change.";
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    setError(null);
    try {
      onDone(await travel.me.requestChange(trip.id, { kind, reason, description: description.trim(), fee: fee ?? 0, bookingId: bookingId || null }));
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
      title="Change or cancel this trip"
      subtitle="It goes for approval first. The travel desk carries it out once approved."
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Keep the trip as it is</Button>
          <Button type="submit" variant={kind === "cancellation" ? "danger" : "primary"} disabled={busy}>
            {busy ? "Sending…" : kind === "cancellation" ? "Ask to cancel" : "Ask for the change"}
          </Button>
        </div>
      }
    >
      <Segmented
        label="What to ask for"
        value={kind}
        onChange={setKind}
        options={[
          { key: "change", label: "A change" },
          { key: "cancellation", label: "A cancellation" },
        ]}
      />
      <Field id={`${uid}-reason`} label="Reason">
        <SearchableSelect
          id={`${uid}-reason`}
          value={reason}
          onChange={setReason}
          options={optionsFrom(reasons)}
          placeholder="Choose the reason"
          searchPlaceholder="Search reasons"
          aria-invalid={errors.reason ? true : undefined}
        />
        <FieldError message={errors.reason} />
      </Field>
      <Field id={`${uid}-desc`} label="What changes">
        <textarea
          id={`${uid}-desc`}
          rows={3}
          className={textareaClass}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="The board moved the sign-off to 14 October; return a day later."
          aria-invalid={errors.description ? true : undefined}
        />
        <FieldError message={errors.description} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${uid}-fee`} label="Fee (₦)" hint="From the airline or hotel">
          <MoneyInput id={`${uid}-fee`} value={fee} onChange={setFee} invalid={Boolean(errors.fee)} />
          <FieldError message={errors.fee} />
        </Field>
        <Field id={`${uid}-booking`} label="Booking" hint="Optional">
          <SearchableSelect
            id={`${uid}-booking`}
            value={bookingId}
            onChange={setBookingId}
            options={bookings}
            clearable
            clearLabel={kind === "cancellation" ? "The whole trip" : "No particular booking"}
            placeholder={kind === "cancellation" ? "The whole trip" : "No particular booking"}
            searchPlaceholder="Search bookings"
            noOptionsText="Nothing booked yet."
          />
        </Field>
      </div>
      {kind === "cancellation" && !bookingId && (
        <p className="text-sm text-neutral-600">Cancelling without choosing a booking cancels the whole trip once it is approved and carried out.</p>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}
    </DialogFrame>
  );
}
