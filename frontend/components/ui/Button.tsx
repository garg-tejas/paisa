// frontend/components/ui/Button.tsx
import type { ButtonHTMLAttributes } from "react";

function cx(...parts: (string | false | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "ghost" | "danger" | "surface";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-[var(--primary)] text-[var(--primary-ink)] font-semibold active:brightness-95",
  ghost:
    "bg-transparent text-[var(--text)] border border-[var(--border)] active:bg-[var(--surface-2)]",
  danger:
    "bg-transparent text-[var(--danger)] border border-[var(--danger)]/40 active:bg-[var(--danger)]/10",
  surface:
    "bg-[var(--surface-2)] text-[var(--text)] active:bg-[var(--surface)]",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3 text-sm rounded-xl",
  md: "h-11 px-4 text-sm rounded-2xl",
  lg: "h-13 px-5 text-base rounded-2xl",
};

export function Button({
  variant = "primary",
  size = "md",
  fullWidth,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 font-sans transition-[transform,filter,background-color] duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export default Button;
