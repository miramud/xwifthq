import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PersonalPanel from "./PersonalPanel";
import type { PersonalRecord } from "@/lib/api/hrm-client";

/**
 * The person, as opposed to the post.
 *
 * What is worth pinning is the *sentences*, because each carries a decision
 * somebody would otherwise have to discover. That only a name and a number are
 * needed for an emergency contact. That "no expiry" is a real answer rather
 * than a forgotten field. That an expired registration is not a tidiness
 * problem but a shift the institution cannot defend.
 *
 * The one that matters most is the empty state. An institution that cannot say
 * who to ring when somebody collapses on a night shift has a problem no amount
 * of payroll accuracy makes up for, and a blank where the contact should be
 * reads as "nothing to see" rather than "go and ask".
 */

const { personal, verifyDocument, addContact, addDocument } = vi.hoisted(() => ({
  personal: vi.fn(),
  verifyDocument: vi.fn(),
  addContact: vi.fn(),
  addDocument: vi.fn(),
}));

vi.mock("@/lib/api/hrm-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/hrm-client")>();

  return {
    ...actual,
    hrm: {
      employees: { personal, verifyDocument, addContact, addDocument },
    },
  };
});

const EMPTY: PersonalRecord = {
  employeeId: "e-1",
  dateOfBirth: null,
  age: null,
  gender: null,
  maritalStatus: null,
  nationality: null,
  nationalId: null,
  addressLine1: null,
  addressLine2: null,
  city: null,
  state: null,
  postcode: null,
  country: null,
  postalAddress: null,
  personalEmail: null,
  personalPhone: null,
  emergencyContacts: [],
  documents: [],
  isBlockedByDocument: false,
};

function give(overrides: Partial<PersonalRecord>) {
  personal.mockResolvedValue({ ...EMPTY, ...overrides });
}

const REGISTRATION = {
  id: "d-1",
  kind: "certification" as const,
  kindLabel: "Professional certification",
  title: "Nursing registration",
  reference: null,
  issuer: "NMC",
  issuedOn: null,
  expiresOn: "2026-09-01",
  expires: true,
  hasExpired: true,
  daysUntilExpiry: -22,
  needsRenewing: true,
  blocksWork: true,
  isVerified: false,
  verifiedAt: null,
  fileName: null,
  note: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  give({});
  verifyDocument.mockResolvedValue({ ...REGISTRATION, isVerified: true });
  addContact.mockResolvedValue({});
  addDocument.mockResolvedValue({});
});

describe("In an emergency", () => {
  /*
    The gap stated as something to close. A blank reads as "nothing to see"
    when it means "nobody knows who to ring".
  */
  it("asks for a contact rather than showing a blank", async () => {
    render(<PersonalPanel employeeId="e-1" />);

    expect(
      await screen.findByText(/Nobody is recorded for this person/),
    ).toBeInTheDocument();
    expect(screen.getByText(/a name and a number/)).toBeInTheDocument();
  });

  it("marks who to ring first and makes the number dialable", async () => {
    give({
      emergencyContacts: [
        {
          id: "c-1",
          name: "Chidi Balogun",
          relationship: "Spouse",
          phone: "+234 803 555 0101",
          alternatePhone: null,
          email: null,
          address: null,
          isPrimary: true,
        },
      ],
    });

    render(<PersonalPanel employeeId="e-1" />);

    expect(await screen.findByText("Ring first")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "+234 803 555 0101" }),
    ).toHaveAttribute("href", "tel:+2348035550101");
  });

  it("says when a relationship was never recorded", async () => {
    give({
      emergencyContacts: [
        {
          id: "c-1",
          name: "Chidi Balogun",
          relationship: null,
          phone: "+234 803 555 0101",
          alternatePhone: null,
          email: null,
          address: null,
          isPrimary: true,
        },
      ],
    });

    render(<PersonalPanel employeeId="e-1" />);

    expect(
      await screen.findByText("Relationship not recorded"),
    ).toBeInTheDocument();
  });
});

