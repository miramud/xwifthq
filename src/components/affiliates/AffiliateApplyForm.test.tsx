import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AffiliateApplyForm } from "./AffiliateApplyForm";

/**
 * The application to join the affiliate programme. What matters: it sends
 * what the API asks for (with the honeypot empty), a refusal lands on the
 * field it is about, and the applicant is told a person reviews it.
 */

let currentUser: Record<string, unknown> | null = null;

vi.mock("@/lib/auth-store", () => ({
  useAuth: () => ({ user: currentUser, loading: false }),
}));

const fetchMock = vi.fn();

function fill() {
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Ada Obi" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@advisory.test" } });
  fireEvent.change(screen.getByLabelText(/Country/), { target: { value: "Nigeria" } });
  fireEvent.change(screen.getByLabelText(/Your website or profile/), { target: { value: "https://advisory.test" } });
  fireEvent.change(screen.getByLabelText("How would you promote XwiftHQ?"), {
    target: { value: "I advise twenty schools in Lagos on their systems." },
  });
}

describe("AffiliateApplyForm", () => {
  beforeEach(() => {
    currentUser = null;
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the application and says a person will review it", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { id: "a1", status: "pending" } }), { status: 201 }));
    const user = userEvent.setup();
    render(<AffiliateApplyForm />);

    fill();
    await user.click(screen.getByRole("checkbox", { name: /programme terms/ }));
    await user.click(screen.getByRole("button", { name: "Send application" }));

    expect(await screen.findByText("Application received")).toBeInTheDocument();
    expect(screen.getByText(/reviews every application by hand/)).toBeInTheDocument();
    expect(screen.getByText("ada@advisory.test")).toBeInTheDocument();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/public/affiliates/applications");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      name: "Ada Obi",
      email: "ada@advisory.test",
      country: "Nigeria",
      audienceUrl: "https://advisory.test",
      promotion: "I advise twenty schools in Lagos on their systems.",
      acceptTerms: true,
      website: "",
    });
  });

  it("puts the API's refusals on the fields they are about", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          message: "The given data was invalid.",
          errors: { email: ["This email has already applied."], audienceUrl: ["The address must start with https."] },
        }),
        { status: 422 },
      ),
    );
    const user = userEvent.setup();
    render(<AffiliateApplyForm />);

    fill();
    await user.click(screen.getByRole("checkbox", { name: /programme terms/ }));
    await user.click(screen.getByRole("button", { name: "Send application" }));

    expect(await screen.findByText("This email has already applied.")).toBeInTheDocument();
    expect(screen.getByText("The address must start with https.")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText("Application received")).not.toBeInTheDocument();
  });

  it("checks the form before sending anything", async () => {
    const user = userEvent.setup();
    render(<AffiliateApplyForm />);

    fireEvent.change(screen.getByLabelText(/Your website or profile/), { target: { value: "advisory.test" } });
    fireEvent.change(screen.getByLabelText("How would you promote XwiftHQ?"), { target: { value: "Word of mouth" } });
    await user.click(screen.getByRole("button", { name: "Send application" }));

    expect(screen.getByText("Enter your full name.")).toBeInTheDocument();
    expect(screen.getByText(/starting with https/)).toBeInTheDocument();
    expect(screen.getByText(/at least 20 characters/)).toBeInTheDocument();
    expect(screen.getByText("Accept the programme terms to apply.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("starts with the signed-in person's name and email", () => {
    currentUser = { name: "Ada Obi", email: "ada@acme.test", affiliate: null };
    render(<AffiliateApplyForm />);

    expect(screen.getByLabelText("Full name")).toHaveValue("Ada Obi");
    expect(screen.getByLabelText("Email")).toHaveValue("ada@acme.test");
  });

  it("points an existing affiliate at their dashboard instead", () => {
    currentUser = { name: "Ada Obi", email: "ada@acme.test", affiliate: { status: "approved", code: "ADA20" } };
    render(<AffiliateApplyForm />);

    expect(screen.getByRole("link", { name: /Open your dashboard/ })).toHaveAttribute("href", "/suite/affiliate");
    expect(screen.queryByRole("button", { name: "Send application" })).not.toBeInTheDocument();
  });
});
