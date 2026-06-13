// frontend/components/ui/BarChart.tsx
"use client";

import { inr } from "@/lib/format";

export interface BarRow {
  label: string;
  value: number;
  color: string;
  onClick?: () => void;
}

/**
 * Horizontal bar chart, sorted descending by value. Each row shows a label,
 * the amount, and a proportional bar (relative to the largest value). Rows with
 * an onClick become tappable.
 */
export default function BarChart({ rows }: { rows: BarRow[] }) {
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  const max = sorted.reduce((m, r) => Math.max(m, r.value), 0) || 1;

  return (
    <ul className="flex flex-col gap-3">
      {sorted.map((row, i) => {
        const pct = Math.max(2, (row.value / max) * 100);
        const Inner = (
          <>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="truncate text-sm text-[var(--text)]">
                {row.label}
              </span>
              <span className="shrink-0 font-mono text-sm tabular-nums text-[var(--text-dim)]">
                {inr(row.value)}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
              <div
                className="h-full origin-left rounded-full animate-bar-grow"
                style={{
                  width: `${pct}%`,
                  backgroundColor: row.color,
                  animationDelay: `${i * 55}ms`,
                }}
              />
            </div>
          </>
        );

        return (
          <li key={row.label}>
            {row.onClick ? (
              <button
                type="button"
                onClick={row.onClick}
                className="block w-full text-left transition-opacity active:opacity-70"
              >
                {Inner}
              </button>
            ) : (
              Inner
            )}
          </li>
        );
      })}
    </ul>
  );
}
