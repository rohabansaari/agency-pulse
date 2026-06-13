"use client";

import { cn } from "@/lib/cn";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Search } from "lucide-react";
import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export type DropdownOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

type DropdownProps = {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  className?: string;
  id?: string;
  size?: "sm" | "md";
};

function useDropdownPosition(
  open: boolean,
  triggerRef: React.RefObject<HTMLButtonElement | null>,
) {
  const [style, setStyle] = useState<{ top: number; left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setStyle(null);
      return;
    }

    function update() {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setStyle({
        top: rect.bottom + window.scrollY + 6,
        left: rect.left + window.scrollX,
        width: rect.width,
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

export function Dropdown({
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled = false,
  searchable,
  searchPlaceholder = "Search…",
  className,
  id,
  size = "md",
}: DropdownProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const position = useDropdownPosition(open, triggerRef);

  const selected = options.find((o) => o.value === value);
  const showSearch = searchable ?? options.length > 5;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.description?.toLowerCase().includes(q),
    );
  }, [options, query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setHighlight(0);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      close();
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, close]);

  useEffect(() => {
    if (open && showSearch) {
      searchRef.current?.focus();
    }
  }, [open, showSearch]);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  function selectOption(option: DropdownOption) {
    if (option.disabled) return;
    onChange(option.value);
    close();
    triggerRef.current?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (!open) {
      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((i) => Math.min(i + 1, filtered.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((i) => Math.max(i - 1, 0));
      return;
    }

    if (event.key === "Enter" && filtered[highlight]) {
      event.preventDefault();
      selectOption(filtered[highlight]);
    }
  }

  const menu = open && position ? (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -6, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -6, scale: 0.97 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
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
          className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card-elevated)]"
          style={{ boxShadow: "var(--shadow-dropdown)" }}
        >
          {showSearch ? (
            <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-3 py-2.5">
              <Search className="h-4 w-4 shrink-0 text-[var(--muted)]" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={searchPlaceholder}
                className="w-full bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
              />
            </div>
          ) : null}
          <ul
            ref={menuRef}
            id={listId}
            role="listbox"
            className="max-h-64 overflow-y-auto py-1.5"
          >
            {filtered.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-[var(--muted)]">
                No matches found
              </li>
            ) : (
              filtered.map((option, index) => {
                const isSelected = option.value === value;
                const isHighlighted = index === highlight;
                return (
                  <li key={option.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      disabled={option.disabled}
                      onMouseEnter={() => setHighlight(index)}
                      onClick={() => selectOption(option)}
                      className={cn(
                        "flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors",
                        isHighlighted && "bg-[var(--primary-muted)]",
                        isSelected && "text-[var(--primary)]",
                        !isSelected && !isHighlighted && "text-[var(--foreground)]",
                        option.disabled && "cursor-not-allowed opacity-40",
                      )}
                    >
                      <span className="flex-1 min-w-0">
                        <span className="block truncate text-sm font-medium">{option.label}</span>
                        {option.description ? (
                          <span className="block truncate text-xs text-[var(--muted)]">
                            {option.description}
                          </span>
                        ) : null}
                      </span>
                      {isSelected ? (
                        <Check className="h-4 w-4 shrink-0 text-[var(--accent-emerald)]" strokeWidth={2.5} />
                      ) : (
                        <span className="h-4 w-4 shrink-0" />
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
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
        onKeyDown={onKeyDown}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-xl border text-left transition-all duration-150",
          "border-[var(--border)] bg-[var(--card-elevated)] text-[var(--foreground)]",
          "hover:border-[var(--primary)]/40 hover:shadow-sm",
          "focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/15",
          "disabled:cursor-not-allowed disabled:opacity-50",
          size === "sm" ? "px-3 py-2 text-sm" : "px-3.5 py-2.5 text-sm",
          open && "border-[var(--primary)] ring-2 ring-[var(--primary)]/15",
        )}
      >
        <span className={cn("truncate font-medium", !selected && "font-normal text-[var(--muted)]")}>
          {selected?.label ?? placeholder}
        </span>
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

/** Drop-in replacement for native <select> — auto-upgrades to premium Dropdown */
export function SelectFromChildren({
  value,
  onChange,
  children,
  className,
  disabled,
  id,
  searchable,
}: {
  value?: string | number;
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  id?: string;
  searchable?: boolean;
}) {
  const options = useMemo(() => {
    return Children.toArray(children)
      .filter((child): child is ReactElement<{ value: string; children: ReactNode; disabled?: boolean }> =>
        isValidElement(child) && child.type === "option",
      )
      .map((child) => ({
        value: String(child.props.value ?? ""),
        label: String(child.props.children ?? ""),
        disabled: child.props.disabled,
      }));
  }, [children]);

  return (
    <Dropdown
      id={id}
      value={String(value ?? "")}
      onChange={(v) => {
        const synthetic = {
          target: { value: v },
        } as ChangeEvent<HTMLSelectElement>;
        onChange?.(synthetic);
      }}
      options={options}
      disabled={disabled}
      className={className}
      searchable={searchable}
    />
  );
}
