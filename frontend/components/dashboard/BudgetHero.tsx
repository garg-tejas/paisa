import BurnBar from "@/components/ui/BurnBar";
import { inr } from "@/lib/format";
import type { CategoriesSummary } from "@/lib/types";

/**
 * BudgetHero — the big month-spend headline.
 * Shows total spent this month vs total budget with a burn-down bar.
 * Charges are EXCLUDED from category spend per contract (summary/categories excludes charges).
 */
export default function BudgetHero({ summary }: { summary: CategoriesSummary }) {
  const spent = summary.total_spent;
  const budget = summary.total_budget;
  const hasBudget = budget > 0;

  const now = new Date();
  const year = now.getFullYear();
  const monthIdx = now.getMonth();
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();

  // Days elapsed only matters for the current month; for past months we treat it as fully elapsed.
  const summaryMonth = summary.month; // "YYYY-MM"
  const currentKey = `${year}-${String(monthIdx + 1).padStart(2, "0")}`;
  const isCurrentMonth = summaryMonth === currentKey;
  const daysElapsed = isCurrentMonth ? now.getDate() : daysInMonth;

  const remaining = budget - spent;

  return (
    <section
      className="reveal rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5"
      style={{ animationDelay: "40ms" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-[0.18em] text-[var(--text-dim)]">
          Spent this month
        </span>
        {hasBudget && (
          <span className="font-mono text-xs text-[var(--text-dim)]">
            of {inr(budget)}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-display text-5xl font-semibold tracking-tight text-[var(--text)] tabular-nums">
          {inr(spent)}
        </span>
      </div>

      {hasBudget ? (
        <div className="mt-4">
          <BurnBar
            spent={spent}
            limit={budget}
            daysElapsed={daysElapsed}
            daysInMonth={daysInMonth}
          />
          <div className="mt-2 flex items-center justify-between font-mono text-xs">
            <span className={remaining >= 0 ? "text-[var(--positive)]" : "text-[var(--danger)]"}>
              {remaining >= 0 ? `${inr(remaining)} left` : `${inr(Math.abs(remaining))} over`}
            </span>
            <span className="text-[var(--text-dim)]">
              day {daysElapsed} / {daysInMonth}
            </span>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-[var(--text-dim)]">
          No budget set yet —{" "}
          <a href="/budgets" className="text-[var(--primary)] underline-offset-2 hover:underline">
            set monthly limits
          </a>
          .
        </p>
      )}
    </section>
  );
}
