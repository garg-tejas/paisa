// frontend/components/entry/ManualForm.tsx
"use client";

import { useState } from "react";
import { CategoryPicker } from "./CategoryPicker";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { createOrder } from "@/lib/api";
import { isoDate } from "@/lib/format";
import type { ParsedOrder } from "@/lib/types";

const ZERO_CHARGES = {
  delivery: 0,
  handling: 0,
  platform_fee: 0,
  packaging: 0,
  rain_fee: 0,
  taxes: 0,
  other: 0,
};
const ZERO_DISCOUNTS = { coupon: 0, membership: 0, other: 0 };

/** Quick manual entry: amount + category + optional where/note. One tap to save. */
export function ManualForm({ onSaved }: { onSaved: () => void }) {
  const toast = useToast();
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food & Dining");
  const [merchant, setMerchant] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(isoDate(new Date()));
  const [saving, setSaving] = useState(false);

  const amt = parseFloat(amount);
  const valid = Number.isFinite(amt) && amt > 0;

  async function save() {
    if (!valid || saving) return;
    setSaving(true);

    const name = merchant.trim() || note.trim() || category;
    const order: ParsedOrder = {
      platform: "Manual",
      date,
      order_id: null,
      items: [
        {
          name,
          mrp: null,
          discount: 0,
          paid: Math.round(amt * 100) / 100,
          category,
        },
      ],
      charges: { ...ZERO_CHARGES },
      discounts: { ...ZERO_DISCOUNTS },
      item_total: amt,
      total_paid: amt,
      source: "manual",
      note: note.trim() || null,
    };

    try {
      await createOrder(order);
      toast("Saved", "success");
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      {/* Amount */}
      <label className="flex flex-col gap-1.5">
        <span className="text-xs uppercase tracking-wide text-[var(--text-dim)]">
          Amount
        </span>
        <div className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4">
          <span className="font-mono text-2xl text-[var(--text-dim)]">₹</span>
          <input
            autoFocus
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            className="h-14 w-full bg-transparent font-mono text-2xl tabular-nums text-[var(--text)] outline-none placeholder:text-[var(--border)]"
          />
        </div>
      </label>

      {/* Category */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs uppercase tracking-wide text-[var(--text-dim)]">
          Category
        </span>
        <CategoryPicker value={category} onChange={setCategory} variant="grid" />
      </div>

      {/* Where + date */}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide text-[var(--text-dim)]">
            Where
          </span>
          <input
            placeholder="Merchant"
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            className="h-11 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-dim)]"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide text-[var(--text-dim)]">
            Date
          </span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-11 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-[var(--text)] outline-none"
          />
        </label>
      </div>

      {/* Note */}
      <label className="flex flex-col gap-1.5">
        <span className="text-xs uppercase tracking-wide text-[var(--text-dim)]">
          Note <span className="normal-case">(optional)</span>
        </span>
        <input
          placeholder="What was it for?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="h-11 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-dim)]"
        />
      </label>

      <Button type="submit" size="lg" fullWidth disabled={!valid || saving}>
        {saving ? "Saving…" : "Save expense"}
      </Button>
    </form>
  );
}

export default ManualForm;
