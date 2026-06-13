"use client";

import { useState } from "react";
import type { Charges } from "@/lib/types";
import { inrExact } from "@/lib/format";
import { Chevron } from "@/components/Icons";

interface ChargesCollapseProps {
  charges: Charges;
}

const CHARGE_LABELS: { key: keyof Charges; label: string }[] = [
  { key: "delivery", label: "Delivery" },
  { key: "handling", label: "Handling" },
  { key: "platform_fee", label: "Platform fee" },
  { key: "packaging", label: "Packaging" },
  { key: "rain_fee", label: "Rain fee" },
  { key: "taxes", label: "Taxes" },
  { key: "other", label: "Other" },
];

/**
 * ChargesCollapse — shows platform charges SEPARATELY from item costs.
 * Collapsed by default. Charges never count toward category budgets; they live
 * in their own bucket (and surface on the Fees tab after save).
 */
export function ChargesCollapse({ charges }: ChargesCollapseProps) {
  const [open, setOpen] = useState(false);

  const rows = CHARGE_LABELS.filter(({ key }) => (charges[key] ?? 0) > 0);
  const total = CHARGE_LABELS.reduce(
    (sum, { key }) => sum + (charges[key] ?? 0),
    0,
  );

  return (
    <div className="overflow-hidden rounded-[14px] border border-[var(--border)] bg-[var(--surface)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-[44px] w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex flex-col">
          <span className="font-sans text-sm text-[var(--text)]">
            Charges & fees
          </span>
          <span className="font-sans text-xs text-[var(--text-dim)]">
            Kept out of category budgets
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm tabular-nums text-[var(--warn)]">
            {inrExact(total)}
          </span>
          <span
            className="text-[var(--text-dim)] transition-transform"
            style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
            aria-hidden
          >
            <Chevron className="h-4 w-4" />
          </span>
        </div>
      </button>

      {open ? (
        <div className="border-t border-[var(--border)] px-4 py-3">
          {rows.length === 0 ? (
            <p className="font-sans text-sm text-[var(--text-dim)]">
              No charges on this order.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {rows.map(({ key, label }) => (
                <li
                  key={key}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="font-sans text-sm text-[var(--text-dim)]">
                    {label}
                  </span>
                  <span className="font-mono text-sm tabular-nums text-[var(--text)]">
                    {inrExact(charges[key] ?? 0)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default ChargesCollapse;
