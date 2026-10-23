import { dayNumber } from "@/components/workspace/calendar-lanes";
import type { PolicyRate, TravelMode } from "@/lib/api/operations-travel-client";

/*
  A trip's cost, worked out in the browser exactly as the API works it out
  (`TravelRequests::cost` in api-lms) so the editor's preview is the number
  the request will carry. The API recomputes on save; this is the preview.

    days    = return - departure + 1
    nights  = days - 1
    DTA     = the grade's daily rate × days
    hotel   = the grade's nightly cap × nights
    taxi    = the airport taxi × 2, when a leg flies or the trip is abroad

  A traveller's DTA or hotel may be set by hand for the whole trip; above
  policy is allowed, but it flags the trip for a justification and the MD.
*/

/** How far ahead a trip must be booked: 7 days at home, 21 abroad (`TravelRequests::LEAD_DAYS`). */
export const LEAD_DAYS = { local: 7, international: 21 } as const;

export const isInternational = (destinationClass: string) => destinationClass.startsWith("intl");

const isDate = (s: string | null | undefined): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Days away, inclusive of both ends; 0 when either date is missing or the return comes first. */
export function tripDays(departsOn: string | null | undefined, returnsOn: string | null | undefined): number {
  if (!isDate(departsOn) || !isDate(returnsOn)) return 0;
  const d = dayNumber(returnsOn) - dayNumber(departsOn) + 1;
  return d > 0 ? d : 0;
}

export interface TravellerDraft {
  userId: string;
  grade: string;
  /** Whole-trip DTA set by hand; null or undefined for policy. */
  dta?: number | null;
  /** Whole-trip hotel set by hand; null or undefined for policy. */
  hotel?: number | null;
}

export interface TravellerCost {
  userId: string;
  grade: string;
  /** The policy cell used; null when the table has none for this grade and destination. */
  rate: PolicyRate | null;
  policyDta: number;
  policyHotel: number;
  taxi: number;
  dta: number;
  hotel: number;
  policyTotal: number;
  total: number;
  /** DTA or hotel above policy. */
  over: boolean;
  dtaOver: boolean;
  hotelOver: boolean;
}

export interface TripCost {
  days: number;
  nights: number;
  /** The airport taxi is due (a flight leg, or abroad). */
  air: boolean;
  travellers: TravellerCost[];
  /** DTA, hotel and taxi for everyone: the advance. */
  advance: number;
  flights: number;
  /** Advance plus flights: what the project is asked for. */
  estimate: number;
  overPolicy: boolean;
  /** A traveller's grade has no rate for this destination class. */
  missingRate: boolean;
}

export function rateFor(rates: readonly PolicyRate[], grade: string, destinationClass: string): PolicyRate | null {
  return rates.find((r) => r.grade === grade && r.destinationClass === destinationClass) ?? null;
}

export function tripCost(input: {
  rates: readonly PolicyRate[];
  destinationClass: string;
  departsOn: string | null | undefined;
  returnsOn: string | null | undefined;
  legs: readonly { mode?: TravelMode | string | null }[];
  travellers: readonly TravellerDraft[];
  flightsEstimate?: number | null;
}): TripCost {
  const days = tripDays(input.departsOn, input.returnsOn);
  const nights = Math.max(0, days - 1);
  // A leg with no mode is saved as air, as the API does.
  const air = input.legs.some((l) => (l.mode ?? "air") === "air") || isInternational(input.destinationClass);
  let advance = 0;
  let overPolicy = false;
  let missingRate = false;

  const travellers = input.travellers.map((t): TravellerCost => {
    const rate = input.destinationClass ? rateFor(input.rates, t.grade, input.destinationClass) : null;
    if (!rate) missingRate = true;
    const policyDta = (rate?.dtaDaily ?? 0) * days;
    const policyHotel = (rate?.hotelNightly ?? 0) * nights;
    const taxi = air ? (rate?.airportTaxi ?? 0) * 2 : 0;
    const dta = t.dta != null ? t.dta : policyDta;
    const hotel = t.hotel != null ? t.hotel : policyHotel;
    const dtaOver = dta > policyDta;
    const hotelOver = hotel > policyHotel;
    overPolicy = overPolicy || dtaOver || hotelOver;
    const total = dta + hotel + taxi;
    advance += total;
    return { userId: t.userId, grade: t.grade, rate, policyDta, policyHotel, taxi, dta, hotel, policyTotal: policyDta + policyHotel + taxi, total, over: dtaOver || hotelOver, dtaOver, hotelOver };
  });

  const flights = Math.max(0, input.flightsEstimate ?? 0);
  return { days, nights, air, travellers, advance, flights, estimate: advance + flights, overPolicy, missingRate };
}

export interface LeadTime {
  /** The minimum notice for this kind of trip. */
  lead: number;
  /** Whole days from today to departure (negative once it has left). */
  daysAway: number;
  /** Booked inside the lead time: the request needs a reason. */
  late: boolean;
  international: boolean;
}

/** Lead time against today, as `TravelRequests::submit` checks it. Null until there is a departure date. */
export function leadTime(departsOn: string | null | undefined, destinationClass: string, today: string): LeadTime | null {
  if (!isDate(departsOn) || !isDate(today)) return null;
  const international = isInternational(destinationClass);
  const lead = international ? LEAD_DAYS.international : LEAD_DAYS.local;
  const daysAway = dayNumber(departsOn) - dayNumber(today);
  return { lead, daysAway, late: daysAway < lead, international };
}
