import type { ClientPaymentFull, EventFull, OpsOptions, PolicyRate, TripFull } from "@/lib/api/operations-travel-client";

/* Test data shaped like the API's (`OpsPresenter`), from the Meridian demo. */

/** The default policy for Lagos / Abuja / Port Harcourt and Africa (`TravelPolicy::DEFAULTS`). */
export const RATES: PolicyRate[] = [
  { grade: "officer", destinationClass: "local_tier1", dtaDaily: 2_500_000, hotelNightly: 4_500_000, airportTaxi: 1_500_000, flightClass: "economy" },
  { grade: "senior", destinationClass: "local_tier1", dtaDaily: 3_250_000, hotelNightly: 5_850_000, airportTaxi: 1_500_000, flightClass: "economy" },
  { grade: "officer", destinationClass: "intl_africa", dtaDaily: 18_000_000, hotelNightly: 25_000_000, airportTaxi: 4_000_000, flightClass: "economy" },
  { grade: "executive", destinationClass: "intl_africa", dtaDaily: 36_000_000, hotelNightly: 50_000_000, airportTaxi: 4_000_000, flightClass: "business" },
];

export const OPTIONS: OpsOptions = {
  projects: [{ id: "p-sbp", name: "Scholarship Board Portal", code: "SBP", status: "planning" }],
  costCentres: [{ id: "cc-ict", code: "CC-ICT", name: "ICT infrastructure" }],
  vendors: [{ id: "v-air", name: "Wakanow Business Travel" }],
  staff: [
    { id: "u-efe", name: "Efe Omoregie", grade: "senior" },
    { id: "u-yusuf", name: "Yusuf Abdullahi", grade: "officer" },
    { id: "u-ngozi", name: "Ngozi Eze", grade: "executive" },
  ],
  prCategories: {},
  eventTypes: { client_training: "Client training" },
  eventCategories: { venue: "Venue", meals: "Meals and tea breaks", printing: "Printing and booklets", contingency: "Contingency" },
  travelGrades: { officer: "Officer", senior: "Senior staff", manager: "Manager / HOD", executive: "Management" },
  destinationClasses: { local_tier1: "Lagos / Abuja / Port Harcourt", intl_africa: "Africa" },
  travelPolicy: RATES,
  changeReasons: { client_driven: "Client-driven", internal_schedule: "Internal schedule", personal: "Personal", force_majeure: "Force majeure" },
  financeOn: true,
};

export function tripFull(over: Partial<TripFull> = {}): TripFull {
  return {
    id: "trip-1",
    number: "MPT/TRV/2026/0001",
    purpose: "Requirements sign-off with the Eastgate board in Abuja",
    destination: "Abuja",
    destinationClass: "local_tier1",
    tripType: "local",
    departsOn: "2026-10-13",
    returnsOn: "2026-10-15",
    status: "booked",
    estimate: 79_950_000,
    advance: 43_950_000,
    overPolicy: false,
    requester: "Efe Omoregie",
    requesterId: "u-efe",
    project: { id: "p-sbp", name: "Scholarship Board Portal", code: "SBP" },
    eventId: null,
    approvalId: "ap-1",
    flightsEstimate: 36_000_000,
    justification: null,
    lateBookingReason: null,
    funds: null,
    costCentreId: null,
    report: null,
    reportSubmittedAt: null,
    advanceMemo: { reference: "MPT/MEMO/PMO/2026/0008", status: "awaiting_fcu", amount: 43_950_000, paid: 0, type: "advance" },
    advanceMemoId: "memo-8",
    travellers: [
      { id: "t1", userId: "u-efe", name: "Efe Omoregie", grade: "senior", days: 3, nights: 2, dta: 9_750_000, hotel: 11_700_000, taxi: 3_000_000, policyTotal: 24_450_000, total: 24_450_000 },
      { id: "t2", userId: "u-yusuf", name: "Yusuf Abdullahi", grade: "officer", days: 3, nights: 2, dta: 7_500_000, hotel: 9_000_000, taxi: 3_000_000, policyTotal: 19_500_000, total: 19_500_000 },
    ],
    legs: [
      { sequence: 1, from: "Ibadan", to: "Abuja", travelOn: "2026-10-13", mode: "air" },
      { sequence: 2, from: "Abuja", to: "Ibadan", travelOn: "2026-10-15", mode: "air" },
    ],
    bookings: [
      { id: "b1", kind: "flight", travellerId: "u-efe", traveller: "Efe Omoregie", agency: null, reference: "PNR K7XQ2M", details: "Air Peace P7 7121 / 7124, economy", amount: 17_200_000, status: "changed" },
    ],
    changes: [
      {
        id: "c1",
        kind: "change",
        reason: "client_driven",
        description: "The board moved the sign-off to 14 October; return a day later.",
        fee: 3_850_000,
        status: "approved",
        bookingId: "b1",
        requestedBy: "Efe Omoregie",
        approvalId: "ap-2",
        executedAt: null,
      },
    ],
    ...over,
  };
}

