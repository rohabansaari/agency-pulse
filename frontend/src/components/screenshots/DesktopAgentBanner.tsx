"use client";

import {
  AGENT_DOWNLOAD_FILENAME,
  getAgentDownloadUrl,
} from "@/lib/desktop-agent-config";
import { useDesktopAgentStatus } from "@/hooks/useDesktopAgentStatus";
import type { User } from "@/lib/types";

export function DesktopAgentBanner({ user }: { user: User }) {
  const requiresAgent = user.role === "employee" || user.role === "manager";
  const { connected, checking, refresh } = useDesktopAgentStatus(requiresAgent);
  const downloadUrl = getAgentDownloadUrl();

  if (!requiresAgent) {
    return null;
  }

  if (checking || connected) {
    return null;
  }

  return (
    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
      <p className="font-semibold">Install Desktop Agent to enable screenshots</p>
      <p className="mt-1 text-amber-900/90 dark:text-amber-200/90">
        Install the desktop agent on your Windows PC before you can start time tracking.
      </p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-amber-900/90 dark:text-amber-200/90">
        <li>
          Download{" "}
          <a
            href={downloadUrl}
            download={AGENT_DOWNLOAD_FILENAME}
            className="font-medium underline hover:no-underline"
          >
            {AGENT_DOWNLOAD_FILENAME}
          </a>
        </li>
        <li>
          Run once: <span className="font-mono text-xs">AgencyPulseAgent.exe --install</span>
        </li>
        <li>Sign in when prompted, then return here and click Check connection</li>
      </ol>
      <button
        type="button"
        onClick={() => {
          void refresh();
        }}
        className="mt-3 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100 dark:hover:bg-amber-900"
      >
        Check connection
      </button>
    </div>
  );
}
