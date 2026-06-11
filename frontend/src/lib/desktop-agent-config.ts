export function getAgentDownloadUrl(): string {
  const configured = process.env.NEXT_PUBLIC_AGENT_DOWNLOAD_URL?.trim();
  if (configured) {
    return configured;
  }

  return "/downloads/AgencyPulseAgent.exe";
}

export const AGENT_DOWNLOAD_FILENAME = "AgencyPulseAgent.exe";
