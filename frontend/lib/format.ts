// frontend/lib/format.ts
// Money + date formatting helpers (INR, en-IN grouping, Asia/Kolkata weeks).

const INR_0 = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const INR_2 = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** "₹1,234" — rounded, no paise. Use for headline amounts. */
export function inr(n: number): string {
  return INR_0.format(Number.isFinite(n) ? n : 0);
}

/** "₹1,234.50" — keeps paise when present. Use for charges/line items. */
export function inrExact(n: number): string {
  return INR_2.format(Number.isFinite(n) ? n : 0);
}

/** A bare grouped number without the symbol, e.g. "1,234". */
export function num(n: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(
    Number.isFinite(n) ? n : 0,
  );
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/** "YYYY-MM" for a Date (local). */
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Current month as "YYYY-MM" (local time). */
export function currentMonth(): string {
  return monthKey(new Date());
}

/** "YYYY-MM-DD" for a Date (local). */
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function parseISO(date: string): Date {
  // Treat a plain YYYY-MM-DD as a local date (avoid UTC shift).
  const [y, m, d] = date.split("-").map((s) => parseInt(s, 10));
  if (y && m && d) return new Date(y, m - 1, d);
  return new Date(date);
}

/** "31 May 2026" */
export function formatDate(date: string): string {
  return parseISO(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** "31 May" — compact, for list rows. */
export function formatShortDate(date: string): string {
  return parseISO(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

/** "Sun" — weekday abbreviation for a YYYY-MM-DD. */
export function weekdayShort(date: string): string {
  return parseISO(date).toLocaleDateString("en-IN", { weekday: "short" });
}

/** The Monday of the week containing `d`, as "YYYY-MM-DD". */
export function weekStartMonday(d: Date = new Date()): string {
  const day = d.getDay(); // 0 = Sun ... 6 = Sat
  const diff = (day + 6) % 7; // days since Monday
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff);
  return isoDate(monday);
}

/** N days ago as "YYYY-MM-DD" (local). */
export function daysAgo(n: number, from: Date = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() - n);
  return isoDate(d);
}
