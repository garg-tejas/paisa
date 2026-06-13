// frontend/components/ui/Badge.tsx
import type { HTMLAttributes } from "react";

function cx(...parts: (string | false | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Accent color (hex or CSS var). Renders a tinted pill. */
  tone?: string;
}

/** Small tinted pill. `tone` colors both text and a 14%-alpha background. */
export function Badge({ tone, className, children, style, ...props }: BadgeProps) {
  const tinted = tone
    ? { color: tone, backgroundColor: `${tone}22`, ...style }
    : style;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        !tone && "bg-[var(--surface-2)] text-[var(--text-dim)]",
        className,
      )}
      style={tinted}
      {...props}
    >
      {children}
    </span>
  );
}

export default Badge;
