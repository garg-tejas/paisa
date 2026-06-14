// frontend/app/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BudgetHero from "@/components/dashboard/BudgetHero";
import CategoryBreakdown from "@/components/dashboard/CategoryBreakdown";
import RecentEntries from "@/components/dashboard/RecentEntries";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { LogOutIcon } from "@/components/Icons";
import { getCategorySummary, listOrders } from "@/lib/api";
import { clearToken } from "@/lib/auth";
import { currentMonth, daysAgo, isoDate } from "@/lib/format";
import type { CategoriesSummary, OrderListItem } from "@/lib/types";

export default function HomePage() {
  const router = useRouter();
  const [summary, setSummary] = useState<CategoriesSummary | null>(null);
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function handleLogout() {
    clearToken();
    router.replace("/login");
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [sum, recent] = await Promise.all([
          getCategorySummary(currentMonth()),
          listOrders({ start: daysAgo(6), end: isoDate(new Date()) }),
        ]);
        if (!cancelled) {
          setSummary(sum);
          setOrders(recent);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Couldn't reach the server.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    function onSaved() { void load(); }
    window.addEventListener("paisa:saved", onSaved);
    return () => {
      cancelled = true;
      window.removeEventListener("paisa:saved", onSaved);
    };
  }, []);

  const monthLabel = new Date().toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  return (
    <main className="mx-auto w-full max-w-md px-5 pb-32 pt-8">
      <header
        className="reveal mb-6 flex items-end justify-between"
        style={{ animationDelay: "0ms" }}
      >
        <div>
          <h1 className="font-display text-3xl font-semibold lowercase tracking-tight text-[var(--text)]">
            paisa
          </h1>
          <p className="mt-0.5 text-sm text-[var(--text-dim)]">{monthLabel}</p>
        </div>
        <button
          onClick={handleLogout}
          aria-label="Sign out"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-dim)] transition-colors active:bg-[var(--surface-2)]"
        >
          <LogOutIcon className="h-4 w-4" />
        </button>
      </header>

      {error ? (
        <Card className="p-5 text-sm text-[var(--danger)]">
          {error}
          <p className="mt-1 text-xs text-[var(--text-dim)]">
            Is the API running at{" "}
            <code className="font-mono">NEXT_PUBLIC_API_URL</code>?
          </p>
        </Card>
      ) : loading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-40 w-full rounded-[var(--radius)]" />
          <Skeleton className="h-56 w-full rounded-[var(--radius)]" />
          <Skeleton className="h-48 w-full rounded-[var(--radius)]" />
        </div>
      ) : summary ? (
        <div className="flex flex-col gap-4">
          <BudgetHero summary={summary} />
          <CategoryBreakdown summary={summary} />
          <RecentEntries orders={orders} />
        </div>
      ) : null}
    </main>
  );
}
