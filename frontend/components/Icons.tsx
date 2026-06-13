// frontend/components/Icons.tsx
// Inline SVG icon set (stroke = currentColor). All accept standard SVG props
// so callers control size/color via className (e.g. "h-5 w-5 text-...").

import type { ReactElement, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      width="1em"
      height="1em"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

// --- Navigation / actions -------------------------------------------------
export function HomeIcon(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
    </Base>
  );
}

export function ReceiptIcon(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M6 2.5h12a1 1 0 0 1 1 1V21l-2.5-1.5L14 21l-2-1.5L10 21l-2.5-1.5L5 21V3.5a1 1 0 0 1 1-1Z" />
      <path d="M8.5 8h7M8.5 11.5h7M8.5 15h4" />
    </Base>
  );
}

export function BudgetIcon(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7.5Z" />
      <path d="M3 9h13.5a1.5 1.5 0 0 1 1.5 1.5v3A1.5 1.5 0 0 1 16.5 15H3" />
      <circle cx="16" cy="12" r="1.1" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function CalendarIcon(p: IconProps) {
  return (
    <Base {...p}>
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </Base>
  );
}

export function PlusIcon(p: IconProps) {
  return (
    <Base {...p} strokeWidth={2.2}>
      <path d="M12 5v14M5 12h14" />
    </Base>
  );
}

export function CameraIcon(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M4 8.5a2 2 0 0 1 2-2h1.6l1-1.6h4.8l1 1.6H18a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8.5Z" />
      <circle cx="12" cy="13" r="3.2" />
    </Base>
  );
}

export function UploadIcon(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M12 16V4m0 0L8 8m4-4 4 4" />
      <path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" />
    </Base>
  );
}

export function EditIcon(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M4 20h4L19 9l-4-4L4 16v4Z" />
      <path d="M13.5 6.5 17.5 10.5" />
    </Base>
  );
}

export function TrashIcon(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6 7v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7M10 11v6M14 11v6" />
    </Base>
  );
}

export function Check(p: IconProps) {
  return (
    <Base {...p} strokeWidth={2.4}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </Base>
  );
}
export const CheckIcon = Check;

export function Chevron(p: IconProps) {
  return (
    <Base {...p}>
      <path d="m9 5 7 7-7 7" />
    </Base>
  );
}
export const ChevronIcon = Chevron;

export function CloseIcon(p: IconProps) {
  return (
    <Base {...p} strokeWidth={2.2}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Base>
  );
}
export const XIcon = CloseIcon;

export function BellIcon(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </Base>
  );
}

export function SparkleIcon(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M12 3.5c.8 3.6 1.9 4.7 5.5 5.5-3.6.8-4.7 1.9-5.5 5.5-.8-3.6-1.9-4.7-5.5-5.5 3.6-.8 4.7-1.9 5.5-5.5Z" />
      <path d="M18.5 14.5c.4 1.6.9 2.1 2.5 2.5-1.6.4-2.1.9-2.5 2.5-.4-1.6-.9-2.1-2.5-2.5 1.6-.4 2.1-.9 2.5-2.5Z" />
    </Base>
  );
}

export function TrendUpIcon(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M4 16 10 10l3.5 3.5L20 7" />
      <path d="M20 11V7h-4" />
    </Base>
  );
}

export function TrendDownIcon(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M4 8 10 14l3.5-3.5L20 17" />
      <path d="M20 13v4h-4" />
    </Base>
  );
}

// --- Category icons -------------------------------------------------------
// One glyph per category. `CategoryIcon` switches on the category string so
// callers can render the right mark from a plain string.

const CATEGORY_PATHS: Record<string, ReactElement> = {
  "Food & Dining": (
    <>
      <path d="M6 3v7a2 2 0 0 0 4 0V3M8 3v18M16 3c-1.5 0-2.5 2-2.5 5s1 4 2.5 4v9" />
    </>
  ),
  "Groceries & Essentials": (
    <>
      <path d="M4 5h2l1.5 10.5a1 1 0 0 0 1 .9h7.6a1 1 0 0 0 1-.8L19 8H7" />
      <circle cx="9.5" cy="20" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="16.5" cy="20" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  Transport: (
    <>
      <path d="M5 16V9.5L6.5 6h11L19 9.5V16" />
      <path d="M4 16h16v2.5a.5.5 0 0 1-.5.5H18a.5.5 0 0 1-.5-.5V16M6.5 19H5a.5.5 0 0 1-.5-.5V16" />
      <path d="M5 11h14" />
    </>
  ),
  "Health & Personal Care": (
    <>
      <path d="M12 21s-7-4.4-7-9.5A4.5 4.5 0 0 1 12 8a4.5 4.5 0 0 1 7 3.5C19 16.6 12 21 12 21Z" />
    </>
  ),
  Shopping: (
    <>
      <path d="M6 8h12l-1 12a1 1 0 0 1-1 .9H8a1 1 0 0 1-1-.9L6 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </>
  ),
  Entertainment: (
    <>
      <path d="m9 8 8 4-8 4V8Z" />
      <circle cx="12" cy="12" r="9" />
    </>
  ),
  "Utilities & Subscriptions": (
    <>
      <path d="M13 3 4 14h7l-1 7 9-11h-7l1-7Z" />
    </>
  ),
  Other: (
    <>
      <circle cx="6" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
};

export function CategoryIcon({
  category,
  ...props
}: IconProps & { category: string }) {
  return <Base {...props}>{CATEGORY_PATHS[category] ?? CATEGORY_PATHS.Other}</Base>;
}
