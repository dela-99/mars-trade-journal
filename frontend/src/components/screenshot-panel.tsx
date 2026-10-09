import { useRef, useState } from "react";
import { Check, FileImage, ImagePlus, LoaderCircle, Trash2, X } from "lucide-react";
import type { Trade } from "@/api-client";
import { useLocalScreenshots } from "@/hooks/use-local-screenshots";

type ScreenshotPanelProps = {
  open: boolean;
  trade: Trade | null;
  onClose: () => void;
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

export function ScreenshotPanel({ open, trade, onClose }: ScreenshotPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState("");
  const { screenshots, isLoading, isUploading, error, addFiles, remove } = useLocalScreenshots(
    open && trade ? trade.id : null,
  );

  if (!open || !trade) return null;

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setNotice("");
    const added = await addFiles(files);
    if (added) setNotice(`${files.length} screenshot${files.length === 1 ? "" : "s"} added to ${trade.symbol}.`);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="screenshot-panel-title">
      <div className="modal-card max-w-2xl animate-rise">
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div>
            <p className="font-mono-custom text-[10px] font-medium uppercase tracking-[.2em] text-primary">
              Review evidence / local
            </p>
            <h2 id="screenshot-panel-title" className="mt-1 font-display text-2xl font-bold tracking-tight">
              Screenshots for {trade.symbol}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Stored only in this browser and linked to this journal entry.
            </p>
          </div>
          <button type="button" className="btn-quiet" onClick={onClose} aria-label="Close screenshots" data-testid="button-close-screenshots">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 px-6 py-6">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(event) => void handleFiles(event.target.files)}
            data-testid="input-trade-screenshots"
          />
          <button
            type="button"
            className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-primary/35 bg-primary/5 px-5 py-8 text-center transition hover:border-primary hover:bg-primary/10"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
            data-testid="button-add-screenshots"
          >
            {isUploading ? <LoaderCircle size={24} className="animate-spin text-primary" /> : <ImagePlus size={24} className="text-primary" />}
            <span className="mt-3 text-sm font-bold">{isUploading ? "Adding screenshots…" : "Add screenshots"}</span>
            <span className="mt-1 text-xs text-muted-foreground">PNG, JPG, WEBP, or GIF · up to 10 MB each</span>
          </button>

          {(error || notice) && (
            <div className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${error ? "border-destructive/25 bg-destructive/5 text-destructive" : "border-primary/25 bg-primary/5 text-primary"}`} role={error ? "alert" : "status"}>
              {error ? <X size={16} className="mt-0.5 shrink-0" /> : <Check size={16} className="mt-0.5 shrink-0" />}
              <span>{error || notice}</span>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              <LoaderCircle size={18} className="mr-2 animate-spin" /> Loading screenshots…
            </div>
          ) : screenshots.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-muted/30 px-5 py-10 text-center">
              <FileImage size={24} className="text-muted-foreground" />
              <p className="mt-3 text-sm font-semibold">No screenshots attached</p>
              <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
                Add chart captures or setup references to make this trade easier to review later.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {screenshots.map((screenshot) => (
                <div key={screenshot.id} className="group overflow-hidden rounded-xl border border-border bg-card">
                  <a href={screenshot.previewUrl} target="_blank" rel="noreferrer" className="block aspect-[4/3] bg-muted">
                    <img src={screenshot.previewUrl} alt={screenshot.name} className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
                  </a>
                  <div className="flex items-start justify-between gap-2 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold" title={screenshot.name}>{screenshot.name}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">{formatDate(screenshot.createdAt)}</p>
                    </div>
                    <button type="button" className="btn-quiet shrink-0 p-1.5 text-muted-foreground hover:text-destructive" onClick={() => void remove(screenshot.id)} aria-label={`Delete ${screenshot.name}`} data-testid={`button-delete-screenshot-${screenshot.id}`}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end border-t border-border pt-4">
            <button type="button" className="btn-quiet" onClick={onClose} data-testid="button-done-screenshots">Done</button>
          </div>
        </div>
      </div>
    </div>
  );
}