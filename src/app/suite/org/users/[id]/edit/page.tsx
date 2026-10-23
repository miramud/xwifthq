"use client";

import { use } from "react";
import EditUser from "@/suite/org/components/users/EditUser";

export default function OrgUserEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <EditUser id={id} />;
}
