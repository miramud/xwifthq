"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ArrowRight } from "lucide-react";
import { Clouds } from "@/components/site/Sky";

export default function VerifyLandingPage() {
  const router = useRouter();
  const [serial, setSerial] = useState("");

  useEffect(() => {
    document.title = "Verify a certificate | XwiftHQ";
  }, []);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = serial.trim().toUpperCase();
    if (trimmed) router.push(`/verify/${encodeURIComponent(trimmed)}`);
  }

  return (
    // Not a sky route in the navbar, so the bar sits above this section
    // rather than floating over it, and the section needs no top clearance.
    <section className="xw-sky relative isolate overflow-hidden py-20 sm:py-28">
      <Clouds className="-z-10" />
      <div className="section-container flex min-h-[55vh] flex-col items-center justify-center text-center">
        <p className="xw-eyebrow">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Credential registry
        </p>

        <h1 className="xw-h1 mx-auto mt-6 max-w-2xl">Verify a certificate</h1>
        <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-neutral-600 sm:text-lg">
          Each certificate issued through XwiftHQ has its own serial number. Pop it in below to confirm the credential
          is real. You don&apos;t need an account.
        </p>

        <form onSubmit={onSubmit} className="xw-frame mx-auto mt-10 w-full max-w-lg p-3 text-left">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              placeholder="e.g. TT-2026-AB12CD"
              aria-label="Certificate serial number"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="h-12 w-full min-w-0 rounded-full border border-neutral-200 bg-white px-5 text-center text-sm font-medium uppercase tracking-wide text-neutral-900 placeholder:normal-case placeholder:tracking-normal placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100 sm:text-left"
            />
            <button type="submit" disabled={!serial.trim()} className="btn-primary h-12 shrink-0 disabled:cursor-not-allowed disabled:opacity-50">
              Verify
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        </form>

        <p className="mt-6 text-xs text-neutral-500">Tip: you&apos;ll find the serial printed along the bottom of the certificate.</p>
      </div>
    </section>
  );
}
