"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ChevronIcon, ReceiptIcon } from "@/components/Icons";
import { listOrders } from "@/lib/api";
import { formatShortDate, inr, isoDate, monthKey } from "@/lib/format";
import type { OrderListItem } from "@/lib/types";

function monthBounds(d: Date): { start: string; end: string } {
  const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { start, end: isoDate(last) };
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

const PLATFORM_TINT: Record<string, string> = {
  Blinkit: "#F8CB46",
  Instamart: "#FF6B35",
  Swiggy: "#FC8019",
  Zomato: "#E23744",
  Manual: "var(--text-dim)",
};

export default function HistoryPage() {
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const { start, end } = monthBounds(month);
    listOrders({ start, end })
      .then((data) => {
        if (!cancelled) setOrders(data);
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [month]);

  const isCurrentMonth = monthKey(month) === monthKey(new Date());
  const label = month.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
  const sorted = [...orders].sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
  );
  const total = orders.reduce((s, o) => s + o.total_paid, 0);

  return (
    <main className="mx-auto w-full max-w-md px-5 pb-32 pt-8">
      <header className="reveal mb-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--text)]">
          History
        </h1>
        <p className="mt-0.5 text-sm text-[var(--text-dim)]">
          Browse and edit past expenses
        </p>
      </header>

      {/* Month navigation */}
      <div className="reveal mb-4 flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <button
          onClick={() => setMonth((m) => addMonths(m, -1))}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-dim)] active:bg-[var(--surface-2)]"
          aria-label="Previous month"
        >
          <span className="rotate-180">
            <ChevronIcon className="h-4 w-4" />
          </span>
        </button>

        <div className="text-center">
          <div className="text-sm font-medium text-[var(--text)]">{label}</div>
          {!loading && (
            <div className="text-xs text-[var(--text-dim)]">
              {orders.length} {orders.length === 1 ? "order" : "orders"} ·{" "}
              {inr(total)}
            </div>
          )}
        </div>

        <button
          onClick={() => setMonth((m) => addMonths(m, 1))}
          disabled={isCurrentMonth}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-dim)] active:bg-[var(--surface-2)] disabled:opacity-30"
          aria-label="Next month"
        >
          <ChevronIcon className="h-4 w-4" />
        </button>
      </div>

      {error ? (
        <Card className="p-5 text-sm text-[var(--danger)]">{error}</Card>
      ) : loading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-[var(--radius)]" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <Card className="p-8 text-center text-sm text-[var(--text-dim)]">
          No expenses in {label}.
        </Card>
      ) : (
        <Card className="reveal overflow-hidden p-0">
          <ul className="divide-y divide-[var(--border)]">
            {sorted.map((o) => {
              const tint = PLATFORM_TINT[o.platform] ?? "var(--text-dim)";
              return (
                <li key={o.id}>
                  <Link
                    href={`/orders/${o.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors active:bg-[var(--surface-2)]"
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: "var(--surface-2)", color: tint }}
                    >
                      <ReceiptIcon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-[var(--text)]">
                        {o.platform}
                      </div>
                      <div className="text-xs text-[var(--text-dim)]">
                        {formatShortDate(o.date)} ·{" "}
                        {o.item_count}{" "}
                        {o.item_count === 1 ? "item" : "items"}
                      </div>
                    </div>
                    <span className="font-mono text-sm tabular-nums text-[var(--text)]">
                      {inr(o.total_paid)}
                    </span>
                    <ChevronIcon className="h-4 w-4 shrink-0 text-[var(--text-dim)]" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </main>
  );
}
