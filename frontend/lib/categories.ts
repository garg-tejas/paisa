// frontend/lib/categories.ts
// The 8 fixed categories + colors, icons, and slug helpers.

import type { Category } from "./types";

/** The 8 categories, in canonical order. Exact strings — do not edit. */
export const CATEGORIES: Category[] = [
  "Food & Dining",
  "Groceries & Essentials",
  "Transport",
  "Health & Personal Care",
  "Shopping",
  "Entertainment",
  "Utilities & Subscriptions",
  "Other",
];

/** Per-category accent colors (Midnight Ledger palette). */
export const CATEGORY_COLORS: Record<Category, string> = {
  "Food & Dining": "#FF8A5C",
  "Groceries & Essentials": "#D6FB51",
  Transport: "#5CC8FF",
  "Health & Personal Care": "#5CE6A0",
  Shopping: "#C98BFF",
  Entertainment: "#FF5C9E",
  "Utilities & Subscriptions": "#FFD45C",
  Other: "#9A968C",
};

/**
 * Per-category icon keys. These map to the inline SVG icon set in
 * components/Icons.tsx. Kept as stable string keys so both layers agree.
 */
export const CATEGORY_ICONS: Record<Category, string> = {
  "Food & Dining": "food",
  "Groceries & Essentials": "groceries",
  Transport: "transport",
  "Health & Personal Care": "health",
  Shopping: "shopping",
  Entertainment: "entertainment",
  "Utilities & Subscriptions": "utilities",
  Other: "other",
};

/** Stable slug per category for /category/[slug] routes. */
const CATEGORY_TO_SLUG: Record<Category, string> = {
  "Food & Dining": "food-dining",
  "Groceries & Essentials": "groceries-essentials",
  Transport: "transport",
  "Health & Personal Care": "health-personal-care",
  Shopping: "shopping",
  Entertainment: "entertainment",
  "Utilities & Subscriptions": "utilities-subscriptions",
  Other: "other",
};

const SLUG_TO_CATEGORY: Record<string, Category> = Object.entries(
  CATEGORY_TO_SLUG
).reduce<Record<string, Category>>((acc, [cat, s]) => {
  acc[s] = cat as Category;
  return acc;
}, {});

/** category -> URL slug (e.g. "Food & Dining" -> "food-dining"). */
export function slug(category: string): string {
  if (category in CATEGORY_TO_SLUG) {
    return CATEGORY_TO_SLUG[category as Category];
  }
  // Fallback: generic slugify for unknown categories.
  return category
    .toLowerCase()
    .trim()
    .replace(/&/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** URL slug -> category (e.g. "food-dining" -> "Food & Dining"). */
export function unslug(s: string): Category {
  return SLUG_TO_CATEGORY[s] ?? "Other";
}

/** True if a string is one of the 8 canonical categories. */
export function isCategory(value: string): value is Category {
  return (CATEGORIES as string[]).includes(value);
}

/** Color for a category string, falling back to "Other". */
export function colorFor(category: string): string {
  return isCategory(category)
    ? CATEGORY_COLORS[category]
    : CATEGORY_COLORS.Other;
}

/** Icon key for a category string, falling back to "Other". */
export function iconFor(category: string): string {
  return isCategory(category) ? CATEGORY_ICONS[category] : CATEGORY_ICONS.Other;
}
