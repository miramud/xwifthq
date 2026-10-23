import type { Metadata } from "next";
import MyPay from "@/suite/hrm/components/console/MyPay";

export const metadata: Metadata = {
  title: "My pay",
  robots: { index: false, follow: false },
};

/*
  No `ManagerOnly`. Everybody who is paid reads their own payslip, and requiring
  an HR role would mean the HR manager printing them for the institution.
*/
export default function MyPayPage() {
  return <MyPay />;
}
