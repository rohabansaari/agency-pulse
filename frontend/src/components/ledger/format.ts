/** "112h 40m" — readable totals for summaries (live clocks keep HH:MM:SS). */
export function hoursLabel(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

export function percentLabel(value: number): string {
  return `${Math.round(value)}%`;
}

export function greeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
