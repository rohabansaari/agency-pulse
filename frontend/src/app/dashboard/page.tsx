"use client";

import { AppShell } from "@/components/dashboard/AppShell";
import { OnboardingCompletionPanel } from "@/components/onboarding/OnboardingCompletionPanel";
import { OnboardingFollowUpBanner } from "@/components/onboarding/OnboardingFollowUpBanner";
import { RoleDashboard } from "@/components/dashboard/RoleDashboard";
import { PageTransition } from "@/components/motion/PageTransition";
import { Alert, Spinner } from "@/components/ui/EmptyState";
import {
  defaultReportDateRange,
  ReportDateRangeFilter,
  type ReportDateRange,
} from "@/components/reports/ReportDateRangeFilter";
import { ApiError, fetchDashboard } from "@/lib/api";
import type { DashboardData } from "@/lib/types";
import { useCallback, useEffect, useState } from "react";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dateRange, setDateRange] = useState<ReportDateRange>(defaultReportDateRange);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchDashboard(dateRange));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AppShell>
      <PageTransition>
        <div className="space-y-6">
          <OnboardingFollowUpBanner />
          <OnboardingCompletionPanel />
          {loading ? (
            <Spinner label="Loading dashboard…" />
          ) : error ? (
            <Alert variant="error">{error}</Alert>
          ) : data ? (
            <RoleDashboard
              data={data}
              dateRangeFilter={
                <ReportDateRangeFilter
                  value={dateRange}
                  onChange={setDateRange}
                  disabled={loading}
                />
              }
            />
          ) : null}
        </div>
      </PageTransition>
    </AppShell>
  );
}
