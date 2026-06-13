// frontend/components/entry/AddSheetProvider.tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ManualForm } from "./ManualForm";
import { UploadFlow } from "./UploadFlow";

interface AddSheetContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const AddSheetContext = createContext<AddSheetContextValue | null>(null);

type Tab = "quick" | "upload";

/**
 * Provides the global "add expense" bottom sheet. Any component can call
 * useAddSheet().open() (e.g. the FAB) to launch it. The sheet has two tabs:
 * Quick add (manual) and Upload receipt (parse → review → save).
 */
export function AddSheetProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("quick");

  const open = useCallback(() => {
    setTab("quick");
    setIsOpen(true);
  }, []);
  const close = useCallback(() => setIsOpen(false), []);

  const onSaved = useCallback(() => {
    setIsOpen(false);
    // Pull fresh data into whatever screen is mounted (optimistic close first).
    router.refresh();
  }, [router]);

  const value = useMemo(() => ({ isOpen, open, close }), [isOpen, open, close]);

  return (
    <AddSheetContext.Provider value={value}>
      {children}
      <BottomSheet open={isOpen} onClose={close} title="Add an expense">
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-[var(--surface-2)] p-1">
          <TabButton active={tab === "quick"} onClick={() => setTab("quick")}>
            Quick add
          </TabButton>
          <TabButton active={tab === "upload"} onClick={() => setTab("upload")}>
            Upload receipt
          </TabButton>
        </div>

        {tab === "quick" ? (
          <ManualForm onSaved={onSaved} />
        ) : (
          <UploadFlow onSaved={onSaved} />
        )}
      </BottomSheet>
    </AddSheetContext.Provider>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-10 rounded-xl text-sm font-medium transition-colors ${
        active
          ? "bg-[var(--surface)] text-[var(--text)] shadow-sm"
          : "text-[var(--text-dim)]"
      }`}
    >
      {children}
    </button>
  );
}

export function useAddSheet(): AddSheetContextValue {
  const ctx = useContext(AddSheetContext);
  if (!ctx) {
    throw new Error("useAddSheet must be used within an AddSheetProvider");
  }
  return ctx;
}

export default AddSheetProvider;
