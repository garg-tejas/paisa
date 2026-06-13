// frontend/lib/types.ts
// TypeScript interfaces mirroring the backend Pydantic schemas EXACTLY.
// Single source of truth for API payloads/responses on the frontend.

/** One of the 8 fixed categories (see lib/categories.ts CATEGORIES). */
export type Category =
  | "Food & Dining"
  | "Groceries & Essentials"
  | "Transport"
  | "Health & Personal Care"
  | "Shopping"
  | "Entertainment"
  | "Utilities & Subscriptions"
  | "Other";

/** Platforms recognized by the parser / order model. */
export type Platform = "Blinkit" | "Instamart" | "Swiggy" | "Zomato" | "Manual";

/** Source of an order / parse result. */
export type OrderSource = "pdf" | "image" | "manual";
export type ParseSource = "pdf" | "image";

/** Charge types (never folded into item costs — flow only to Platform Fees). */
export type ChargeType =
  | "delivery"
  | "handling"
  | "platform_fee"
  | "packaging"
  | "rain_fee"
  | "taxes"
  | "other";

// ---------------------------------------------------------------------------
// Parse / order payload schemas
// ---------------------------------------------------------------------------

/** Item(name:str, mrp:float|None=None, discount:float=0, paid:float, category:str) */
export interface Item {
  name: string;
  mrp?: number | null;
  discount: number;
  paid: number;
  category: string;
}

/**
 * Charges(delivery:float=0, handling:float=0, platform_fee:float=0,
 *         packaging:float=0, rain_fee:float=0, taxes:float=0, other:float=0)
 */
export interface Charges {
  delivery: number;
  handling: number;
  platform_fee: number;
  packaging: number;
  rain_fee: number;
  taxes: number;
  other: number;
}

/** Discounts(coupon:float=0, membership:float=0, other:float=0) */
export interface Discounts {
  coupon: number;
  membership: number;
  other: number;
}

/**
 * ParsedOrder — used as BOTH parse result payload and POST /orders body.
 * ParsedOrder(platform:str, date:str, order_id:str|None=None, items:list[Item],
 *   charges:Charges=Charges(), discounts:Discounts=Discounts(),
 *   item_total:float=0, total_paid:float=0)
 */
export interface ParsedOrder {
  platform: string;
  date: string;
  order_id?: string | null;
  items: Item[];
  charges: Charges;
  discounts: Discounts;
  item_total: number;
  total_paid: number;
  /** Set on save: "manual" for quick entry, "pdf"/"image" for confirmed uploads. */
  source?: OrderSource;
  /** Optional free-text note, maps to orders.note. */
  note?: string | null;
}

/** ParseResult(order:ParsedOrder, confidence:float, needs_review:bool, source:str) */
export interface ParseResult {
  order: ParsedOrder;
  confidence: number;
  needs_review: boolean;
  source: ParseSource;
}

// ---------------------------------------------------------------------------
// Read / output schemas
// ---------------------------------------------------------------------------

/** ItemOut(id:str, order_id:str, name:str, mrp:float|None, discount:float, paid:float, category:str) */
export interface ItemOut {
  id: string;
  order_id: string;
  name: string;
  mrp: number | null;
  discount: number;
  paid: number;
  category: string;
}

/** ChargeOut(id:str, type:str, amount:float) */
export interface ChargeOut {
  id: string;
  type: string;
  amount: number;
}

/**
 * OrderOut(id:str, platform:str, date:str, order_id:str|None, item_total:float,
 *   total_paid:float, source:str, note:str|None, created_at:str,
 *   items:list[ItemOut], charges:list[ChargeOut])
 */
export interface OrderOut {
  id: string;
  platform: string;
  date: string;
  order_id: string | null;
  item_total: number;
  total_paid: number;
  source: string;
  note: string | null;
  created_at: string;
  items: ItemOut[];
  charges: ChargeOut[];
}

/**
 * OrderListItem(id:str, platform:str, date:str, total_paid:float,
 *   item_total:float, source:str, item_count:int)
 */
export interface OrderListItem {
  id: string;
  platform: string;
  date: string;
  total_paid: number;
  item_total: number;
  source: string;
  item_count: number;
}

/** ItemUpdate(name:str|None=None, paid:float|None=None, category:str|None=None) */
export interface ItemUpdate {
  name?: string | null;
  paid?: number | null;
  category?: string | null;
}

// ---------------------------------------------------------------------------
// Budgets
// ---------------------------------------------------------------------------

/** BudgetIn(category:str, month:str, limit_amount:float)  -- month "YYYY-MM" */
export interface BudgetIn {
  category: string;
  month: string;
  limit_amount: number;
}

/** BudgetOut(id:str, category:str, month:str, limit_amount:float, spent:float) */
export interface BudgetOut {
  id: string;
  category: string;
  month: string;
  limit_amount: number;
  spent: number;
}

// ---------------------------------------------------------------------------
// Summaries
// ---------------------------------------------------------------------------

/**
 * CategorySummary(category:str, spent:float, item_count:int, order_count:int,
 *   budget:float|None, pct:float|None)
 */
export interface CategorySummary {
  category: string;
  spent: number;
  item_count: number;
  order_count: number;
  budget: number | null;
  pct: number | null;
}

/**
 * CategoriesSummary(month:str, total_spent:float, total_budget:float,
 *   categories:list[CategorySummary])
 */
export interface CategoriesSummary {
  month: string;
  total_spent: number;
  total_budget: number;
  categories: CategorySummary[];
}

/**
 * ChargeSummary(platform:str, delivery:float, handling:float, platform_fee:float,
 *   packaging:float, rain_fee:float, taxes:float, other:float, total:float)
 */
export interface ChargeSummary {
  platform: string;
  delivery: number;
  handling: number;
  platform_fee: number;
  packaging: number;
  rain_fee: number;
  taxes: number;
  other: number;
  total: number;
}

/** ChargesSummary(month:str, total:float, platforms:list[ChargeSummary]) */
export interface ChargesSummary {
  month: string;
  total: number;
  platforms: ChargeSummary[];
}

/** Daily item in WeeklySummary.daily: {date, amount}. */
export interface DailyPoint {
  date: string;
  amount: number;
}

/** Biggest order shape inside WeeklySummary (loose dict on the backend). */
export interface WeeklyBiggestOrder {
  id?: string;
  platform?: string;
  date?: string;
  total_paid?: number;
  [key: string]: unknown;
}

/**
 * WeeklySummary(week_start:str, week_end:str, total_spent:float,
 *   top_category:str|None, top_category_amount:float, biggest_order:dict|None,
 *   prev_week_total:float, delta_pct:float, daily:list[dict])
 */
export interface WeeklySummary {
  week_start: string;
  week_end: string;
  total_spent: number;
  top_category: string | null;
  top_category_amount: number;
  biggest_order: WeeklyBiggestOrder | null;
  prev_week_total: number;
  delta_pct: number;
  daily: DailyPoint[];
}

// ---------------------------------------------------------------------------
// Push
// ---------------------------------------------------------------------------

/** PushSubscriptionIn(endpoint:str, keys:dict, notify_hour:int=22) — keys has p256dh & auth. */
export interface PushSubscriptionIn {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  notify_hour: number;
}
