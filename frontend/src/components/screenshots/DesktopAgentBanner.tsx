"use client";

import {
  AGENT_DOWNLOAD_FILENAME,
  AGENT_SETUP_STEPS,
  getAgentDownloadUrl,
} from "@/lib/desktop-agent-config";
import { useDesktopAgentStatus } from "@/hooks/useDesktopAgentStatus";
import type { User } from "@/lib/types";

export function DesktopAgentBanner({ user }: { user: User }) {
  const requiresAgent = user.role === "employee" || user.role === "manager";
  const { connected, checking } = useDesktopAgentStatus(requiresAgent);
  const downloadUrl = getAgentDownloadUrl();

  if (!requiresAgent) {
    return null;
  }

  if (checking || connected) {
    return null;
  }

  return (
    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
      <p className="font-semibold">One-time setup: Desktop Agent</p>
      <p className="mt-1 text-amber-900/90 dark:text-amber-200/90">
        Do this once on your Windows PC. After that, just start your timer — screenshots run
        automatically.
      </p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-amber-900/90 dark:text-amber-200/90">
        <li>
          <a
            href={downloadUrl}
            className="font-medium underline hover:no-underline"
          >
            Download {AGENT_DOWNLOAD_FILENAME}
          </a>
          , extract the file, then run <span className="font-mono text-xs">AgencyPulseAgent.exe</span>
        </li>
        <li>Sign in once when prompted — setup finishes automatically</li>
        <li>{AGENT_SETUP_STEPS[2]}</li>
      </ol>
    </div>
  );
}
