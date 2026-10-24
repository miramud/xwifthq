import { BookOpen, FolderKanban, NotebookPen, Stamp, Users, Wallet, Wrench, type LucideIcon } from "lucide-react";
import { hueFor, type Hue } from "@/components/workspace/modules";

/*
  The icon tile that leads a request: its module's glyph on its module's
  wash, read from the process code ("finance.purchase_order"). Presentation
  only; an unknown module falls back to the stamp.
*/

const MODULE_TILE: Record<string, { icon: LucideIcon; hue: Hue }> = {
  core: { icon: NotebookPen, hue: "blue" },
  finance: { icon: Wallet, hue: "mint" },
  hrm: { icon: Users, hue: "coral" },
  projects: { icon: FolderKanban, hue: "sky" },
  lms: { icon: BookOpen, hue: "grape" },
  operations: { icon: Wrench, hue: "sun" },
  admin: { icon: Wrench, hue: "sun" },
};

export function processTile(process: string): { icon: LucideIcon; hue: Hue } {
  return MODULE_TILE[process.split(".")[0]] ?? { icon: Stamp, hue: hueFor(process) };
}
