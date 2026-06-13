// frontend/app/budgets/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import BurnBar from "@/components/ui/BurnBar";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { CategoryIcon } from "@/components/Icons";
import { useToast } from "@/components/ui/Toast";
import { getCategorySummary, setBudgets } from "@/lib/api";
import { CATEGORY_COLORS } from "@/lib/categories";
import { currentMonth, inr } from "@/lib/format";
import type { CategoriesSummary, Category } from "@/lib/types";

export default function BudgetsPage() {
  const toast = useToast();
  const [summary, setSummary] = useState<CategoriesSummary | null>(null);
  const [limits, setLimits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const month = currentMonth();

  async function load() {
    setLoading(true);
    try {
      const s = await getCategorySummary(month);
      setSummary(s);
      const init: Record<string, string> = {};
      for (const c of s.categories) {
        init[c.category] = c.budget && c.budget > 0 ? String(c.budget) : "";
      }
      setLimits(init);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load budgets.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalBudget = useMemo(
    () =>
      Object.values(limits).reduce(
        (s, v) => s + (parseFloat(v) > 0 ? parseFloat(v) : 0),
        0,
      ),
    [limits],
  );

  async function save() {
    if (!summary) return;
    setSaving(true);
    try {
      const payload = summary.categories
        .map((c) => ({
          category: c.category,
          month,
          limit_amount: parseFloat(limits[c.category] ?? "0") || 0,
        }))
        .filter((b) => b.limit_amount > 0);
      await setBudgets(payload);
      toast("Budgets saved", "success");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save", "error");
    } finally {
      setSaving(false);
    }
  }

  const monthLabel = new Date().toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  return (
    <main className="mx-auto w-full max-w-md px-5 pb-32 pt-8">
      <header className="reveal mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--text)]">
            Budgets
          </h1>
          <p className="mt-0.5 text-sm text-[var(--text-dim)]">
            Monthly envelopes · {monthLabel}
          </p>
        </div>
        {totalBudget > 0 && (
          <span className="font-mono text-sm tabular-nums text-[var(--text-dim)]">
            {inr(totalBudget)}
          </span>
        )}
      </header>

      {error ? (
        <Card className="p-5 text-sm text-[var(--danger)]">{error}</Card>
      ) : loading || !summary ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-[var(--radius)]" />
          ))}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {summary.categories.map((c, i) => {
              const color = CATEGORY_COLORS[c.category as Category] ?? "var(--text-dim)";
              const limit = parseFloat(limits[c.category] ?? "0") || 0;
              const over = limit > 0 && c.spent > limit;
              const warn = limit > 0 && !over && c.spent >= 0.8 * limit;
              return (
                <Card
                  key={c.category}
                  className="reveal p-4"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: `${color}22`, color }}
                    >
                      <CategoryIcon category={c.category} className="h-5 w-5" />
                    </span>
                    <span className="flex-1 truncate text-sm font-medium text-[var(--text)]">
                      {c.category}
                    </span>
                    <div className="flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-2">
                      <span className="font-mono text-xs text-[var(--text-dim)]">₹</span>
                      <input
                        inputMode="decimal"
                        placeholder="0"
                        value={limits[c.category] ?? ""}
                        onChange={(e) =>
                          setLimits((prev) => ({
                            ...prev,
                            [c.category]: e.target.value.replace(/[^0-9.]/g, ""),
                          }))
                        }
                        className="w-20 bg-transparent py-2 text-right font-mono text-sm tabular-nums text-[var(--text)] outline-none"
                        aria-label={`Budget for ${c.category}`}
                      />
                    </div>
                  </div>

                  <div className="mt-3">
                    <BurnBar spent={c.spent} limit={limit} />
                    <div className="mt-1.5 flex items-center justify-between font-mono text-xs tabular-nums">
                      <span
                        className={
                          over
                            ? "text-[var(--danger)]"
                            : warn
                              ? "text-[var(--warn)]"
                              : "text-[var(--text-dim)]"
                        }
                      >
                        {inr(c.spent)} spent
                      </span>
                      {limit > 0 && (
                        <span className="text-[var(--text-dim)]">
                          {over
                            ? `${inr(c.spent - limit)} over`
                            : `${inr(limit - c.spent)} left`}
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="sticky bottom-24 mt-4">
            <Button fullWidth size="lg" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save budgets"}
            </Button>
          </div>
        </>
      )}
    </main>
  );
}
