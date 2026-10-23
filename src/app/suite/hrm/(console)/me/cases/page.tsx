import type { Metadata } from "next";
import MyCases from "@/suite/hrm/components/console/MyCases";

export const metadata: Metadata = {
  title: "My cases",
  robots: { index: false, follow: false },
};

/*
  No `ManagerOnly`, and emphatically so. Every other case route is behind
  `access:hrm` and HR's permission keys, which is exactly why an employee could
  not raise a grievance until this page existed: the only way in ran through HR, and a
  grievance is most often about HR or about the manager HR would ask.
*/
export default function MyCasesPage() {
  return <MyCases />;
}
