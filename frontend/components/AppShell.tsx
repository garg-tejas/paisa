// frontend/components/AppShell.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import Fab from "@/components/dashboard/Fab";
import {
  BudgetIcon,
  CalendarIcon,
  HomeIcon,
  ReceiptIcon,
} from "@/components/Icons";

const TABS = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/fees", label: "Fees", Icon: ReceiptIcon },
  { href: "/budgets", label: "Budgets", Icon: BudgetIcon },
  { href: "/weekly", label: "Weekly", Icon: CalendarIcon },
];

/**
 * App chrome: atmospheric background (radial glow + grain), the scrollable
 * page area, and a fixed bottom nav with a center FAB. Wraps every page.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <>
      {/* Atmosphere */}
      <div className="ml-bg" aria-hidden="true" />
      <div className="ml-grain" aria-hidden="true" />

      {/* Page */}
      <div className="relative mx-auto min-h-[100dvh] w-full max-w-md">
        {children}
      </div>

      {/* Bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-40 pb-safe">
        <div className="mx-auto w-full max-w-md px-4 pb-3">
          <div className="relative flex items-center justify-between rounded-[26px] border border-[var(--border)] bg-[var(--surface)]/85 px-2 py-2 backdrop-blur-xl">
            <NavItem tab={TABS[0]} active={isActive(TABS[0].href)} />
            <NavItem tab={TABS[1]} active={isActive(TABS[1].href)} />

            {/* Center FAB */}
            <div className="flex w-14 shrink-0 justify-center">
              <Fab />
            </div>

            <NavItem tab={TABS[2]} active={isActive(TABS[2].href)} />
            <NavItem tab={TABS[3]} active={isActive(TABS[3].href)} />
          </div>
        </div>
      </nav>
    </>
  );
}

function NavItem({
  tab,
  active,
}: {
  tab: { href: string; label: string; Icon: (p: { className?: string }) => ReactNode };
  active: boolean;
}) {
  const { href, label, Icon } = tab;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex h-12 w-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[10px] transition-colors ${
        active ? "text-[var(--primary)]" : "text-[var(--text-dim)]"
      }`}
    >
      <Icon className="h-5 w-5" />
      <span>{label}</span>
    </Link>
  );
}

export default AppShell;
