// frontend/app/weekly/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Badge } from "@/components/ui/Badge";
import {
  CategoryIcon,
  ChevronIcon,
  TrendDownIcon,
  TrendUpIcon,
} from "@/components/Icons";
import { getWeekly } from "@/lib/api";
import { CATEGORY_COLORS } from "@/lib/categories";
import { formatShortDate, inr, weekdayShort } from "@/lib/format";
import type { Category, WeeklySummary } from "@/lib/types";

export default function WeeklyPage() {
  const [data, setData] = useState<WeeklySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getWeekly()
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Failed"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const maxDaily = data
    ? data.daily.reduce((m, d) => Math.max(m, d.amount), 0) || 1
    : 1;

  const up = data ? data.delta_pct > 0 : false;
  const topColor =
    data?.top_category
      ? (CATEGORY_COLORS[data.top_category as Category] ?? "var(--primary)")
      : "var(--primary)";

  return (
    <main className="mx-auto w-full max-w-md px-5 pb-32 pt-8">
      <header className="reveal mb-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--text)]">
          This week
        </h1>
        {data && (
          <p className="mt-0.5 text-sm text-[var(--text-dim)]">
            {formatShortDate(data.week_start)} – {formatShortDate(data.week_end)}
          </p>
        )}
      </header>

      {error ? (
        <Card className="p-5 text-sm text-[var(--danger)]">{error}</Card>
      ) : loading || !data ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-44 w-full rounded-[var(--radius)]" />
          <Skeleton className="h-32 w-full rounded-[var(--radius)]" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Total + delta + daily chart */}
          <Card className="reveal p-5" style={{ animationDelay: "40ms" }}>
            <div className="flex items-end justify-between">
              <div>
                <span className="text-xs uppercase tracking-[0.18em] text-[var(--text-dim)]">
                  Spent this week
                </span>
                <div className="mt-1 font-display text-4xl font-semibold tabular-nums text-[var(--text)]">
                  {inr(data.total_spent)}
                </div>
              </div>
              <span
                className={`flex items-center gap-1 text-sm ${
                  up ? "text-[var(--danger)]" : "text-[var(--positive)]"
                }`}
              >
                {up ? (
                  <TrendUpIcon className="h-4 w-4" />
                ) : (
                  <TrendDownIcon className="h-4 w-4" />
                )}
                {Math.abs(data.delta_pct)}%
              </span>
            </div>

            {/* Daily bars (Mon→Sun, chronological) */}
            <div className="mt-5 flex items-end justify-between gap-1.5" style={{ height: 96 }}>
              {data.daily.map((d) => {
                const h = Math.max(4, (d.amount / maxDaily) * 80);
                return (
                  <div key={d.date} className="flex flex-1 flex-col items-center gap-1.5">
                    <div className="flex w-full flex-1 items-end justify-center">
                      <div
                        className="w-full max-w-[18px] rounded-md bg-[var(--primary)] origin-bottom animate-bar-grow"
                        style={{
                          height: `${h}px`,
                          opacity: d.amount > 0 ? 1 : 0.25,
                        }}
                        title={inr(d.amount)}
                      />
                    </div>
                    <span className="text-[10px] text-[var(--text-dim)]">
                      {weekdayShort(d.date).slice(0, 1)}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-[var(--text-dim)]">
              vs {inr(data.prev_week_total)} the week before
            </p>
          </Card>

          {/* Top category */}
          <Card className="reveal p-5" style={{ animationDelay: "100ms" }}>
            <span className="text-xs uppercase tracking-wide text-[var(--text-dim)]">
              Top category
            </span>
            {data.top_category ? (
              <div className="mt-2 flex items-center gap-3">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ background: `${topColor}22`, color: topColor }}
                >
                  <CategoryIcon category={data.top_category} className="h-5 w-5" />
                </span>
                <span className="flex-1 text-base font-medium text-[var(--text)]">
                  {data.top_category}
                </span>
                <span className="font-mono text-lg font-semibold tabular-nums" style={{ color: topColor }}>
                  {inr(data.top_category_amount)}
                </span>
              </div>
            ) : (
              <p className="mt-2 text-sm text-[var(--text-dim)]">
                Nothing logged this week yet.
              </p>
            )}
          </Card>

          {/* Biggest order */}
          {data.biggest_order && (
            <Link
              href={`/orders/${data.biggest_order.id}`}
              className="reveal block"
              style={{ animationDelay: "160ms" }}
            >
              <Card className="flex items-center gap-3 p-5 transition-colors active:bg-[var(--surface-2)]">
                <div className="min-w-0 flex-1">
                  <span className="text-xs uppercase tracking-wide text-[var(--text-dim)]">
                    Biggest order
                  </span>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="truncate text-base font-medium text-[var(--text)]">
                      {data.biggest_order.platform}
                    </span>
                    {data.biggest_order.date && (
                      <Badge>{formatShortDate(String(data.biggest_order.date))}</Badge>
                    )}
                  </div>
                </div>
                <span className="font-mono text-lg font-semibold tabular-nums text-[var(--text)]">
                  {inr(Number(data.biggest_order.total_paid ?? 0))}
                </span>
                <ChevronIcon className="h-4 w-4 shrink-0 text-[var(--text-dim)]" />
              </Card>
            </Link>
          )}
        </div>
      )}
    </main>
  );
}
