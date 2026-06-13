"use client";

import { useRouter } from "next/navigation";
import BarChart from "@/components/ui/BarChart";
import { inr } from "@/lib/format";
import { colorFor, slug } from "@/lib/categories";
import type { CategoriesSummary } from "@/lib/types";

/**
 * CategoryBreakdown — horizontal bar chart of spend per category (sorted desc by BarChart).
 * Tapping a category navigates to /category/<slug>.
 */
export default function CategoryBreakdown({ summary }: { summary: CategoriesSummary }) {
  const router = useRouter();

  const rows = summary.categories
    .filter((c) => c.spent > 0)
    .map((c) => ({
      label: c.category,
      value: c.spent,
      color: colorFor(c.category),
      onClick: () => router.push(`/category/${slug(c.category)}`),
    }));

  return (
    <section
      className="reveal rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5"
      style={{ animationDelay: "120ms" }}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-[var(--text)]">
          Categories
        </h2>
        <span className="font-mono text-xs text-[var(--text-dim)]">
          {inr(summary.total_spent)}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-[var(--text-dim)]">
          No spending logged this month yet.
        </p>
      ) : (
        <BarChart rows={rows} />
      )}
    </section>
  );
}
