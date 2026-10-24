"use client";

import { Paperclip } from "lucide-react";
import { Panel } from "@/components/workspace/kit";
import type { SelectOption } from "@/components/workspace/SearchableSelect";
import { useAuth } from "@/lib/auth-store";
import { procurement, type PrFull } from "@/lib/api/operations-procurement-client";
import { AttachmentsBlock, type FileRoutes } from "@/suite/operations/components/procurement/ui";

/**
 * Files on your own purchase request: a specification, a sample design, an
 * agenda. Always optional: nothing waits on them and a request sends without
 * one. You can add one until the request is closed, and take back a file you
 * added while it is a draft or with its approvers.
 */

const KINDS: SelectOption[] = [
  { value: "specification", label: "Specification" },
  { value: "sample_design", label: "Sample design" },
  { value: "agenda", label: "Agenda" },
  { value: "other", label: "Something else" },
];

const CLOSED = ["cancelled", "rejected"];
const REMOVABLE = ["draft", "in_approval"];

export default function MyRequestFiles({ pr, onChange }: { pr: Pick<PrFull, "id" | "status" | "attachments">; onChange: () => void }) {
  const { user } = useAuth();
  const routes: FileRoutes = {
    upload: (file, kind) => procurement.me.attach(pr.id, file, kind),
    href: procurement.me.fileHref,
    remove: procurement.me.removeFile,
  };
  const open = !CLOSED.includes(pr.status);
  // The API only lets you remove a file you added.
  const mine = (a: { uploadedById?: string | null; uploadedBy: string | null }) =>
    a.uploadedById ? a.uploadedById === user?.id : !a.uploadedBy || !user?.name || a.uploadedBy === user.name;

  return (
    <Panel title="Files" subtitle="Optional. Nothing waits on them." icon={Paperclip} hue="sky">
      <AttachmentsBlock
        routes={routes}
        attachments={pr.attachments}
        canAdd={open}
        canRemove={(a) => REMOVABLE.includes(pr.status) && mine(a)}
        kind="specification"
        kinds={KINDS}
        addLabel="Add a specification, a sample design or an agenda (optional)"
        empty={open ? "No files. Add one if it helps the approvers or procurement; the request goes without." : "No files were added."}
        onChange={onChange}
      />
    </Panel>
  );
}
