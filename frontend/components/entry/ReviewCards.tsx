// frontend/components/entry/ReviewCards.tsx
"use client";

import { useMemo, useState } from "react";
import { CategoryPicker } from "./CategoryPicker";
import { ChargesCollapse } from "./ChargesCollapse";
import { Button } from "@/components/ui/Button";
import { TrashIcon } from "@/components/Icons";
import { inr, inrExact } from "@/lib/format";
import type { Item, ParsedOrder } from "@/lib/types";

interface ReviewCardsProps {
  order: ParsedOrder;
  confidence?: number;
  saving?: boolean;
  onConfirm: (order: ParsedOrder) => void;
  onCancel: () => void;
}

/**
 * Review screen for a parsed receipt. Items are editable (name, paid amount,
 * category); charges are shown separately and collapsed. Nothing is saved until
 * the user taps confirm. Totals recompute live (charges never touch item spend).
 */
export function ReviewCards({
  order,
  confidence,
  saving,
  onConfirm,
  onCancel,
}: ReviewCardsProps) {
  const [items, setItems] = useState<Item[]>(order.items);

  const chargeSum = useMemo(() => {
    const c = order.charges;
    return (
      c.delivery + c.handling + c.platform_fee + c.packaging + c.rain_fee +
      c.taxes + c.other
    );
  }, [order.charges]);

  const discountSum = useMemo(() => {
    const d = order.discounts;
    return d.coupon + d.membership + d.other;
  }, [order.discounts]);

  const itemTotal = useMemo(
    () => items.reduce((s, i) => s + (Number.isFinite(i.paid) ? i.paid : 0), 0),
    [items],
  );
  const totalPaid = Math.max(0, itemTotal + chargeSum - discountSum);

  function patch(index: number, next: Partial<Item>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...next } : it)));
  }
  function remove(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function confirm() {
    onConfirm({
      ...order,
      items,
      item_total: Math.round(itemTotal * 100) / 100,
      total_paid: Math.round(totalPaid * 100) / 100,
    });
  }

  const lowConfidence = typeof confidence === "number" && confidence < 0.6;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-[var(--text)]">
            {order.platform}
          </div>
          <div className="text-xs text-[var(--text-dim)]">
            {order.date}
            {order.order_id ? ` · #${order.order_id}` : ""}
          </div>
        </div>
        {lowConfidence && (
          <span className="rounded-full bg-[var(--warn)]/15 px-2.5 py-1 text-xs text-[var(--warn)]">
            Double-check this
          </span>
        )}
      </div>

      {/* Items */}
      <div className="flex flex-col gap-2">
        {items.length === 0 && (
          <p className="rounded-2xl border border-dashed border-[var(--border)] p-4 text-center text-sm text-[var(--text-dim)]">
            No items. Add via Quick add, or cancel.
          </p>
        )}
        {items.map((item, i) => (
          <div
            key={i}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3"
          >
            <div className="flex items-start gap-2">
              <input
                value={item.name}
                onChange={(e) => patch(i, { name: e.target.value })}
                className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text)] outline-none"
                aria-label="Item name"
              />
              <div className="flex items-center gap-1 rounded-lg bg-[var(--surface)] px-2">
                <span className="font-mono text-xs text-[var(--text-dim)]">₹</span>
                <input
                  inputMode="decimal"
                  value={String(item.paid)}
                  onChange={(e) =>
                    patch(i, {
                      paid: parseFloat(e.target.value.replace(/[^0-9.]/g, "")) || 0,
                    })
                  }
                  className="w-16 bg-transparent py-1 text-right font-mono text-sm tabular-nums text-[var(--text)] outline-none"
                  aria-label="Amount paid"
                />
              </div>
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label="Remove item"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-dim)] active:bg-[var(--surface)]"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2">
              <CategoryPicker
                value={item.category}
                onChange={(c) => patch(i, { category: c })}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Charges (separate, collapsed) */}
      {chargeSum > 0 && <ChargesCollapse charges={order.charges} />}

      {/* Totals */}
      <div className="flex flex-col gap-1 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
        <Row label="Items" value={inr(itemTotal)} />
        {chargeSum > 0 && (
          <Row label="Charges & fees" value={inrExact(chargeSum)} dim />
        )}
        {discountSum > 0 && (
          <Row label="Discounts" value={`− ${inrExact(discountSum)}`} dim />
        )}
        <div className="my-1 h-px bg-[var(--border)]" />
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[var(--text)]">Total paid</span>
          <span className="font-mono text-lg font-semibold tabular-nums text-[var(--primary)]">
            {inr(totalPaid)}
          </span>
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          fullWidth
          onClick={confirm}
          disabled={saving || items.length === 0}
        >
          {saving ? "Saving…" : "Confirm & save"}
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value, dim }: { label: string; value: string; dim?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-[var(--text-dim)]">{label}</span>
      <span
        className={`font-mono text-sm tabular-nums ${
          dim ? "text-[var(--text-dim)]" : "text-[var(--text)]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export default ReviewCards;
