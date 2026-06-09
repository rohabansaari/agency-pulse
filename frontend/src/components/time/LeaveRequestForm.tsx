"use client";

import { LeaveDateInput } from "@/components/leave/LeaveDateInput";
import {
  ApiError,
  fetchLeaveContext,
  formatApiErrors,
  requestLeave,
} from "@/lib/api";
import {
  compareDdMmYyyy,
  isBeforeDdMmYyyy,
  isValidDdMmYyyy,
  todayDdMmYyyy,
} from "@/lib/dates";
import type { LeaveContext, UserRole } from "@/lib/types";
import { useCallback, useEffect, useState } from "react";

const PAST_DATE_ERROR = "Past dates are not allowed for leave requests";
const PAST_DATE_HINT = "Past date leave requests are not allowed";

export function LeaveRequestForm({
  role,
  onSubmitted,
  compact = false,
}: {
  role: UserRole;
  onSubmitted?: () => void;
  compact?: boolean;
}) {
  const [context, setContext] = useState<LeaveContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [userId, setUserId] = useState("");
  const [useRange, setUseRange] = useState(false);
  const [startDate, setStartDate] = useState(todayDdMmYyyy());
  const [endDate, setEndDate] = useState(todayDdMmYyyy());
  const [reason, setReason] = useState("");

  const loadContext = useCallback(async () => {
    setError("");
    try {
      const data = await fetchLeaveContext();
      setContext(data);
      if (data.team_members?.length) {
        setUserId(String(data.team_members[0].id));
      } else if (data.employees?.length) {
        setUserId(String(data.employees[0].id));
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Failed to load leave options.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  function validateDates(): string | null {
    if (!isValidDdMmYyyy(startDate)) {
      return "Enter a valid start date as dd/mm/yyyy.";
    }

    if (useRange) {
      if (!isValidDdMmYyyy(endDate)) {
        return "Enter a valid end date as dd/mm/yyyy.";
      }

      if (compareDdMmYyyy(endDate, startDate) < 0) {
        return "End date must be on or after start date.";
      }
    }

    const minDate = role === "employee" ? todayDdMmYyyy() : null;
    if (minDate) {
      if (isBeforeDdMmYyyy(startDate, minDate)) {
        return PAST_DATE_ERROR;
      }

      if (useRange && isBeforeDdMmYyyy(endDate, minDate)) {
        return PAST_DATE_ERROR;
      }
    }

    return null;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!reason.trim()) {
      setError("Reason is required.");
      return;
    }

    if ((role === "manager" || role === "admin") && !userId) {
      setError("Select an employee.");
      return;
    }

    const dateError = validateDates();
    if (dateError) {
      setError(dateError);
      return;
    }

    setSubmitting(true);
    try {
      const payload =
        role === "employee"
          ? useRange
            ? { start_date: startDate, end_date: endDate, reason: reason.trim() }
            : { date: startDate, reason: reason.trim() }
          : useRange
            ? {
                user_id: Number(userId),
                start_date: startDate,
                end_date: endDate,
                reason: reason.trim(),
              }
            : {
                user_id: Number(userId),
                date: startDate,
                reason: reason.trim(),
              };

      const result = await requestLeave(payload);
      setSuccess(result.message);
      setReason("");
      setUseRange(false);
      setStartDate(todayDdMmYyyy());
      setEndDate(todayDdMmYyyy());
      onSubmitted?.();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? formatApiErrors(err.errors) || err.message
          : "Failed to submit leave request.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div
        className={`animate-pulse rounded-lg bg-zinc-200/60 dark:bg-zinc-800/60 ${
          compact ? "h-32" : "h-48"
        }`}
      />
    );
  }

  if (role === "employee" && !context?.can_request) {
    return (
      <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50/80 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/20">
        <p className="text-sm text-amber-800 dark:text-amber-200">
          {context?.reason ?? "Leave requests are not available for your account yet."}
        </p>
      </div>
    );
  }

  const showEmployeePicker = role === "manager" || role === "admin";
  const minLeaveDate = role === "employee" ? todayDdMmYyyy() : undefined;

  function handleStartDateChange(value: string) {
    setStartDate(value);
    if (useRange && isValidDdMmYyyy(value) && isValidDdMmYyyy(endDate) && compareDdMmYyyy(endDate, value) < 0) {
      setEndDate(value);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}
      {success ? (
        <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
      ) : null}

      {showEmployeePicker ? (
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-zinc-700 dark:text-zinc-300">
            Employee *
          </span>
          <select
            required
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {role === "admin"
              ? (context?.employees ?? []).map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))
              : (context?.team_members ?? []).map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} ({member.team_name})
                  </option>
                ))}
          </select>
        </label>
      ) : null}

      <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        <input
          type="checkbox"
          checked={useRange}
          onChange={(event) => setUseRange(event.target.checked)}
        />
        Date range (multiple days)
      </label>

      <div className={`grid gap-4 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2"}`}>
        <LeaveDateInput
          id="leave-start-date"
          label={useRange ? "Start date *" : "Date *"}
          value={startDate}
          onChange={handleStartDateChange}
          minDate={minLeaveDate}
          hint={minLeaveDate ? PAST_DATE_HINT : undefined}
        />

        {useRange ? (
          <LeaveDateInput
            id="leave-end-date"
            label="End date *"
            value={endDate}
            onChange={setEndDate}
            minDate={
              minLeaveDate && isValidDdMmYyyy(startDate) && compareDdMmYyyy(startDate, minLeaveDate) > 0
                ? startDate
                : minLeaveDate
            }
            hint={minLeaveDate ? PAST_DATE_HINT : undefined}
          />
        ) : null}
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-zinc-700 dark:text-zinc-300">
          Reason *
        </span>
        <textarea
          required
          rows={compact ? 2 : 3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Why are you requesting leave?"
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {submitting
          ? "Submitting…"
          : role === "employee"
            ? "Submit leave request"
            : role === "admin"
              ? "Assign paid leave"
              : "Record team leave"}
      </button>
    </form>
  );
}
