"use client";

import { CATEGORIES, colorFor } from "@/lib/categories";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { CategoryIcon, Check } from "@/components/Icons";
import { useState } from "react";

interface CategoryPickerProps {
  /** Currently selected category (one of the 8 strings). */
  value: string;
  /** Called with the newly selected category string. */
  onChange: (category: string) => void;
  /**
   * Render mode:
   *  - "chip": a tappable pill that opens a bottom-sheet list (used inline in review cards / manual form).
   *  - "grid": an always-visible 2-column grid of category buttons.
   */
  variant?: "chip" | "grid";
  /** Optional label shown above the picker in grid mode. */
  label?: string;
}

/**
 * CategoryPicker — tappable category selector.
 * In "chip" mode it shows the current category as a colored pill and opens a
 * bottom-sheet with all 8 categories. In "grid" mode it shows them inline.
 */
export function CategoryPicker({
  value,
  onChange,
  variant = "chip",
  label,
}: CategoryPickerProps) {
  const [open, setOpen] = useState(false);

  if (variant === "grid") {
    return (
      <div className="flex flex-col gap-2">
        {label ? (
          <span className="text-xs font-sans uppercase tracking-wide text-[var(--text-dim)]">
            {label}
          </span>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          {CATEGORIES.map((cat) => (
            <CategoryOption
              key={cat}
              category={cat}
              selected={cat === value}
              onSelect={() => onChange(cat)}
            />
          ))}
        </div>
      </div>
    );
  }

  const color = colorFor(value);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-left font-sans text-sm text-[var(--text)] transition-colors active:bg-[var(--surface)]"
      >
        <span aria-hidden style={{ color }}>
          <CategoryIcon category={value} className="h-4 w-4" />
        </span>
        <span className="truncate">{value || "Pick category"}</span>
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)}>
        <div className="flex flex-col gap-3 pb-2">
          <h3 className="font-display text-lg text-[var(--text)]">
            Choose a category
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map((cat) => (
              <CategoryOption
                key={cat}
                category={cat}
                selected={cat === value}
                onSelect={() => {
                  onChange(cat);
                  setOpen(false);
                }}
              />
            ))}
          </div>
        </div>
      </BottomSheet>
    </>
  );
}

function CategoryOption({
  category,
  selected,
  onSelect,
}: {
  category: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const color = colorFor(category);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="flex min-h-[44px] items-center gap-2 rounded-[14px] border bg-[var(--surface-2)] px-3 py-2.5 text-left font-sans text-sm transition-colors active:bg-[var(--surface)]"
      style={{
        borderColor: selected ? color : "var(--border)",
        boxShadow: selected ? `inset 0 0 0 1px ${color}` : undefined,
      }}
    >
      <span aria-hidden style={{ color }}>
        <CategoryIcon category={category} className="h-4 w-4" />
      </span>
      <span className="flex-1 truncate text-[var(--text)]">{category}</span>
      {selected ? (
        <span style={{ color }} aria-hidden>
          <Check className="h-4 w-4" />
        </span>
      ) : null}
    </button>
  );
}

export default CategoryPicker;
