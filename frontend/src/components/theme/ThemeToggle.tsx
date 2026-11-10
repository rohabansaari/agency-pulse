"use client";

import { cn } from "@/lib/cn";
import { Moon, Sun } from "lucide-react";
import { THEME_STORAGE_KEY, type Theme } from "@/lib/theme";
import { useSyncExternalStore } from "react";

function readTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  // Fade every colour across instead of snapping, then drop the transitions
  // so normal hovers keep their own timing.
  root.classList.add("theme-switching");
  window.setTimeout(() => root.classList.remove("theme-switching"), 400);
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode or blocked storage: the switch still works for this visit.
  }
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, readTheme, () => "light");
}

/**
 * Light / dark switch. `tone="night"` is for the dark sidebar and headers;
 * `showLabel` adds the "Dark mode" / "Light mode" text next to the icon.
 */
export function ThemeToggle({
  tone = "plain",
  showLabel = false,
  className,
}: {
  tone?: "plain" | "night";
  showLabel?: boolean;
  className?: string;
}) {
  const theme = useTheme();
  const next: Theme = theme === "dark" ? "light" : "dark";
  const label = next === "dark" ? "Dark mode" : "Light mode";

  return (
    <button
      type="button"
      onClick={() => applyTheme(next)}
      aria-label={showLabel ? undefined : `Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className={cn(
        "group inline-flex min-h-11 items-center gap-3 rounded-[0.625rem] text-sm transition",
        showLabel ? "px-3" : "min-w-11 justify-center",
        tone === "night"
          ? "text-[var(--night-text)] hover:bg-white/[0.06] hover:text-white"
          : "border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--accent-sand)]",
        className,
      )}
    >
      <span className="relative h-4 w-4" aria-hidden="true">
        <Sun
          className={cn(
            "absolute inset-0 h-4 w-4 transition-all duration-500",
            theme === "dark" ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0",
          )}
        />
        <Moon
          className={cn(
            "absolute inset-0 h-4 w-4 transition-all duration-500",
            theme === "dark" ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100",
          )}
        />
      </span>
      {showLabel ? <span>{label}</span> : null}
    </button>
  );
}
