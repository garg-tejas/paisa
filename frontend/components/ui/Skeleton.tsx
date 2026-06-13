// frontend/components/ui/Skeleton.tsx
import type { HTMLAttributes } from "react";

function cx(...parts: (string | false | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/** Shimmering placeholder block. Size it with className (h-… / w-…). */
export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        "rounded-md bg-[var(--surface-2)] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.04),transparent)] bg-[length:200%_100%] animate-shimmer",
        className,
      )}
      aria-hidden="true"
      {...props}
    />
  );
}

export default Skeleton;
