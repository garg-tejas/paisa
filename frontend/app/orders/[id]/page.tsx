// frontend/app/orders/[id]/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CategoryPicker } from "@/components/entry/CategoryPicker";
import { ChargesCollapse } from "@/components/entry/ChargesCollapse";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { ChevronIcon, TrashIcon } from "@/components/Icons";
import { deleteItem, deleteOrder, getOrder, updateItem } from "@/lib/api";
import { formatDate, inr, inrExact } from "@/lib/format";
import type { Charges, OrderOut } from "@/lib/types";

function chargesToObject(order: OrderOut): Charges {
  const c: Charges = {
    delivery: 0, handling: 0, platform_fee: 0, packaging: 0,
    rain_fee: 0, taxes: 0, other: 0,
  };
  for (const ch of order.charges) {
    if (ch.type in c) c[ch.type as keyof Charges] = ch.amount;
  }
  return c;
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const toast = useToast();

  const [order, setOrder] = useState<OrderOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!id) return;
    try {
      setOrder(await getOrder(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load order.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onChangeCategory(itemId: string, category: string) {
    try {
      await updateItem(itemId, { category });
      await refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Update failed", "error");
    }
  }

  async function onChangePaid(itemId: string, paid: number) {
    try {
      await updateItem(itemId, { paid });
      await refresh();
      toast("Updated", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Update failed", "error");
    }
  }

  async function onDeleteItem(itemId: string) {
    try {
      await deleteItem(itemId);
      await refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Delete failed", "error");
    }
  }

  async function onDeleteOrder() {
    if (!id) return;
    if (!window.confirm("Delete this entire order?")) return;
    try {
      await deleteOrder(id);
      toast("Order deleted", "success");
      router.push("/");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Delete failed", "error");
    }
  }

  return (
    <main className="mx-auto w-full max-w-md px-5 pb-32 pt-6">
      <button
        onClick={() => router.back()}
        className="reveal mb-4 -ml-1 flex h-11 items-center gap-1 text-sm text-[var(--text-dim)]"
      >
        <span className="rotate-180">
          <ChevronIcon className="h-4 w-4" />
        </span>
        Back
      </button>

      {error ? (
        <Card className="p-5 text-sm text-[var(--danger)]">{error}</Card>
      ) : loading || !order ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full rounded-[var(--radius)]" />
          <Skeleton className="h-40 w-full rounded-[var(--radius)]" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Header */}
          <Card className="reveal p-5">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="font-display text-2xl font-semibold text-[var(--text)]">
                  {order.platform}
                </h1>
                <p className="mt-0.5 text-sm text-[var(--text-dim)]">
                  {formatDate(order.date)}
                  {order.order_id ? ` · #${order.order_id}` : ""}
                </p>
              </div>
              <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[10px] uppercase tracking-wide text-[var(--text-dim)]">
                {order.source}
              </span>
            </div>
            <div className="mt-4 flex items-baseline justify-between">
              <span className="text-sm text-[var(--text-dim)]">Total paid</span>
              <span className="font-mono text-2xl font-semibold tabular-nums text-[var(--primary)]">
                {inr(order.total_paid)}
              </span>
            </div>
            {order.note && (
              <p className="mt-2 text-sm text-[var(--text-dim)]">“{order.note}”</p>
            )}
          </Card>

          {/* Items */}
          <Card className="reveal overflow-hidden p-0" style={{ animationDelay: "60ms" }}>
            <div className="border-b border-[var(--border)] px-4 py-3 text-xs uppercase tracking-wide text-[var(--text-dim)]">
              {order.items.length} item{order.items.length === 1 ? "" : "s"} · valued{" "}
              {inr(order.item_total)}
            </div>
            <ul className="divide-y divide-[var(--border)]">
              {order.items.map((it) => (
                <li key={it.id} className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm text-[var(--text)]">
                      {it.name}
                    </span>
                    <div className="flex items-center gap-1 rounded-lg bg-[var(--surface-2)] px-2">
                      <span className="font-mono text-xs text-[var(--text-dim)]">₹</span>
                      <input
                        inputMode="decimal"
                        defaultValue={String(it.paid)}
                        onBlur={(e) => {
                          const v = parseFloat(e.target.value.replace(/[^0-9.]/g, ""));
                          if (Number.isFinite(v) && v !== it.paid) onChangePaid(it.id, v);
                        }}
                        className="w-16 bg-transparent py-1 text-right font-mono text-sm tabular-nums text-[var(--text)] outline-none"
                        aria-label={`Amount for ${it.name}`}
                      />
                    </div>
                    <button
                      onClick={() => onDeleteItem(it.id)}
                      aria-label="Delete item"
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-dim)] active:bg-[var(--surface-2)]"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2">
                    <CategoryPicker
                      value={it.category}
                      onChange={(c) => onChangeCategory(it.id, c)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          {/* Charges (separate from item spend) */}
          {order.charges.length > 0 && (
            <div className="reveal" style={{ animationDelay: "120ms" }}>
              <ChargesCollapse charges={chargesToObject(order)} />
            </div>
          )}

          <Button variant="danger" fullWidth onClick={onDeleteOrder}>
            <TrashIcon className="h-4 w-4" />
            Delete order
          </Button>
        </div>
      )}
    </main>
  );
}
