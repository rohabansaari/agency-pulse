"use client";

import { cn } from "@/lib/cn";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type ActionMenuProps = {
  label?: string;
  children: ReactNode;
  className?: string;
  align?: "left" | "right";
};

function useMenuPosition(
  open: boolean,
  triggerRef: React.RefObject<HTMLButtonElement | null>,
  align: "left" | "right",
) {
  const [style, setStyle] = useState<{
    top: number;
    left: number;
    minWidth: number;
    transform?: string;
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
      const gap = 4;
      const menuHeight = 180;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < menuHeight && rect.top > spaceBelow;
      const minWidth = Math.max(rect.width, 168);

      if (openUp) {
        setStyle({
          top: rect.top + window.scrollY - gap,
          left: align === "right" ? rect.right + window.scrollX : rect.left + window.scrollX,
          minWidth,
          transform: align === "right" ? "translate(-100%, -100%)" : "translateY(-100%)",
        });
        return;
      }

      setStyle({
        top: rect.bottom + window.scrollY + gap,
        left: align === "right" ? rect.right + window.scrollX : rect.left + window.scrollX,
        minWidth,
        transform: align === "right" ? "translateX(-100%)" : undefined,
      });
    }

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, triggerRef, align]);

  return style;
}

export function ActionMenu({
  label = "Actions",
  children,
  className,
  align = "right",
}: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const position = useMenuPosition(open, triggerRef, align);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      close();
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, close]);

  const menu =
    open && position ? (
      <AnimatePresence>
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, y: -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }}
          transition={{ duration: 0.15 }}
          style={{
            position: "absolute",
            top: position.top,
            left: position.left,
            minWidth: position.minWidth,
            transform: position.transform,
            zIndex: 9999,
            boxShadow: "var(--shadow-dropdown)",
          }}
          className="origin-top overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card-elevated)] py-1"
          onClick={close}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    ) : null;

  return (
    <div className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)] transition hover:border-[var(--primary)]/30 hover:bg-[var(--sidebar-hover)]"
      >
        {label}
        <ChevronDown className={cn("h-3 w-3 text-[var(--muted)] transition", open && "rotate-180")} />
      </button>
      {typeof document !== "undefined" && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}

export function ActionMenuItem({
  children,
  onClick,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "block w-full px-3 py-2 text-left text-xs font-medium text-[var(--foreground)] transition hover:bg-[var(--sidebar-hover)]",
        className,
      )}
    >
      {children}
    </button>
  );
}
