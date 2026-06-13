// frontend/components/ui/BurnBar.tsx
"use client";

interface BurnBarProps {
  spent: number;
  limit: number;
  /** Optional: day of month elapsed, to draw a "pace" marker. */
  daysElapsed?: number;
  /** Optional: days in the month, paired with daysElapsed. */
  daysInMonth?: number;
}

/**
 * Budget burn-down bar. Fills proportionally to spent/limit and shifts color:
 * primary (on track) -> amber at 80% -> coral at 100%+. A thin marker shows the
 * ideal pace (days elapsed / days in month) so over-pacing is visible early.
 */
export default function BurnBar({
  spent,
  limit,
  daysElapsed,
  daysInMonth,
}: BurnBarProps) {
  const ratio = limit > 0 ? spent / limit : 0;
  const fill = Math.max(0, Math.min(ratio, 1)) * 100;

  const color =
    ratio >= 1
      ? "var(--danger)"
      : ratio >= 0.8
        ? "var(--warn)"
        : "var(--primary)";

  const pace =
    daysElapsed && daysInMonth && daysInMonth > 0
      ? Math.max(0, Math.min(daysElapsed / daysInMonth, 1)) * 100
      : null;

  return (
    <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
      <div
        className="h-full origin-left rounded-full animate-bar-grow"
        style={{ width: `${fill}%`, backgroundColor: color }}
      />
      {pace !== null && (
        <span
          className="absolute top-0 h-full w-px bg-[var(--text)]/40"
          style={{ left: `${pace}%` }}
          title="Expected pace"
          aria-hidden="true"
        />
      )}
    </div>
  );
}
