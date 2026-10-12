"use client";

import { cn } from "@/lib/cn";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/payroll", label: "Payroll Runs", exact: true },
  { href: "/admin/payroll/salary", label: "Salary Management", exact: false },
];

export function PayrollNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Payroll sections">
      <ul className="inline-flex flex-wrap gap-1 rounded-xl bg-[var(--accent-sand)] p-1">
        {TABS.map((tab) => {
          const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-lg px-4 text-sm transition",
                  active
                    ? "bg-[var(--card-elevated)] font-medium text-[var(--foreground)] shadow-[var(--shadow-sm)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
