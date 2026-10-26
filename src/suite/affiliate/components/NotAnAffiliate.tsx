import Link from "next/link";
import { Handshake } from "lucide-react";

/**
 * What somebody sees at /suite/affiliate when their account is not an
 * affiliate's. Modelled on `ConsoleRefused`, but it points somewhere useful:
 * anyone may apply, so the way in is the public affiliates page. Rendered by
 * the layout on the server, before any of the workspace renders.
 */
export default function NotAnAffiliate({ home }: { home: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-neutral-50 px-4 py-12">
      <div
        role="alert"
        className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 text-center shadow-sm"
      >
        <Handshake aria-hidden className="mx-auto mb-3 text-mint-700" size={28} />
        <h1 className="text-lg font-semibold text-neutral-900">This dashboard is for XwiftHQ affiliates</h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          Your account isn&apos;t an affiliate account. Anyone can apply to refer organisations to XwiftHQ and earn
          on their first payment. If you have applied, this opens once your application is approved.
        </p>
        <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
          <Link
            href="/affiliates"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-primary-600 px-4 text-sm font-medium text-white outline-none hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-300"
          >
            About the affiliate programme
          </Link>
          <Link
            href={home}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-700 outline-none hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-primary-300"
          >
            Go to my workspace
          </Link>
        </div>
      </div>
    </main>
  );
}
