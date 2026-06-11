"use client";

import { fetchScreenshotAgentStatus } from "@/lib/api";
import { useCallback, useEffect, useState } from "react";

const POLL_INTERVAL_MS = 60_000;

export function useDesktopAgentStatus(enabled: boolean) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(enabled);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setConnected(null);
      setChecking(false);
      return;
    }

    setChecking(true);

    try {
      const status = await fetchScreenshotAgentStatus();
      setConnected(status.connected);
    } catch {
      setConnected(false);
    } finally {
      setChecking(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setConnected(null);
      setChecking(false);
      return;
    }

    void refresh();
    const interval = window.setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [enabled, refresh]);

  return {
    connected: connected === true,
    checking: enabled && checking,
    refresh,
  };
}