describe("Documents", () => {
  /*
    Not a tidiness problem. A lapsed registration means a shift the institution
    cannot defend, and the record of the person about to be rostered is where
    that has to be visible.
  */
  it("says plainly when somebody should not be rostered", async () => {
    give({ documents: [REGISTRATION], isBlockedByDocument: true });

    render(<PersonalPanel employeeId="e-1" />);

    expect(
      await screen.findByText(/should not be rostered until it is renewed/),
    ).toBeInTheDocument();
  });

  /* Signed, not clamped: both ends of the same scale. */
  it("shows how long ago something lapsed", async () => {
    give({ documents: [REGISTRATION] });

    render(<PersonalPanel employeeId="e-1" />);

    expect(await screen.findByText("Expired 22d ago")).toBeInTheDocument();
  });

  it("shows time remaining for something still valid", async () => {
    give({
      documents: [
        {
          ...REGISTRATION,
          expiresOn: "2026-11-15",
          hasExpired: false,
          daysUntilExpiry: 53,
          needsRenewing: true,
          blocksWork: false,
        },
      ],
    });

    render(<PersonalPanel employeeId="e-1" />);

    expect(await screen.findByText("53d left")).toBeInTheDocument();
  });

  /*
    "Does not expire" has to be expressible, or somebody types 2099 into a
    degree certificate and the reminder sweep is wrong forever.
  */
  it("marks a document that never expires as such", async () => {
    give({
      documents: [
        {
          ...REGISTRATION,
          title: "BSc Nursing",
          expiresOn: null,
          expires: false,
          hasExpired: false,
          daysUntilExpiry: null,
          needsRenewing: false,
          blocksWork: false,
        },
      ],
    });

    render(<PersonalPanel employeeId="e-1" />);

    expect(await screen.findByText("No expiry")).toBeInTheDocument();
  });

  /*
    Verifying is its own act: a date typed from an email and a document an HR
    officer has looked at are different assurances.
  */
  it("offers to verify a document nobody has checked", async () => {
    const user = userEvent.setup();

    give({ documents: [REGISTRATION] });

    render(<PersonalPanel employeeId="e-1" />);

    await user.click(await screen.findByRole("button", { name: "Verify" }));

    await waitFor(() => expect(verifyDocument).toHaveBeenCalledWith("d-1"));
  });

  it("does not offer to verify one that already was", async () => {
    give({ documents: [{ ...REGISTRATION, isVerified: true }] });

    render(<PersonalPanel employeeId="e-1" />);

    expect(await screen.findByText("Verified")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Verify" }),
    ).not.toBeInTheDocument();
  });
});

describe("Adding a contact", () => {
  /*
    Only two fields, and the form says so. A contact that was never recorded
    because the form wanted an address is worse than a partial one.
  */
  it("asks for a name and a number and says the rest can follow", async () => {
    const user = userEvent.setup();

    render(<PersonalPanel employeeId="e-1" />);

    await user.click(
      await screen.findByRole("button", { name: "Add a contact" }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Add an emergency contact",
    });

    expect(
      within(dialog).getByText(/Everything else can follow later/),
    ).toBeInTheDocument();
  });

  it("closes on Escape without saving", async () => {
    const user = userEvent.setup();

    render(<PersonalPanel employeeId="e-1" />);

    await user.click(await screen.findByRole("button", { name: "Add a contact" }));
    await screen.findByRole("dialog", { name: "Add an emergency contact" });

    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Add an emergency contact" }),
      ).not.toBeInTheDocument(),
    );

    expect(addContact).not.toHaveBeenCalled();
  });
});

describe("when it cannot load", () => {
  it("says so rather than rendering an empty record", async () => {
    personal.mockRejectedValue(new Error("gone"));

    render(<PersonalPanel employeeId="e-1" />);

    expect(await screen.findByText("That did not load")).toBeInTheDocument();
  });
});
