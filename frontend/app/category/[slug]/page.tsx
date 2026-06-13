"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getOrder, listOrders } from "@/lib/api";
import type { OrderListItem, OrderOut, ItemOut } from "@/lib/types";
import { CATEGORIES, CATEGORY_COLORS, unslug } from "@/lib/categories";
import { inr, currentMonth, formatShortDate } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { CategoryIcon, ChevronIcon } from "@/components/Icons";

interface CategoryItemRow {
  item: ItemOut;
  order: OrderOut;
}

interface OrderGroup {
  order: OrderOut;
  items: ItemOut[];
  groupTotal: number;
}

function monthBounds(month: string): { start: string; end: string } {
  // month = "YYYY-MM"
  const [y, m] = month.split("-").map((s) => parseInt(s, 10));
  const start = `${month}-01`;
  // last day of month: day 0 of next month
  const last = new Date(y, m, 0).getDate();
  const end = `${month}-${String(last).padStart(2, "0")}`;
  return { start, end };
}

export default function CategoryDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;

  const category = useMemo(() => {
    const resolved = unslug(slug ?? "");
    // guard: only accept known categories
    return CATEGORIES.includes(resolved) ? resolved : resolved;
  }, [slug]);

  const isKnown = CATEGORIES.includes(category);
  const color = CATEGORY_COLORS[category] ?? "var(--text-dim)";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<OrderGroup[]>([]);

  const month = currentMonth();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { start, end } = monthBounds(month);
        const list: OrderListItem[] = await listOrders({ start, end });
        // fetch full orders to access items + their categories
        const full = await Promise.all(
          list.map((o) => getOrder(o.id))
        );

        const rows: CategoryItemRow[] = [];
        for (const order of full) {
          for (const item of order.items) {
            if (item.category === category) {
              rows.push({ item, order });
            }
          }
        }

        // group by order
        const byOrder = new Map<string, OrderGroup>();
        for (const { item, order } of rows) {
          let g = byOrder.get(order.id);
          if (!g) {
            g = { order, items: [], groupTotal: 0 };
            byOrder.set(order.id, g);
          }
          g.items.push(item);
          g.groupTotal += item.paid;
        }

        const grouped = Array.from(byOrder.values()).sort((a, b) =>
          a.order.date < b.order.date ? 1 : a.order.date > b.order.date ? -1 : 0
        );

        if (!cancelled) setGroups(grouped);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [category, month]);

  const totalSpent = useMemo(
    () => groups.reduce((s, g) => s + g.groupTotal, 0),
    [groups]
  );
  const itemCount = useMemo(
    () => groups.reduce((s, g) => s + g.items.length, 0),
    [groups]
  );
  const orderCount = groups.length;
  const avgPerOrder = orderCount > 0 ? totalSpent / orderCount : 0;

  return (
    <main className="mx-auto w-full max-w-md px-5 pb-28 pt-6">
      {/* Back + title */}
      <button
        onClick={() => router.back()}
        className="reveal mb-4 -ml-1 flex h-11 items-center gap-1 text-sm text-text-dim"
        style={{ animationDelay: "0ms" }}
      >
        <span className="rotate-180">
          <ChevronIcon />
        </span>
        Back
      </button>

      <header
        className="reveal mb-6 flex items-center gap-3"
        style={{ animationDelay: "40ms" }}
      >
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
          style={{ background: `${color}22`, color }}
        >
          <CategoryIcon category={category} className="h-5 w-5" />
        </span>
        <h1 className="font-display text-2xl font-semibold leading-tight text-text">
          {category}
        </h1>
      </header>

      {/* Header stats */}
      <section
        className="reveal mb-6 grid grid-cols-3 gap-3"
        style={{ animationDelay: "80ms" }}
      >
        <Card className="px-3 py-4">
          <div className="text-[11px] uppercase tracking-wide text-text-dim">
            Spent
          </div>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-16" />
          ) : (
            <div
              className="mt-1 font-mono text-xl font-semibold tabular-nums"
              style={{ color }}
            >
              {inr(totalSpent)}
            </div>
          )}
        </Card>
        <Card className="px-3 py-4">
          <div className="text-[11px] uppercase tracking-wide text-text-dim">
            Items
          </div>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-10" />
          ) : (
            <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-text">
              {itemCount}
            </div>
          )}
        </Card>
        <Card className="px-3 py-4">
          <div className="text-[11px] uppercase tracking-wide text-text-dim">
            Avg / order
          </div>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-16" />
          ) : (
            <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-text">
              {inr(avgPerOrder)}
            </div>
          )}
        </Card>
      </section>

      <div
        className="reveal mb-3 text-xs uppercase tracking-wide text-text-dim"
        style={{ animationDelay: "120ms" }}
      >
        This month · {orderCount} order{orderCount === 1 ? "" : "s"}
      </div>

      {/* Body */}
      {error ? (
        <Card className="p-5 text-sm text-danger">{error}</Card>
      ) : loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="p-4">
              <Skeleton className="mb-3 h-4 w-32" />
              <Skeleton className="mb-2 h-5 w-full" />
              <Skeleton className="h-5 w-2/3" />
            </Card>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="mb-1 font-display text-lg text-text">
            Nothing here yet
          </div>
          <div className="text-sm text-text-dim">
            No {isKnown ? category : "matching"} spend recorded this month.
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {groups.map((g, gi) => (
            <Card
              key={g.order.id}
              className="reveal overflow-hidden p-0"
              style={{ animationDelay: `${160 + gi * 40}ms` }}
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-text">
                    {g.order.platform}
                  </span>
                  <span className="text-xs text-text-dim">
                    {formatShortDate(g.order.date)}
                  </span>
                </div>
                <span
                  className="font-mono text-base font-semibold tabular-nums"
                  style={{ color }}
                >
                  {inr(g.groupTotal)}
                </span>
              </div>
              <ul className="divide-y divide-border/60">
                {g.items.map((it) => (
                  <li
                    key={it.id}
                    className="flex items-start justify-between gap-3 px-4 py-2.5"
                  >
                    <span className="text-sm leading-snug text-text">
                      {it.name}
                    </span>
                    <span className="shrink-0 font-mono text-sm tabular-nums text-text-dim">
                      {inr(it.paid)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
