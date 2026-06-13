"use client";

import { cn } from "@/lib/cn";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Search } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

export type MultiSelectOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

type MultiSelectProps = {
  values: string[];
  onChange: (values: string[]) => void;
  options: MultiSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  className?: string;
  id?: string;
  selectAllLabel?: string;
};

function useMenuPosition(
  open: boolean,
  triggerRef: React.RefObject<HTMLButtonElement | null>,
) {
  const [style, setStyle] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setStyle(null);
      return;
    }

    function update() {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const gap = 6;
      const spaceBelow = window.innerHeight - rect.bottom - gap;
      const spaceAbove = rect.top - gap;
      const preferred = 280;
      const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
      const maxHeight = Math.min(preferred, openUp ? spaceAbove : spaceBelow);
      setStyle({
        top: openUp ? rect.top + window.scrollY - maxHeight - gap : rect.bottom + window.scrollY + gap,
        left: rect.left + window.scrollX,
        width: Math.max(rect.width, 240),
        maxHeight: Math.max(maxHeight, 120),
      });
    }

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, triggerRef]);

  return style;
}

export function MultiSelect({
  values,
  onChange,
  options,
  placeholder = "Select employees…",
  disabled = false,
  searchable,
  searchPlaceholder = "Search employees…",
  className,
  id,
  selectAllLabel = "Select all",
}: MultiSelectProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const position = useMenuPosition(open, triggerRef);

  const showSearch = searchable ?? options.length > 5;
  const enabledOptions = useMemo(() => options.filter((o) => !o.disabled), [options]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.description?.toLowerCase().includes(q),
    );
  }, [options, query]);

  const allSelected =
    enabledOptions.length > 0 &&
    enabledOptions.every((o) => values.includes(o.value));

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      close();
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, close]);

  function toggleValue(value: string) {
    if (values.includes(value)) {
      onChange(values.filter((v) => v !== value));
    } else {
      onChange([...values, value]);
    }
  }

  function toggleAll() {
    if (allSelected) {
      onChange([]);
    } else {
      onChange(enabledOptions.map((o) => o.value));
    }
  }

  const summary =
    values.length === 0
      ? placeholder
      : values.length === 1
        ? options.find((o) => o.value === values[0])?.label ?? "1 selected"
        : `${values.length} employees selected`;

  const menu =
    open && position ? (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: open ? -4 : 4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: open ? -4 : 4, scale: 0.98 }}
          transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: "absolute",
            top: position.top,
            left: position.left,
            width: position.width,
            zIndex: 9999,
          }}
          className="origin-top"
        >
          <div
            ref={menuRef}
            className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card-elevated)]"
            style={{ boxShadow: "var(--shadow-dropdown)", maxHeight: position.maxHeight }}
          >
            {showSearch ? (
              <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-3 py-2.5">
                <Search className="h-4 w-4 shrink-0 text-[var(--muted)]" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
                />
              </div>
            ) : null}
            <div className="overflow-y-auto py-1.5" style={{ maxHeight: position.maxHeight - (showSearch ? 48 : 0) - 44 }}>
              <button
                type="button"
                onClick={toggleAll}
                className="flex w-full items-center gap-3 border-b border-[var(--border-subtle)] px-3.5 py-2.5 text-left text-sm font-medium text-[var(--primary)] hover:bg-[var(--primary-muted)]"
              >
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                    allSelected
                      ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                      : "border-[var(--border)] bg-[var(--card)]",
                  )}
                >
                  {allSelected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                </span>
                {allSelected ? "Clear all" : selectAllLabel}
              </button>
              {filtered.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-[var(--muted)]">No matches found</p>
              ) : (
                filtered.map((option) => {
                  const selected = values.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={option.disabled}
                      onClick={() => toggleValue(option.value)}
                      className={cn(
                        "flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-[var(--primary-muted)]",
                        option.disabled && "cursor-not-allowed opacity-40",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                          selected
                            ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                            : "border-[var(--border)] bg-[var(--card)]",
                        )}
                      >
                        {selected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-[var(--foreground)]">
                          {option.label}
                        </span>
                        {option.description ? (
                          <span className="block truncate text-xs text-[var(--muted)]">
                            {option.description}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    ) : null;

  return (
    <div ref={rootRef} className={cn("relative", className)} id={id}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left text-sm transition-all duration-150",
          "border-[var(--border)] bg-[var(--card-elevated)] text-[var(--foreground)]",
          "hover:border-[var(--primary)]/40 hover:shadow-sm",
          "focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/15",
          "disabled:cursor-not-allowed disabled:opacity-50",
          open && "border-[var(--primary)] ring-2 ring-[var(--primary)]/15",
          values.length === 0 && "text-[var(--muted)]",
        )}
      >
        <span className="truncate font-medium">{summary}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-[var(--muted)] transition-transform duration-200",
            open && "rotate-180 text-[var(--primary)]",
          )}
        />
      </button>
      {typeof document !== "undefined" && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
