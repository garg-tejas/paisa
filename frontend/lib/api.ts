// frontend/lib/api.ts
// Typed client for the FastAPI backend. One function per route; paths and
// shapes mirror the backend exactly (app/routers/* + app/schemas.py).

import type {
  BudgetIn,
  BudgetOut,
  CategoriesSummary,
  ChargesSummary,
  ItemOut,
  ItemUpdate,
  OrderListItem,
  OrderOut,
  ParsedOrder,
  ParseResult,
  PushSubscriptionIn,
  WeeklySummary,
} from "./types";

const RAW_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ?? "http://localhost:8000";

/** Thrown for any non-2xx response, carrying the parsed `detail` when present. */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${RAW_BASE}${path}`, {
    // Always talk to the API fresh; the backend is the source of truth.
    cache: "no-store",
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.detail) {
        detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
      }
    } catch {
      /* non-JSON error body — keep the status line */
    }
    throw new ApiError(res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------
export const health = () => request<{ status: string }>("/health");

// ---------------------------------------------------------------------------
// Parsing (multipart; let the browser set the boundary header)
// ---------------------------------------------------------------------------
function fileForm(file: File): FormData {
  const fd = new FormData();
  fd.append("file", file);
  return fd;
}

export const parsePdf = (file: File) =>
  request<ParseResult>("/parse/pdf", { method: "POST", body: fileForm(file) });

export const parseImage = (file: File) =>
  request<ParseResult>("/parse/image", { method: "POST", body: fileForm(file) });

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------
export const createOrder = (order: ParsedOrder) =>
  request<OrderOut>("/orders", jsonInit("POST", order));

export function listOrders(params: {
  start?: string;
  end?: string;
  platform?: string;
} = {}): Promise<OrderListItem[]> {
  const qs = new URLSearchParams();
  if (params.start) qs.set("start", params.start);
  if (params.end) qs.set("end", params.end);
  if (params.platform) qs.set("platform", params.platform);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request<OrderListItem[]>(`/orders${suffix}`);
}

export const getOrder = (id: string) => request<OrderOut>(`/orders/${id}`);

export const deleteOrder = (id: string) =>
  request<void>(`/orders/${id}`, { method: "DELETE" });

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------
export const updateItem = (id: string, patch: ItemUpdate) =>
  request<ItemOut>(`/items/${id}`, jsonInit("PATCH", patch));

export const deleteItem = (id: string) =>
  request<void>(`/items/${id}`, { method: "DELETE" });

// ---------------------------------------------------------------------------
// Summaries
// ---------------------------------------------------------------------------
export function getCategorySummary(month?: string): Promise<CategoriesSummary> {
  const suffix = month ? `?month=${encodeURIComponent(month)}` : "";
  return request<CategoriesSummary>(`/summary/categories${suffix}`);
}

export function getChargeSummary(month?: string): Promise<ChargesSummary> {
  const suffix = month ? `?month=${encodeURIComponent(month)}` : "";
  return request<ChargesSummary>(`/summary/charges${suffix}`);
}

export function getWeekly(weekStart?: string): Promise<WeeklySummary> {
  const suffix = weekStart ? `?week_start=${encodeURIComponent(weekStart)}` : "";
  return request<WeeklySummary>(`/summary/weekly${suffix}`);
}

// ---------------------------------------------------------------------------
// Budgets
// ---------------------------------------------------------------------------
export function getBudgets(month?: string): Promise<BudgetOut[]> {
  const suffix = month ? `?month=${encodeURIComponent(month)}` : "";
  return request<BudgetOut[]>(`/budgets${suffix}`);
}

export const setBudgets = (budgets: BudgetIn[]) =>
  request<BudgetOut[]>("/budgets", jsonInit("POST", budgets));

// ---------------------------------------------------------------------------
// Push notifications
// ---------------------------------------------------------------------------
export function subscribePush(
  subscription: PushSubscription,
  notifyHour = 22,
): Promise<{ ok: boolean }> {
  const json = subscription.toJSON();
  const payload: PushSubscriptionIn = {
    endpoint: json.endpoint ?? "",
    keys: {
      p256dh: json.keys?.p256dh ?? "",
      auth: json.keys?.auth ?? "",
    },
    notify_hour: notifyHour,
  };
  return request<{ ok: boolean }>(
    "/notifications/subscribe",
    jsonInit("POST", payload),
  );
}

export const testPush = () =>
  request<{ sent: number }>("/notifications/test", { method: "POST" });
