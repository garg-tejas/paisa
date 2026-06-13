// frontend/components/ui/BottomSheet.tsx
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Optional title rendered in the sheet header. */
  title?: string;
}

/**
 * Mobile bottom sheet: dimmed backdrop + slide-up panel pinned to the bottom,
 * capped at the app's max width. Closes on backdrop tap or Escape; locks body
 * scroll while open. Rendered into document.body via a portal.
 */
export function BottomSheet({ open, onClose, children, title }: BottomSheetProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={title ?? "Sheet"}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-md animate-slide-up">
        <div className="max-h-[88dvh] overflow-y-auto rounded-t-[28px] border-t border-[var(--border)] bg-[var(--surface)] px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-3 no-scrollbar">
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[var(--border)]" />
          {title && (
            <h2 className="mb-3 font-display text-xl font-semibold text-[var(--text)]">
              {title}
            </h2>
          )}
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default BottomSheet;
