import { Bot, HardDrive, Mail, MessagesSquare } from "lucide-react";

import { SectionHeading } from "@/components/site/SectionHeading";

/**
 * Why XwiftHQ is sold once rather than rented.
 *
 * The argument is structural, not a discount: every service that costs money
 * to run is one the company already brings and pays for directly. Each card
 * names the providers the product really connects to, so the claim can be
 * checked in the settings screens rather than taken on trust. The cards are
 * staggered glow cards, the same rhythm as the home page's figures.
 */
const OWNED = [
  {
    icon: HardDrive,
    title: "Your file storage",
    body: "Documents, course media and uploads go to storage you connect: Cloudinary, Amazon S3, Google Drive or your own disk.",
  },
  {
    icon: Bot,
    title: "Your AI agents",
    body: "Planning and drafting assistants run on your own AI provider keys, so the provider bills you directly at its own price.",
  },
  {
    icon: Mail,
    title: "Your email",
    body: "Invitations, receipts and alerts go out through your provider: Resend, Gmail, ZeptoMail, Microsoft 365 or any SMTP server.",
  },
  {
    icon: MessagesSquare,
    title: "Your messaging",
    body: "Project and team notifications post to your own Slack workspace and WhatsApp number.",
  },
] as const;

export function WhyOneTime() {
  return (
    <>
      <SectionHeading
        eyebrow="Why one time"
        title="You bring what it runs on, so there is nothing to rent back"
        intro="Subscriptions exist to pass running costs on to you. With XwiftHQ those costs are already yours, because every pay as you go service is one you connect and pay for yourself. So you buy the modules once and keep them."
      />
      <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:items-start">
        {OWNED.map((item, i) => (
          <li
            key={item.title}
            className={`flex min-h-56 flex-col p-6 ${i % 2 === 0 ? "xw-glow-card" : "xw-tile lg:mt-8"}`}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-600 text-white">
              <item.icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <h3 className="xw-h3 mt-8">{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">{item.body}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
