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
import type { LeaveCategory, LeaveContext, UserRole } from "@/lib/types";
import { Dropdown } from "@/components/ui/Dropdown";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/EmptyState";
import { FormField, Select } from "@/components/ui/Input";
import { useCallback, useEffect, useId, useState } from "react";

const PAST_DATE_ERROR = "Past dates are not allowed for leave requests";
const PAST_DATE_HINT = "Past date leave requests are not allowed";

const LEAVE_TYPE_OPTIONS = [
  { value: "medical", label: "Medical Leave" },
  { value: "casual", label: "Casual Leave" },
  { value: "annual", label: "Annual Leave" },
];

export function LeaveRequestForm({
  role,
  forSelf = false,
  onSubmitted,
  compact = false,
}: {
  role: UserRole;
  forSelf?: boolean;
  onSubmitted?: () => void;
  compact?: boolean;
}) {
  const fieldId = useId();
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
  const [leaveCategory, setLeaveCategory] = useState<LeaveCategory>("annual");

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

    const minDate = role === "employee" || (role === "manager" && forSelf) ? todayDdMmYyyy() : null;
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

    if ((role === "manager" || role === "admin" || role === "sub_admin") && !forSelf && !userId) {
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
        role === "employee" || (role === "manager" && forSelf)
          ? useRange
            ? { start_date: startDate, end_date: endDate, reason: reason.trim(), leave_category: leaveCategory, ...(forSelf ? { for_self: true } : {}) }
            : { date: startDate, reason: reason.trim(), leave_category: leaveCategory, ...(forSelf ? { for_self: true } : {}) }
          : useRange
            ? {
                user_id: Number(userId),
                start_date: startDate,
                end_date: endDate,
                reason: reason.trim(),
                leave_category: leaveCategory,
              }
            : {
                user_id: Number(userId),
                date: startDate,
                reason: reason.trim(),
                leave_category: leaveCategory,
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
        role="status"
        aria-label="Loading leave form"
        className={`animate-pulse rounded-xl bg-[var(--accent-sand)] ${compact ? "h-32" : "h-48"}`}
      />
    );
  }

  if (role === "employee" && !context?.can_request) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--accent-copper)]/40 bg-[var(--accent-copper-soft)] px-4 py-3">
        <p className="text-sm text-[var(--accent-copper)]">
          {context?.reason ?? "Leave requests are not available for your account yet."}
        </p>
      </div>
    );
  }

  const showEmployeePicker = !forSelf && (role === "manager" || role === "admin" || role === "sub_admin");
  const minLeaveDate = role === "employee" || (role === "manager" && forSelf) ? todayDdMmYyyy() : undefined;

  function handleStartDateChange(value: string) {
    setStartDate(value);
    if (useRange && isValidDdMmYyyy(value) && isValidDdMmYyyy(endDate) && compareDdMmYyyy(endDate, value) < 0) {
      setEndDate(value);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? <Alert variant="error">{error}</Alert> : null}
      {success ? <Alert variant="success">{success}</Alert> : null}

      <FormField label="Leave type" htmlFor={`${fieldId}-type`} required>
        <Dropdown
          id={`${fieldId}-type`}
          value={leaveCategory}
          onChange={(v) => setLeaveCategory(v as LeaveCategory)}
          options={LEAVE_TYPE_OPTIONS}
        />
      </FormField>

      {showEmployeePicker ? (
        <FormField label="Employee" htmlFor={`${fieldId}-employee`} required>
          <Select
            id={`${fieldId}-employee`}
            required
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            className="w-full"
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
          </Select>
        </FormField>
      ) : null}

      <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-[var(--foreground)]">
        <input
          className="h-4 w-4 rounded accent-[var(--primary)]"
          type="checkbox"
          checked={useRange}
          onChange={(event) => setUseRange(event.target.checked)}
        />
        Date range (multiple days)
      </label>

      <div className={`grid gap-4 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2"}`}>
        <LeaveDateInput
          id={`${fieldId}-start-date`}
          label={useRange ? "Start date *" : "Date *"}
          value={startDate}
          onChange={handleStartDateChange}
          minDate={minLeaveDate}
          hint={minLeaveDate ? PAST_DATE_HINT : undefined}
        />

        {useRange ? (
          <LeaveDateInput
            id={`${fieldId}-end-date`}
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

      <FormField label="Reason" htmlFor={`${fieldId}-reason`} required>
        <textarea
          id={`${fieldId}-reason`}
          required
          rows={compact ? 2 : 3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Why are you requesting leave?"
          className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--card-elevated)] px-3.5 py-2.5 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15"
        />
      </FormField>

      <Button type="submit" size="lg" disabled={submitting} className="min-h-12 w-full">
        {submitting
          ? "Submitting…"
          : forSelf
            ? "Submit leave request"
          : role === "employee"
            ? "Submit leave request"
            : role === "admin"
              ? "Assign paid leave"
              : "Record team leave"}
      </Button>
    </form>
  );
}
