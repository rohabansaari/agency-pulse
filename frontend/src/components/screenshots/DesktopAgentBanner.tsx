"use client";

import {
  AGENT_DOWNLOAD_FILENAME,
  AGENT_SETUP_STEPS,
  getAgentDownloadUrl,
} from "@/lib/desktop-agent-config";
import { useDesktopAgentStatus } from "@/hooks/useDesktopAgentStatus";
import type { User } from "@/lib/types";
import { Monitor } from "lucide-react";
import { useState } from "react";

export function DesktopAgentBanner({ user }: { user: User }) {
  const requiresAgent = user.role === "employee" || user.role === "manager";
  const { connected, checking, refresh } = useDesktopAgentStatus(requiresAgent);
  const [rechecking, setRechecking] = useState(false);
  const downloadUrl = getAgentDownloadUrl();

  if (!requiresAgent) {
    return null;
  }

  if ((checking && !rechecking) || connected) {
    return null;
  }

  return (
    <section
      aria-labelledby="desktop-agent-setup-heading"
      className="mb-6 flex flex-wrap items-start gap-4 rounded-2xl border border-[var(--accent-copper)]/30 bg-[var(--accent-copper-soft)] px-5 py-4 text-sm text-[var(--foreground)]"
    >
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--card)] text-[var(--accent-copper)]"
      >
        <Monitor className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-[1_1_16.25rem]">
        <p className="flex flex-wrap items-center gap-2">
          <span id="desktop-agent-setup-heading" className="font-semibold">
            One-time setup: Desktop Agent
          </span>
          <span className="inline-flex rounded-full bg-[var(--card)] px-2.5 py-0.5 text-xs font-medium text-[var(--accent-copper)]">
            Not connected
          </span>
        </p>
        <p className="mt-1 text-[var(--muted)]">
          Do this once on your Windows PC. After that, just start your timer — screenshots run
          automatically.
        </p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-[var(--foreground)]">
          <li>
            <a
              href={downloadUrl}
              className="font-medium text-[var(--primary)] underline underline-offset-2 hover:text-[var(--primary-hover)] hover:no-underline"
            >
              Download {AGENT_DOWNLOAD_FILENAME}
            </a>
            , extract <span className="num text-xs">AgencyPulseAgent.exe</span>,
            then double-click it
          </li>
          <li>Sign in once when prompted — setup finishes automatically</li>
          <li>{AGENT_SETUP_STEPS[2]}</li>
        </ol>
        <button
          type="button"
          onClick={async () => {
            setRechecking(true);
            await refresh();
            setRechecking(false);
          }}
          disabled={rechecking}
          className="mt-3 inline-flex min-h-9 items-center rounded-xl border border-[var(--border)] bg-[var(--card-elevated)] px-3 text-[0.8125rem] font-medium text-[var(--foreground)] hover:bg-[var(--accent-sand)] disabled:opacity-60"
        >
          {rechecking ? "Checking…" : "I've installed it — check again"}
        </button>
        <p className="mt-3 text-xs text-[var(--muted)]">
          Windows may warn about an unknown publisher — this is expected for an unsigned
          internal app. Choose &quot;More info&quot; → &quot;Run anyway&quot; if prompted.
        </p>
      </div>
    </section>
  );
}
