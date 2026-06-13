// frontend/components/entry/UploadFlow.tsx
"use client";

import { useRef, useState } from "react";
import { ReviewCards } from "./ReviewCards";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { CameraIcon, UploadIcon } from "@/components/Icons";
import { ApiError, createOrder, parseImage, parsePdf } from "@/lib/api";
import type { ParsedOrder, ParseResult } from "@/lib/types";

type Stage = "pick" | "parsing" | "review";

/** Upload an image or PDF receipt → parse → review editable items → save. */
export function UploadFlow({ onSaved }: { onSaved: () => void }) {
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("pick");
  const [result, setResult] = useState<ParseResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setStage("parsing");
    try {
      const isPdf =
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf");
      const parsed = isPdf ? await parsePdf(file) : await parseImage(file);
      setResult(parsed);
      setStage("review");
    } catch (e) {
      const msg =
        e instanceof ApiError && e.status === 503
          ? "Image parsing isn't configured (no GLM key). Try Quick add instead."
          : e instanceof Error
            ? e.message
            : "Could not read that file.";
      setError(msg);
      setStage("pick");
      toast(msg, "error");
    }
  }

  async function confirm(order: ParsedOrder) {
    setSaving(true);
    try {
      // Record the true origin (pdf | image) rather than the schema default.
      await createOrder({ ...order, source: result?.source ?? order.source });
      toast("Saved", "success");
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save", "error");
    } finally {
      setSaving(false);
    }
  }

  if (stage === "parsing") {
    return (
      <div className="flex flex-col gap-3 py-2">
        <p className="text-center text-sm text-[var(--text-dim)]">
          Reading your receipt…
        </p>
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (stage === "review" && result) {
    return (
      <ReviewCards
        order={result.order}
        confidence={result.confidence}
        saving={saving}
        onConfirm={confirm}
        onCancel={() => {
          setResult(null);
          setStage("pick");
        }}
      />
    );
  }

  // stage === "pick"
  return (
    <div className="flex flex-col gap-3 py-2">
      <input
        ref={fileInput}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        id="paisa-camera-input"
        onChange={(e) => onFile(e.target.files?.[0])}
      />

      <button
        type="button"
        onClick={() => fileInput.current?.click()}
        className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] px-4 py-10 text-center transition-colors active:bg-[var(--surface)]"
      >
        <UploadIcon className="h-8 w-8 text-[var(--primary)]" />
        <span className="text-sm font-medium text-[var(--text)]">
          Upload a receipt
        </span>
        <span className="text-xs text-[var(--text-dim)]">
          Image (Swiggy screenshot) or PDF invoice
        </span>
      </button>

      <Button
        variant="surface"
        size="lg"
        onClick={() => document.getElementById("paisa-camera-input")?.click()}
      >
        <CameraIcon className="h-5 w-5" />
        Take a photo
      </Button>

      {error && (
        <p className="text-center text-xs text-[var(--danger)]">{error}</p>
      )}
    </div>
  );
}

export default UploadFlow;
