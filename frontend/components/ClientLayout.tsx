"use client";

// Handles two concerns in one place:
//   1. Auth guard — redirects to /login if no token is stored.
//   2. Shell toggle — /login gets bare children (no nav bar / FAB / sheet).

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import AppShell from "@/components/AppShell";
import { AddSheetProvider } from "@/components/entry/AddSheetProvider";
import { getToken } from "@/lib/auth";

const PUBLIC_PATHS = new Set(["/login"]);

export default function ClientLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC_PATHS.has(pathname);

  // Start as "not ready" for protected pages to avoid flashing content before
  // the auth check runs. Public pages (login) are always ready immediately.
  const [ready, setReady] = useState(isPublic);

  useEffect(() => {
    if (isPublic) {
      setReady(true);
      return;
    }
    if (!getToken()) {
      router.replace("/login");
    } else {
      setReady(true);
    }
  }, [isPublic, router]);

  if (isPublic) return <>{children}</>;
  if (!ready) return null;

  return (
    <AddSheetProvider>
      <AppShell>{children}</AppShell>
    </AddSheetProvider>
  );
}
