export function getAgentDownloadUrl(): string {
  const configured = process.env.NEXT_PUBLIC_AGENT_DOWNLOAD_URL?.trim();
  if (configured) {
    return configured;
  }

  return "/downloads/AgencyPulseAgent.zip";
}

export const AGENT_DOWNLOAD_FILENAME = "AgencyPulseAgent.zip";

export const AGENT_SETUP_STEPS = [
  "Download AgencyPulseAgent.zip and extract the AgencyPulseAgent folder",
  "Open the folder and double-click AgencyPulseAgent.exe once to sign in",
  "Start your timer on Time Tracking — screenshots begin automatically",
] as const;
