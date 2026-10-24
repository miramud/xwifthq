import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MyDetails from "./MyDetails";
import { ApiError, type PersonalRecord } from "@/lib/api/hrm-client";

/**
 * Somebody maintaining their own details.
 *
 * `GET/PATCH /hrm/me/details` and `Employee::SELF_EDITABLE` were both built
 * and neither had a screen: the manager could edit anybody's record and nobody
 * could edit their own. A system where changing your address means emailing HR
 * is a system with a lot of wrong addresses, found on the day a P45 has to
 * reach somebody who has already left.
 *
 * What this screen has to get right is the **boundary**, in both directions.
 * It must not offer to change a date of birth, because payroll and statutory
 * filings depend on it. And it must not hide one either: a field somebody
 * cannot find reads as an oversight, and an oversight gets a ticket raised
 * about it.
 *
 * The editable set is the API's, not a second copy here. That is asserted
 * directly, because a hardcoded list is how a field the backend stopped
 * trusting somebody with stays editable in the UI and fails silently on save.
 */

const { details, saveDetails } = vi.hoisted(() => ({
  details: vi.fn(),
  saveDetails: vi.fn(),
}));

// DataView reads the app router to open rows; there is none under jsdom.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/hrm/me",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/api/hrm-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/hrm-client")>();

  return {
    ...actual,
    hrm: { me: { details, saveDetails, documentFileUrl: (id: string) => `/api/hrm/me/documents/${id}/file` } },
  };
});

const EDITABLE = [
  "marital_status",
  "address_line_1",
  "address_line_2",
  "city",
  "state",
  "postcode",
  "country",
  "personal_email",
  "personal_phone",
];

function record(overrides: Partial<PersonalRecord> = {}): PersonalRecord {
  return {
    employeeId: "emp-1",
    dateOfBirth: "1990-04-02",
    age: 36,
    gender: "Female",
    maritalStatus: "Single",
    nationality: "British",
    nationalId: "QQ123456C",
    addressLine1: "14 Bridge Street",
    addressLine2: null,
    city: "Leeds",
    state: "West Yorkshire",
    postcode: "LS1 4AP",
    country: "United Kingdom",
    postalAddress: "14 Bridge Street, Leeds, West Yorkshire, LS1 4AP",
    personalEmail: "ada@example.test",
    personalPhone: "07700 900123",
    emergencyContacts: [],
    documents: [],
    isBlockedByDocument: false,
    ...overrides,
  };
}

function respond(
  overrides: Partial<PersonalRecord> = {},
  editable: string[] = EDITABLE,
) {
  details.mockResolvedValue({ data: record(overrides), meta: { editable } });
}

beforeEach(() => {
  vi.clearAllMocks();
  respond();
  saveDetails.mockImplementation((patch: Record<string, unknown>) =>
    Promise.resolve(record(patch as Partial<PersonalRecord>)),
  );
});

describe("what is theirs to change", () => {
  it("shows their address filled in, ready to correct", async () => {
    render(<MyDetails />);

    expect(await screen.findByLabelText("Address")).toHaveValue(
      "14 Bridge Street",
    );
    expect(screen.getByLabelText("Town or city")).toHaveValue("Leeds");
  });

  it("sends only what changed", async () => {
    render(<MyDetails />);

    const city = await screen.findByLabelText("Town or city");

    await userEvent.clear(city);
    await userEvent.type(city, "Bradford");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(saveDetails).toHaveBeenCalledTimes(1));

    expect(saveDetails).toHaveBeenCalledWith({ city: "Bradford" });
  });

  /*
    A cleared field means "we do not hold this". An empty string is a value,
    and it sorts and matches like any other.
  */
  it("sends a cleared field as null, not an empty string", async () => {
    render(<MyDetails />);

    await userEvent.clear(await screen.findByLabelText("County or state"));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(saveDetails).toHaveBeenCalledWith({ state: null }));
  });

  it("will not save when nothing has been touched", async () => {
    render(<MyDetails />);

    expect(await screen.findByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it("confirms the save rather than leaving them guessing", async () => {
    render(<MyDetails />);

    const postcode = await screen.findByLabelText("Postcode");

    await userEvent.clear(postcode);
    await userEvent.type(postcode, "BD1 1AA");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Saved.")).toBeInTheDocument();
  });

  it("puts a rejection in front of them rather than swallowing it", async () => {
    saveDetails.mockRejectedValue(
      new ApiError("That postcode is longer than we can store.", 422),
    );

    render(<MyDetails />);

    const postcode = await screen.findByLabelText("Postcode");

    await userEvent.clear(postcode);
    await userEvent.type(postcode, "LS1 9ZZ");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(
      await screen.findByText("That postcode is longer than we can store."),
    ).toBeInTheDocument();
  });

  /*
    The email field carries type="email", so a malformed address is caught by
    the browser before a request is made. Pinned because switching it to a
    plain text input to "simplify" would send the rubbish to the API and turn
    an inline bubble into a round trip and a 422.
  */
  it("catches a malformed email before asking the server", async () => {
    render(<MyDetails />);

    const email = await screen.findByLabelText("Personal email");

    await userEvent.clear(email);
    await userEvent.type(email, "nope");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(saveDetails).not.toHaveBeenCalled();
  });

  it("can put back what they were typing over", async () => {
    render(<MyDetails />);

    const city = await screen.findByLabelText("Town or city");

    await userEvent.clear(city);
    await userEvent.type(city, "Hull");
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));

    expect(city).toHaveValue("Leeds");
    expect(saveDetails).not.toHaveBeenCalled();
  });
});