export function eventFull(over: Partial<EventFull> = {}): EventFull {
  return {
    id: "ev-1",
    number: "MPT/EVT/2026/0001",
    name: "Scholarship portal training for board staff",
    type: "client_training",
    typeLabel: "Client training",
    status: "approved",
    startsOn: "2026-10-20",
    endsOn: "2026-10-21",
    location: "Eastgate Hotel, Ibadan",
    project: { id: "p-sbp", name: "Scholarship Board Portal", code: "SBP" },
    costCentreId: null,
    participantsInternal: 4,
    participantsExternal: 30,
    lead: "Efe Omoregie",
    leadId: "u-efe",
    budget: 171_700_000,
    approvalId: "ap-ev",
    objectives: "Board staff can open an application cycle without our help.",
    attendance: null,
    outcomes: null,
    closedAt: null,
    funds: null,
    lines: [
      { id: "l1", lineNo: 1, category: "venue", description: "Training hall, projector and PA, two days", amount: 70_000_000, channel: "vendor" },
      { id: "l3", lineNo: 3, category: "printing", description: "Training booklets and certificates", amount: 25_500_000, channel: "vendor" },
      { id: "l4", lineNo: 4, category: "contingency", description: "Contingency", amount: 15_000_000, channel: "advance" },
    ],
    dashboard: {
      lines: [
        { id: "l1", lineNo: 1, category: "venue", label: "Venue", description: "Training hall, projector and PA, two days", channel: "vendor", budget: 70_000_000, committed: 0, paid: 0, available: 70_000_000, vendorRating: null, requests: [], orders: [], trips: [] },
        {
          id: "l3",
          lineNo: 3,
          category: "printing",
          label: "Printing and booklets",
          description: "Training booklets and certificates",
          channel: "vendor",
          budget: 25_500_000,
          committed: 24_000_000,
          paid: 12_000_000,
          available: 1_500_000,
          vendorRating: null,
          requests: [{ id: "pr-4", number: "MPT/PR/2026/0004", status: "approved", amount: 24_000_000 }],
          orders: [],
          trips: [],
        },
        { id: "l4", lineNo: 4, category: "contingency", label: "Contingency", description: "Contingency", channel: "advance", budget: 15_000_000, committed: 0, paid: 0, available: 15_000_000, vendorRating: null, requests: [], orders: [], trips: [] },
      ],
      totals: { budget: 110_500_000, committed: 24_000_000, paid: 12_000_000, participants: 34 },
      blockers: [],
    },
    ...over,
  };
}

export function clientPayment(over: Partial<ClientPaymentFull> = {}): ClientPaymentFull {
  return {
    id: "cpr-2",
    number: "MPT/CPR/2026/002",
    title: "Kiosk installation, training and go-live",
    clientId: "cl-mlsb",
    client: "Meridian Library Services Board",
    project: { id: "p-lsk", name: "Library Self-Service Kiosk", code: "LSK" },
    amount: 806_250_000,
    currency: "NGN",
    stage: "prepared",
    stageLabel: "Prepared",
    packStatus: "draft",
    accountManager: "Ibukun Salami",
    accountManagerId: "u-ibukun",
    nextFollowUpOn: "2026-10-09",
    followUpOverdue: false,
    expectedPaymentOn: "2026-11-01",
    submittedAt: null,
    paidAt: null,
    daysInStage: 0,
    daysSinceSubmission: null,
    invoiceId: "inv-3",
    invoiceNo: "INV/2026/0003",
    approvalId: null,
    items: [
      { id: "i1", label: "Cover letter", mandatory: true, attachment: { id: "a1", kind: "checklist", name: "cover-letter.pdf", mime: "application/pdf", size: 24_000, uploadedBy: "Ibukun Salami", uploadedAt: "2026-10-02T16:00:00+00:00" } },
      { id: "i2", label: "Invoice", mandatory: true, attachment: null },
      { id: "i3", label: "Delivery note (hardware)", mandatory: false, attachment: null },
    ],
    history: [{ stage: "prepared", label: "Prepared", contact: null, notes: "Pack started", nextFollowUpOn: "2026-10-05", by: "Ibukun Salami", enteredAt: "2026-10-02T16:00:00+00:00" }],
    stages: {
      prepared: "Prepared",
      submitted: "Submitted",
      acknowledged: "Acknowledged",
      under_verification: "Under verification",
      paid: "Paid",
      closed: "Closed",
      queried: "Queried",
    },
    ...over,
  };
}
