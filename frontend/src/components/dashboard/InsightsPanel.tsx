"use client";

import { Panel } from "@/components/ledger/Panel";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/EmptyState";
import { isoToLong } from "@/components/invoices/format";
import {
  ApiError,
  fetchInsights,
  formatApiErrors,
  generateInsightSummary,
  type InsightAlert,
  type InsightOverview,
} from "@/lib/api";
import { cn } from "@/lib/cn";
import { AlertTriangle, CircleAlert, Info, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const SEVERITY = {
  critical: { icon: CircleAlert, className: "text-[var(--danger)]" },
  warning: { icon: AlertTriangle, className: "text-[var(--accent-copper)]" },
  info: { icon: Info, className: "text-[var(--muted)]" },
} as const;

function alertHref(alert: InsightAlert, canOpenPeople: boolean): string | null {
  if (alert.project_id) return `/projects/${alert.project_id}`;
  if (alert.user_id && canOpenPeople) return `/employees/${alert.user_id}`;
  if (alert.type === "approvals") return canOpenPeople ? "/admin/leave" : "/leave/approvals";
  return null;
}

function Bullets({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.06em] text-[var(--muted)]">{title}</p>
      <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-[var(--foreground)]">
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

/** Dashboard insights: rule-based alerts plus the weekly AI briefing. */
export function InsightsPanel({ canOpenPeople }: { canOpenPeople: boolean }) {
  const [data, setData] = useState<InsightOverview | null>(null);
  const [error, setError] = useState("");
  const [writing, setWriting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchInsights()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? formatApiErrors(err.errors) || err.message : "Couldn't load insights.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleWrite() {
    setWriting(true);
    setError("");
    try {
      const summary = await generateInsightSummary();
      setData((current) => (current ? { ...current, summary } : current));
    } catch (err) {
      setError(err instanceof ApiError ? formatApiErrors(err.errors) || err.message : "Couldn't write the summary.");
    } finally {
      setWriting(false);
    }
  }

  if (!data) {
    return (
      <Panel title="Insights">
        {error ? <Alert variant="error">{error}</Alert> : <div className="h-24 animate-pulse rounded-xl bg-[var(--accent-sand)]" />}
      </Panel>
    );
  }

  const summary = data.summary;

  return (
    <Panel
      title="Insights"
      description="Alerts update live. The weekly summary is written by AI from hours, activity and these alerts."
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-label="AI summary" className="min-w-0 rounded-xl bg-[var(--accent-sand)]/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--foreground)]">
              <Sparkles className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
              Last week in brief
            </p>
            {data.ai_available ? (
              <Button size="sm" variant={summary ? "ghost" : "primary"} onClick={() => void handleWrite()} disabled={writing}>
                {writing ? "Writing…" : summary ? "Refresh" : "Write summary"}
              </Button>
            ) : null}
          </div>

          {error ? (
            <div className="mt-3">
              <Alert variant="error">{error}</Alert>
            </div>
          ) : null}

          {summary ? (
            <div className="mt-3 flex flex-col gap-3">
              <p className="text-[0.9375rem] font-medium leading-snug text-[var(--foreground)]">{summary.headline}</p>
              <Bullets title="Highlights" items={summary.highlights} />
              <Bullets title="Needs attention" items={summary.concerns} />
              <Bullets title="Suggested next steps" items={summary.suggestions} />
              <p className="text-xs text-[var(--muted)]">
                {isoToLong(summary.period_start)} – {isoToLong(summary.period_end)} · written{" "}
                {new Date(summary.generated_at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                . AI can be wrong, so check before acting.
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--muted)]">
              {data.ai_available
                ? "Get a one-minute briefing on last week: who worked what, what changed and what to look at."
                : "AI summaries aren't set up yet. Add a Gemini or Anthropic API key to the server settings to turn them on. Alerts work without it."}
            </p>
          )}
        </section>

        <section aria-label="Alerts" className="min-w-0">
          <p className="text-sm font-semibold text-[var(--foreground)]">
            Alerts{data.alerts.length ? <span className="font-normal text-[var(--muted)]"> · {data.alerts.length}</span> : null}
          </p>
          {data.alerts.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--muted)]">Nothing needs attention right now.</p>
          ) : (
            <ul className="mt-2 divide-y divide-[var(--border-subtle)]">
              {data.alerts.slice(0, 6).map((alert, index) => {
                const { icon: Icon, className } = SEVERITY[alert.severity] ?? SEVERITY.info;
                const href = alertHref(alert, canOpenPeople);
                const body = (
                  <>
                    <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", className)} aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-[var(--foreground)]">{alert.title}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-[var(--muted)]">{alert.detail}</span>
                    </span>
                  </>
                );
                return (
                  <li key={`${alert.type}-${index}`}>
                    {href ? (
                      <Link href={href} className="-mx-2 flex gap-2.5 rounded-lg px-2 py-2.5 hover:bg-[var(--accent-sand)]/60">
                        {body}
                      </Link>
                    ) : (
                      <div className="flex gap-2.5 py-2.5">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </Panel>
  );
}
