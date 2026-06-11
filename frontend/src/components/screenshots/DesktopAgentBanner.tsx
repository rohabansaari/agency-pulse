"use client";

import { fetchScreenshotAgentStatus } from "@/lib/api";
import type { User } from "@/lib/types";
import { useCallback, useEffect, useState } from "react";

const POLL_INTERVAL_MS = 60_000;

export function DesktopAgentBanner({ user }: { user: User }) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  const downloadUrl = process.env.NEXT_PUBLIC_AGENT_DOWNLOAD_URL?.trim() || "";

  const checkStatus = useCallback(async () => {
    try {
      const status = await fetchScreenshotAgentStatus();
      setConnected(status.connected);
    } catch {
      setConnected(false);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void checkStatus();
    const interval = window.setInterval(() => {
      void checkStatus();
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [checkStatus]);

  if (user.role !== "employee" && user.role !== "manager") {
    return null;
  }

  if (checking || connected) {
    return null;
  }

  return (
    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
      <p className="font-semibold">Install Desktop Agent to enable screenshots</p>
      <p className="mt-1 text-amber-900/90 dark:text-amber-200/90">
        Screenshots require the AgencyPulse Desktop Agent on your Windows PC.
      </p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-amber-900/90 dark:text-amber-200/90">
        <li>
          {downloadUrl ? (
            <>
              Download{" "}
              <a
                href={downloadUrl}
                className="font-medium underline hover:no-underline"
                target="_blank"
                rel="noreferrer"
              >
                AgencyPulseAgent.exe
              </a>
            </>
          ) : (
            <>Get <span className="font-mono text-xs">AgencyPulseAgent.exe</span> from your administrator</>
          )}
        </li>
        <li>
          Run once: <span className="font-mono text-xs">AgencyPulseAgent.exe --install</span>
        </li>
        <li>Sign in when prompted, then start your timer on Time Tracking</li>
      </ol>
      <button
        type="button"
        onClick={() => {
          setChecking(true);
          void checkStatus();
        }}
        className="mt-3 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100 dark:hover:bg-amber-900"
      >
        Check connection
      </button>
    </div>
  );
}
