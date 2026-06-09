import { ROLE_BADGE_STYLES, ROLE_LABELS } from "@/lib/navigation";
import type { UserRole } from "@/lib/types";

export function RoleBadge({ role, className = "" }: { role: UserRole; className?: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${ROLE_BADGE_STYLES[role]} ${className}`}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}
