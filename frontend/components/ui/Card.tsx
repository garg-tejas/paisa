// frontend/components/ui/Card.tsx
import type { HTMLAttributes } from "react";

function cx(...parts: (string | false | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/** Surface panel with the Midnight Ledger hairline + radius. Forwards all div props. */
export function Card({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        "rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export default Card;
