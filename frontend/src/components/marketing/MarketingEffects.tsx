"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Motion for the marketing pages: scroll reveals, count-ups, screenshot tilt,
 * the hero light that follows the pointer and the hero screenshot that
 * flattens as you scroll. Re-runs on every page so new content is wired up.
 * Does nothing for people who ask for reduced motion.
 */
export function MarketingEffects({ rootId }: { rootId: string }) {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!("IntersectionObserver" in window)) return;

    root.classList.add("mk-anim");
    const cleanups: (() => void)[] = [];
    const on = (el: EventTarget, type: string, fn: (event: Event) => void, options?: AddEventListenerOptions) => {
      el.addEventListener(type, fn, options);
      cleanups.push(() => el.removeEventListener(type, fn, options));
    };

    const countUp = (el: HTMLElement) => {
      const to = Number(el.dataset.to);
      const decimals = Number(el.dataset.dec ?? 0);
      const prefix = el.dataset.pre ?? "";
      const suffix = el.dataset.suf ?? "";
      const start = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - start) / 1800);
        const eased = 1 - Math.pow(1 - p, 4);
        el.textContent =
          prefix +
          (to * eased).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) +
          suffix;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          el.classList.add("is-in");
          if (el.dataset.to) countUp(el);
          observer.unobserve(el);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    root.querySelectorAll<HTMLElement>(".mk-rv, [data-to], .mk-steps").forEach((el) => {
      if (!el.classList.contains("is-in")) observer.observe(el);
    });

    root.querySelectorAll<HTMLElement>(".mk-tilt").forEach((el) => {
      on(el, "pointermove", (event) => {
        const pointer = event as PointerEvent;
        const rect = el.getBoundingClientRect();
        const x = (pointer.clientX - rect.left) / rect.width;
        const y = (pointer.clientY - rect.top) / rect.height;
        el.style.setProperty("--ry", `${((x - 0.5) * 7).toFixed(2)}deg`);
        el.style.setProperty("--rx", `${((0.5 - y) * 5).toFixed(2)}deg`);
        el.style.setProperty("--gx", `${(x * 100).toFixed(1)}%`);
        el.style.setProperty("--gy", `${(y * 100).toFixed(1)}%`);
      });
      on(el, "pointerleave", () => {
        el.style.setProperty("--rx", "0deg");
        el.style.setProperty("--ry", "0deg");
      });
    });

    root.querySelectorAll<HTMLElement>(".mk-hero").forEach((hero) => {
      on(hero, "pointermove", (event) => {
        const pointer = event as PointerEvent;
        const rect = hero.getBoundingClientRect();
        hero.style.setProperty("--mx", `${pointer.clientX - rect.left}px`);
        hero.style.setProperty("--my", `${pointer.clientY - rect.top}px`);
      });
    });

    const heroShot = root.querySelector<HTMLElement>(".mk-hero-shot");
    if (heroShot) {
      const onScroll = () => {
        const rect = heroShot.getBoundingClientRect();
        const vh = window.innerHeight || 900;
        const progress = Math.max(0, Math.min(1, (vh - rect.top) / (vh * 0.75)));
        heroShot.style.setProperty("--tilt", ((1 - progress) * 22).toFixed(2));
      };
      onScroll();
      on(window, "scroll", onScroll, { passive: true });
    }

    return () => {
      observer.disconnect();
      cleanups.forEach((fn) => fn());
    };
  }, [rootId, pathname]);

  return null;
}
