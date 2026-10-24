import type { Metadata } from "next";
import ExternalCompanies from "@/suite/projects/components/ExternalCompanies";

export const metadata: Metadata = {
  title: "External companies",
  robots: { index: false, follow: false },
};

/**
 * Who this institution works for, and the people there.
 *
 * Called "external companies" rather than "clients" deliberately: the same
 * record holds a partner, a subcontractor and a regulator, and a project can
 * be delivered *with* one of them rather than *for* them. Naming the space
 * after the commercial relationship would have meant a second table the first
 * time somebody needed to record an auditor.
 *
 * The per-project judgement about each person, how much influence, how much
 * interest, is not here. It lives on the project, because it is not a fact
 * about the person.
 */
export default function ExternalCompaniesPage() {
  return <ExternalCompanies />;
}
