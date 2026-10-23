"use client";

import { use } from "react";
import EmployeeRecord from "@/suite/hrm/components/console/EmployeeRecord";
import ManagerOnly from "@/suite/hrm/components/console/ManagerOnly";

/**
 * `params` is a Promise in this version of Next and is unwrapped with `use()`.
 * Reading it as a plain object is a type error, not a runtime one, so it would
 * only surface at build time.
 */
export default function HrmEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <ManagerOnly>
      <EmployeeRecord employeeId={id} />
    </ManagerOnly>
  );
}
