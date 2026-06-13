"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Download, ExternalLink, X, ZoomIn } from "lucide-react";
import { useCallback, useEffect } from "react";
import type { ScreenshotRecord } from "@/lib/types";

function formatCapturedAt(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type ScreenshotViewerProps = {
  shots: ScreenshotRecord[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
};

export function ScreenshotViewer({ shots, index, onClose, onNavigate }: ScreenshotViewerProps) {
  const shot = shots[index];
  const hasPrev = index > 0;
  const hasNext = index < shots.length - 1;

  const goPrev = useCallback(() => {
    if (hasPrev) onNavigate(index - 1);
  }, [hasPrev, index, onNavigate]);

  const goNext = useCallback(() => {
    if (hasNext) onNavigate(index + 1);
  }, [hasNext, index, onNavigate]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") goPrev();
      if (event.key === "ArrowRight") goNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, goPrev, goNext]);

  if (!shot) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--foreground)]/80 p-4 backdrop-blur-md sm:p-8"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="flex h-full max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card-elevated)] shadow-2xl lg:flex-row"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative flex flex-1 items-center justify-center bg-[var(--background)] p-4 lg:p-6">
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 z-10 rounded-xl bg-[var(--card-elevated)]/90 p-2 text-[var(--muted)] shadow-sm backdrop-blur hover:text-[var(--foreground)]"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            {hasPrev ? (
              <button
                type="button"
                onClick={goPrev}
                className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-xl bg-[var(--card-elevated)]/90 p-2.5 text-[var(--foreground)] shadow-md backdrop-blur hover:bg-[var(--card-elevated)]"
                aria-label="Previous screenshot"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            ) : null}

            {hasNext ? (
              <button
                type="button"
                onClick={goNext}
                className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-xl bg-[var(--card-elevated)]/90 p-2.5 text-[var(--foreground)] shadow-md backdrop-blur hover:bg-[var(--card-elevated)] lg:right-auto lg:left-auto lg:translate-x-0"
                style={{ right: "4rem" }}
                aria-label="Next screenshot"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            ) : null}

            {shot.image_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={shot.image_url}
                alt={`Screenshot by ${shot.user_name ?? "employee"}`}
                className="max-h-full max-w-full rounded-lg object-contain shadow-lg"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-[var(--muted)]">
                <ZoomIn className="h-10 w-10 opacity-40" />
                <p className="text-sm">Image unavailable</p>
              </div>
            )}
          </div>

          <aside className="flex w-full shrink-0 flex-col border-t border-[var(--border)] lg:w-80 lg:border-l lg:border-t-0">
            <div className="border-b border-[var(--border-subtle)] px-5 py-4">
              <p className="text-label">Screenshot details</p>
              <p className="text-heading mt-1 text-lg">{shot.user_name ?? `User #${shot.user_id}`}</p>
            </div>
            <dl className="space-y-4 px-5 py-4 text-sm">
              <div>
                <dt className="text-label">Captured</dt>
                <dd className="mt-1 font-medium text-[var(--foreground)]">{formatCapturedAt(shot.captured_at)}</dd>
              </div>
              {shot.project_name ? (
                <div>
                  <dt className="text-label">Project</dt>
                  <dd className="mt-1 font-medium text-[var(--foreground)]">{shot.project_name}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-label">Session</dt>
                <dd className="mt-1 font-mono text-xs text-[var(--muted)]">{shot.session_id}</dd>
              </div>
              <div>
                <dt className="text-label">File size</dt>
                <dd className="mt-1 font-medium text-[var(--foreground)]">{formatFileSize(shot.file_size_bytes)}</dd>
              </div>
              <div>
                <dt className="text-label">Position</dt>
                <dd className="mt-1 text-[var(--muted)]">
                  {index + 1} of {shots.length}
                </dd>
              </div>
            </dl>
            <div className="flex gap-2 border-t border-[var(--border-subtle)] p-4">
              {shot.image_url ? (
                <>
                  <a
                    href={shot.image_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--accent-sand)]"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open
                  </a>
                  <a
                    href={shot.image_url}
                    download
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-3 py-2.5 text-sm font-medium text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)]"
                  >
                    <Download className="h-4 w-4" />
                    Save
                  </a>
                </>
              ) : null}
            </div>
          </aside>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
