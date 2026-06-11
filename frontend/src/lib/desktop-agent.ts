const AGENT_WAKE_URL = "agencypulse://wake";

/**
 * Ask the installed desktop agent to wake and begin screenshot capture.
 * Requires a one-time setup: double-click AgencyPulseAgent.exe and sign in.
 */
export function wakeDesktopAgent(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const link = document.createElement("a");
    link.href = AGENT_WAKE_URL;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch {
    // Browser blocked custom protocol — agent may still be running from Startup.
  }
}