describe("what is not", () => {
  /* The whole point of SELF_EDITABLE. */
  it("offers no way to edit a date of birth or a national ID", async () => {
    render(<MyDetails />);

    await screen.findByLabelText("Address");

    expect(screen.queryByLabelText("Date of birth")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("National ID")).not.toBeInTheDocument();
  });

  /*
    But it must not hide them either. A field somebody cannot find reads as an
    oversight, and the first thing done about an oversight is a ticket.
  */
  it("shows them anyway, with who to ask", async () => {
    render(<MyDetails />);

    expect(await screen.findByText("Held about you")).toBeInTheDocument();
    expect(screen.getByText("QQ123456C")).toBeInTheDocument();
    expect(screen.getByText(/ask HR to correct it/)).toBeInTheDocument();
  });

  /*
    Driven from `meta.editable`, not from a list in this file. Asserted by
    taking a field away from the API's answer and expecting it to go.
  */
  it("follows the API's list rather than its own", async () => {
    respond({}, ["city", "postcode"]);

    render(<MyDetails />);

    expect(await screen.findByLabelText("Town or city")).toBeInTheDocument();
    expect(screen.getByLabelText("Postcode")).toBeInTheDocument();
    expect(screen.queryByLabelText("Address")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Personal email")).not.toBeInTheDocument();
  });

  it("says so plainly when nothing at all is theirs to change", async () => {
    respond({}, []);

    render(<MyDetails />);

    expect(
      await screen.findByText("Nothing here is yours to change"),
    ).toBeInTheDocument();
  });
});

describe("in an emergency", () => {
  it("names who would be rung, and in what order", async () => {
    respond({
      emergencyContacts: [
        {
          id: "ec-1",
          name: "Grace Hopper",
          relationship: "Sister",
          phone: "07700 900456",
          alternatePhone: null,
          email: null,
          address: null,
          isPrimary: true,
        },
      ],
    });

    render(<MyDetails />);

    expect(await screen.findByText("Grace Hopper")).toBeInTheDocument();
    expect(screen.getByText("First call")).toBeInTheDocument();
  });

  /*
    The state that matters on the worst day this module has. "Nobody
    recorded" has to be unmissable rather than an empty list.
  */
  it("says outright when there is nobody to ring", async () => {
    render(<MyDetails />);

    expect(await screen.findByText("Nobody recorded")).toBeInTheDocument();
    expect(screen.getByText(/Ask HR to add somebody to ring/)).toBeInTheDocument();
  });
});

describe("people who are not employed here", () => {
  /*
    An examiner, a contractor billed through Finance. Not an error, and a
    "could not load" would send them to support over nothing.
  */
  it("explains a missing employment record rather than reporting a fault", async () => {
    details.mockRejectedValue(new ApiError("No employment record.", 404));

    render(<MyDetails />);

    expect(
      await screen.findByText("You have no employment record here"),
    ).toBeInTheDocument();
  });

  it("does report an actual fault", async () => {
    details.mockRejectedValue(new ApiError("Something broke.", 500));

    render(<MyDetails />);

    expect(await screen.findByText("That did not load")).toBeInTheDocument();
    expect(screen.getByText("Something broke.")).toBeInTheDocument();
  });
});

/* H13: the scan HR attached is theirs to download; details-only ones are listed without a link. */
describe("their documents", () => {
  it("lists what HR holds and links the scan where there is one", async () => {
    respond({
      documents: [
        {
          id: "doc-1", kind: "right_to_work", kindLabel: "Right to work", title: "Passport",
          reference: null, issuer: null, issuedOn: null, expiresOn: "2030-01-01", expires: true,
          hasExpired: false, daysUntilExpiry: 1000, needsRenewing: false, blocksWork: true,
          isVerified: true, verifiedAt: null, fileName: "passport.pdf", hasFile: true, note: null,
        },
        {
          id: "doc-2", kind: "certification", kindLabel: "Certification", title: "First aid",
          reference: null, issuer: null, issuedOn: null, expiresOn: null, expires: false,
          hasExpired: false, daysUntilExpiry: null, needsRenewing: false, blocksWork: false,
          isVerified: false, verifiedAt: null, fileName: null, hasFile: false, note: null,
        },
      ] as PersonalRecord["documents"],
    });

    render(<MyDetails />);

    const link = await screen.findByRole("link", { name: "Download Passport" });
    expect(link).toHaveAttribute("href", "/api/hrm/me/documents/doc-1/file");
    expect(screen.getByText("First aid")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Download First aid" })).not.toBeInTheDocument();
  });
});
