"use client";

import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { ROLE_LABELS } from "@/lib/navigation";
import type { MemberStatus, UserRole } from "@/lib/types";
import { MoreVertical } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export const MEMBER_STATUS_LABELS: Record<MemberStatus, string> = {
  active: "Active",
  invited: "Invited",
  suspended: "Deactivated",
};

const STATUS_VARIANT: Record<MemberStatus, "success" | "primary" | "default"> = {
  active: "success",
  invited: "primary",
  suspended: "default",
};

/** Ledger status pill (always carries a word, never colour alone). */
export function MemberStatusBadge({ status, className }: { status: MemberStatus; className?: string }) {
  return (
    <Badge variant={STATUS_VARIANT[status]} className={cn("whitespace-nowrap px-2.5 py-1", className)}>
      {MEMBER_STATUS_LABELS[status]}
    </Badge>
  );
}

const ROLE_VARIANT: Record<UserRole, "primary" | "outline" | "default"> = {
  super_admin: "primary",
  admin: "primary",
  sub_admin: "primary",
  manager: "outline",
  employee: "default",
};

/** Token-based role pill (the shared RoleBadge still uses raw palette colours). */
export function LedgerRoleBadge({ role, className }: { role: UserRole; className?: string }) {
  return (
    <Badge variant={ROLE_VARIANT[role]} className={cn("whitespace-nowrap px-2.5 py-1", className)}>
      {ROLE_LABELS[role]}
    </Badge>
  );
}

/** Live-timer pill. */
export function TimerBadge({ running }: { running: boolean }) {
  return running ? (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[var(--accent-emerald-soft)] px-2.5 py-1 text-xs font-medium text-[var(--accent-emerald)]">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent-emerald)]" aria-hidden="true" />
      Tracking
    </span>
  ) : (
    <span className="inline-flex whitespace-nowrap rounded-full bg-[var(--accent-sand)] px-2.5 py-1 text-xs font-medium text-[var(--muted)]">
      Not tracking
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Kebab row menu                                                       */
/* ------------------------------------------------------------------ */

const MENU_ESTIMATED_HEIGHT = 320;

function useMenuPosition(open: boolean, triggerRef: React.RefObject<HTMLButtonElement | null>) {
  const [style, setStyle] = useState<{ top: number; left: number; transform: string } | null>(null);

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
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < MENU_ESTIMATED_HEIGHT && rect.top > spaceBelow;
      setStyle({
        top: (openUp ? rect.top - gap : rect.bottom + gap) + window.scrollY,
        left: rect.right + window.scrollX,
        transform: openUp ? "translate(-100%, -100%)" : "translateX(-100%)",
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

/** Icon-only "more" button that opens a Ledger menu in a portal. */
export function RowMenu({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const position = useMenuPosition(open, triggerRef);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      close();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  useEffect(() => {
    if (open && position) {
      menuRef.current?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus();
    }
  }, [open, position]);

  function onMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? []);
    if (items.length === 0) return;
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "ArrowDown" ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
    items[next]?.focus();
  }

  const menu =
    open && position ? (
      <div
        ref={menuRef}
        role="menu"
        aria-label={label}
        onKeyDown={onMenuKeyDown}
        onClick={close}
        style={{
          position: "absolute",
          top: position.top,
          left: position.left,
          transform: position.transform,
          zIndex: 9999,
          boxShadow: "var(--shadow-dropdown)",
        }}
        className="w-60 rounded-xl border border-[var(--border)] bg-[var(--card-elevated)] p-1.5 text-[var(--foreground)]"
      >
        {children}
      </div>
    ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-10 w-10 items-center justify-center rounded-[0.625rem] border text-[var(--muted)] transition hover:bg-[var(--accent-sand)] hover:text-[var(--foreground)]",
          open
            ? "border-[var(--primary)] bg-[var(--primary-muted)] text-[var(--primary)]"
            : "border-transparent",
        )}
      >
        <MoreVertical className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
      </button>
      {typeof document !== "undefined" && menu ? createPortal(menu, document.body) : null}
    </>
  );
}

export function RowMenuItem({
  children,
  onClick,
  icon,
  tone = "default",
}: {
  children: ReactNode;
  onClick?: () => void;
  icon?: ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3.5 text-left text-sm outline-none transition hover:bg-[var(--accent-sand)] focus-visible:bg-[var(--accent-sand)]",
        tone === "danger" ? "text-[var(--danger)] hover:bg-[var(--accent-coral-soft)]" : "text-[var(--foreground)]",
      )}
    >
      {icon ? <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">{icon}</span> : null}
      {children}
    </button>
  );
}

export function RowMenuDivider() {
  return <div role="separator" className="my-1 h-px bg-[var(--border-subtle)]" />;
}
