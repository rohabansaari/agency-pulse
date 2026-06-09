"use client";



import { AppShell } from "@/components/dashboard/AppShell";

import { RoleDebugPanel } from "@/components/dashboard/RoleDebugPanel";

import { RoleDashboard } from "@/components/dashboard/RoleDashboard";

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

      <div className="space-y-6">
        {loading ? (

          <div className="grid gap-4 sm:grid-cols-3">

            {[1, 2, 3].map((i) => (

              <div

                key={i}

                className="h-28 animate-pulse rounded-xl bg-zinc-200/60 dark:bg-zinc-800/60"

              />

            ))}

          </div>

        ) : error ? (

          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>

        ) : data ? (

          <>

            <RoleDebugPanel />

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

          </>

        ) : null}

      </div>

    </AppShell>

  );

}

