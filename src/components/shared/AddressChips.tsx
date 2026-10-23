"use client";

import { AlertCircle, Mail } from "lucide-react";
import { cx } from "@/components/workspace/kit";
import { MAX_LIST_ADDRESSES, isEmailAddress, parseAddressList } from "@/lib/api/integrations-client";

/**
 * What a typed address list will actually be sent to, one chip per address.
 *
 * People paste lists the way their mail app copies them, so the preview is
 * how they check that "a@x.com; b@x.com" became two people and not one. An
 * address that does not look like one says so in words as well as colour, and
 * the count warns before the server refuses an eleventh.
 */
export default function AddressChips({ value, id }: { value: string; id?: string }) {
  const list = parseAddressList(value);
  if (list.length === 0) return null;

  const over = list.length > MAX_LIST_ADDRESSES;

  return (
    <div id={id} className="mt-2">
      <ul aria-label="Addresses" className="flex flex-wrap gap-1.5">
        {list.map((a) => {
          const ok = isEmailAddress(a);
          return (
            <li
              key={a}
              className={cx(
                "inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                ok ? "bg-sky-50 text-sky-700" : "bg-error-500/10 text-error-700",
              )}
            >
              {ok ? <Mail size={12} aria-hidden /> : <AlertCircle size={12} aria-hidden />}
              <span className="truncate">{a}</span>
              {!ok && <span className="font-semibold">· not an address</span>}
            </li>
          );
        })}
      </ul>
      <p className={cx("mt-1.5 text-xs tabular-nums", over ? "text-error-700" : "text-neutral-500")}>
        {over
          ? `${list.length} addresses. The most a list can hold is ${MAX_LIST_ADDRESSES}.`
          : `${list.length} of ${MAX_LIST_ADDRESSES} addresses.`}
      </p>
    </div>
  );
}
