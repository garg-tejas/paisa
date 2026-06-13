// frontend/app/fees/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { getChargeSummary } from "@/lib/api";
import { currentMonth, inrExact } from "@/lib/format";
import type { ChargeSummary, ChargesSummary } from "@/lib/types";

const CHARGE_LABELS: { key: keyof ChargeSummary; label: string }[] = [
  { key: "delivery", label: "Delivery" },
  { key: "handling", label: "Handling" },
  { key: "platform_fee", label: "Platform fee" },
  { key: "packaging", label: "Packaging" },
  { key: "rain_fee", label: "Rain / surge" },
  { key: "taxes", label: "Taxes" },
  { key: "other", label: "Other" },
];

const PLATFORM_TINT: Record<string, string> = {
  Blinkit: "#F8CB46",
  Instamart: "#FF6B35",
  Swiggy: "#FC8019",
  Zomato: "#E23744",
  Manual: "var(--text-dim)",
};

export default function FeesPage() {
  const [data, setData] = useState<ChargesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getChargeSummary(currentMonth())
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Failed"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const monthLabel = new Date().toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  return (
    <main className="mx-auto w-full max-w-md px-5 pb-32 pt-8">
      <header className="reveal mb-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--text)]">
          Platform fees
        </h1>
        <p className="mt-0.5 text-sm text-[var(--text-dim)]">
          The hidden cost of convenience · {monthLabel}
        </p>
      </header>

      {error ? (
        <Card className="p-5 text-sm text-[var(--danger)]">{error}</Card>
      ) : loading || !data ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-28 w-full rounded-[var(--radius)]" />
          <Skeleton className="h-40 w-full rounded-[var(--radius)]" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Grand total */}
          <Card
            className="reveal p-5"
            style={{ animationDelay: "40ms" }}
          >
            <span className="text-xs uppercase tracking-[0.18em] text-[var(--text-dim)]">
              Paid in fees this month
            </span>
            <div className="mt-2 font-display text-5xl font-semibold tabular-nums text-[var(--warn)]">
              {inrExact(data.total)}
            </div>
            <p className="mt-2 text-xs text-[var(--text-dim)]">
              Not counted in any category budget — this is pure convenience spend.
            </p>
          </Card>

          {data.platforms.length === 0 ? (
            <Card className="p-8 text-center text-sm text-[var(--text-dim)]">
              No fees logged this month. Nice.
            </Card>
          ) : (
            data.platforms.map((p, i) => {
              const tint = PLATFORM_TINT[p.platform] ?? "var(--text-dim)";
              const rows = CHARGE_LABELS.filter(
                ({ key }) => (p[key] as number) > 0,
              );
              return (
                <Card
                  key={p.platform}
                  className="reveal overflow-hidden p-0"
                  style={{ animationDelay: `${80 + i * 50}ms` }}
                >
                  <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: tint }}
                      />
                      <span className="text-sm font-medium text-[var(--text)]">
                        {p.platform}
                      </span>
                    </div>
                    <span className="font-mono text-base font-semibold tabular-nums text-[var(--warn)]">
                      {inrExact(p.total)}
                    </span>
                  </div>
                  <ul className="px-4 py-2">
                    {rows.map(({ key, label }) => (
                      <li
                        key={key}
                        className="flex items-center justify-between py-1.5"
                      >
                        <span className="text-sm text-[var(--text-dim)]">{label}</span>
                        <span className="font-mono text-sm tabular-nums text-[var(--text)]">
                          {inrExact(p[key] as number)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })
          )}
        </div>
      )}
    </main>
  );
}
