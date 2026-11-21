"use client";

import { Alert } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import {
  ApiError,
  fetchTimeTrackingSettings,
  formatApiErrors,
  updateTimeTrackingSettings,
} from "@/lib/api";
import { useEffect, useState } from "react";

const IDLE_OPTIONS = [
  { value: 0, label: "Off" },
  { value: 5, label: "5 minutes" },
  { value: 10, label: "10 minutes" },
  { value: 15, label: "15 minutes" },
  { value: 20, label: "20 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 45, label: "45 minutes" },
  { value: 60, label: "1 hour" },
];

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError ? formatApiErrors(err.errors) || err.message : fallback;
}

export function TimeTrackingSettingsPanel() {
  const [saved, setSaved] = useState<number | null>(null);
  const [value, setValue] = useState<number>(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchTimeTrackingSettings()
      .then((settings) => {
        if (cancelled) return;
        setSaved(settings.idle_timeout_minutes);
        setValue(settings.idle_timeout_minutes);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorText(err, "Couldn't load time tracking settings."));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave() {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const settings = await updateTimeTrackingSettings({ idle_timeout_minutes: value });
      setSaved(settings.idle_timeout_minutes);
      setSuccess(
        settings.idle_timeout_minutes === 0
          ? "Idle detection is off."
          : `Timers now pause after ${settings.idle_timeout_minutes} minutes without activity.`,
      );
    } catch (err) {
      setError(errorText(err, "Saving failed."));
    } finally {
      setBusy(false);
    }
  }

  if (saved === null) {
    return error ? <Alert variant="error">{error}</Alert> : <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  // Keep a custom value set via the API selectable.
  const options = IDLE_OPTIONS.some((option) => option.value === saved)
    ? IDLE_OPTIONS
    : [...IDLE_OPTIONS, { value: saved, label: `${saved} minutes` }].sort((a, b) => a.value - b.value);

  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert variant="error">{error}</Alert> : null}
      {success ? <Alert variant="success">{success}</Alert> : null}

      <div className="max-w-xs">
        <label htmlFor="idle-timeout" className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
          Pause the timer after no activity for
        </label>
        <Select id="idle-timeout" value={value} onChange={(event) => setValue(Number(event.target.value))}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
        <li>
          When nobody uses the keyboard or mouse for this long, the desktop agent pauses the timer back at the last
          activity, so idle time isn&apos;t counted.
        </li>
        <li>
          When the employee returns, they choose to keep the time (for example a call or a meeting) or discard it. Kept
          time is marked &quot;Idle time kept&quot; in their sessions.
        </li>
        <li>Needs desktop agent 1.4.0 or later. Older agents keep tracking as before.</li>
      </ul>

      <div>
        <Button onClick={() => void handleSave()} disabled={busy || value === saved}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
