import { Bot, HardDrive, Mail, MessagesSquare } from "lucide-react";

/**
 * Why Elevate is sold once rather than rented.
 *
 * The argument is structural, not a discount: every service that costs money
 * to run is one the organisation already brings and pays for directly. Each
 * tile names the providers the product really connects to, so the claim can
 * be checked in the settings screens rather than taken on trust.
 */
const OWNED = [
  {
    icon: HardDrive,
    title: "Your file storage",
    body: "Course media, documents and uploads go to storage you connect — Cloudinary, Amazon S3, Google Drive or your own disk.",
  },
  {
    icon: Bot,
    title: "Your AI agents",
    body: "Planning and drafting assistants run on your own AI provider keys, so usage is billed to you by the provider, at their price.",
  },
  {
    icon: Mail,
    title: "Your email",
    body: "Invitations, receipts and alerts leave through your provider — Resend, Gmail, ZeptoMail, Microsoft 365 or any SMTP server.",
  },
  {
    icon: MessagesSquare,
    title: "Your messaging",
    body: "Project and team notifications post to your own Slack workspace and WhatsApp number.",
  },
] as const;

export function WhyOneTime() {
  return (
    <div className="grid gap-10 lg:grid-cols-5 lg:gap-14">
      <div className="lg:col-span-2">
        <p className="label-mono flex items-center gap-2.5 text-neutral-500">
          <span className="h-0.5 w-7 rounded-full bg-primary-500" aria-hidden="true" />
          Why one-time
        </p>
        <h2 className="heading-2 mt-3 text-neutral-900">You own what it runs on, so there is nothing to rent back</h2>
        <p className="mt-4 text-lg leading-relaxed text-neutral-600">
          Subscriptions exist to pass running costs on to you. On Elevate those costs are already yours: every
          service that is paid per use is one you connect and pay for directly. So you buy the modules once, and
          nobody sends you a renewal.
        </p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:col-span-3">
        {OWNED.map((item) => (
          <li key={item.title} className="rounded-2xl border border-neutral-200 bg-white p-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-500/10">
              <item.icon className="h-5 w-5 text-primary-600" aria-hidden="true" />
            </span>
            <h3 className="font-heading mt-4 text-lg font-semibold text-neutral-900">{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">{item.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
