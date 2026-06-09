"use client";

import { Modal } from "@/components/ui/Modal";

const SUPPORT_MAILTO =
  "mailto:?subject=AgencyPulse%20-%20Manual%20Time%20Entry%20Request&body=Please%20add%20a%20manual%20time%20entry%20for%20me.%0A%0ADate%3A%20%0ADuration%3A%20%0AProject%3A%20%0ADescription%3A%20";

export function ManualTimeDisabledModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Manual Time Entry Disabled" onClose={onClose}>
      <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        To add manual time entries, please contact your manager or HR/Admin for
        approval.
      </p>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Close
        </button>
        <a
          href={SUPPORT_MAILTO}
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Contact Admin
        </a>
      </div>
    </Modal>
  );
}

export function ContactAdminButton({
  label = "Contact HR/Admin",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <a
      href={SUPPORT_MAILTO}
      className={`inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${className}`}
    >
      {label}
    </a>
  );
}
