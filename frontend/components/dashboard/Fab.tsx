"use client";

import { useAddSheet } from "@/components/entry/AddSheetProvider";
import { PlusIcon } from "@/components/Icons";

/**
 * Fab — chartreuse floating action button.
 * Lives in the center FAB slot of the AppShell bottom nav.
 * Opens the add sheet (Quick add / Upload receipt) via useAddSheet().
 */
export default function Fab() {
  const { open } = useAddSheet();

  return (
    <button
      type="button"
      aria-label="Add expense"
      onClick={open}
      className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-ink)] shadow-[0_8px_24px_rgba(214,251,81,0.35)] ring-4 ring-[var(--bg)] transition-transform duration-150 active:scale-90"
    >
      <PlusIcon className="h-7 w-7" />
    </button>
  );
}
