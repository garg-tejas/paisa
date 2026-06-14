import Link from "next/link";
import { formatShortDate, inr } from "@/lib/format";
import { ChevronIcon, ReceiptIcon } from "@/components/Icons";
import type { OrderListItem } from "@/lib/types";

const PLATFORM_TINT: Record<string, string> = {
  Blinkit: "#F8CB46",
  Instamart: "#FF6B35",
  Swiggy: "#FC8019",
  Zomato: "#E23744",
  Manual: "var(--text-dim)",
};

/**
 * RecentEntries — last 7 days of orders.
 * Each row: platform, date, item count, amount. Tap -> order detail (/orders/<id> not in nav; link kept simple).
 */
export default function RecentEntries({ orders }: { orders: OrderListItem[] }) {
  const sorted = [...orders].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return (
    <section
      className="reveal rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5"
      style={{ animationDelay: "200ms" }}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-[var(--text)]">Recent</h2>
        <Link href="/history" className="text-xs text-[var(--primary)]">
          See all →
        </Link>
      </div>

      {sorted.length === 0 ? (
        <p className="py-6 text-center text-sm text-[var(--text-dim)]">
          Nothing in the last 7 days. Tap + to add an expense.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {sorted.map((o) => {
            const tint = PLATFORM_TINT[o.platform] ?? "var(--text-dim)";
            return (
              <li key={o.id}>
                <Link
                  href={`/orders/${o.id}`}
                  className="flex items-center gap-3 py-3 -mx-1 px-1 transition-colors active:bg-[var(--surface-2)]"
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
                      {formatShortDate(o.date)} &middot; {o.item_count}{" "}
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
      )}
    </section>
  );
}
