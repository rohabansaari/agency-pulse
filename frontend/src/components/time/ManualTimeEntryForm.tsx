"use client";



import {

  ApiError,

  createManualTimeEntry,

  fetchManualTimeContext,

  formatApiErrors,

} from "@/lib/api";

import type { ManualTimeContext, ManualTimeProjectOption, UserRole } from "@/lib/types";
import { DatePicker } from "@/components/ui/DatePicker";
import { Select } from "@/components/ui/Input";
import { ddMmYyyyToIso, todayDdMmYyyy } from "@/lib/dates";
import { useCallback, useEffect, useMemo, useState } from "react";



function todayDisplayDate(): string {
  return todayDdMmYyyy();
}



export function ManualTimeEntryForm({

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

  const [context, setContext] = useState<ManualTimeContext | null>(null);

  const [loading, setLoading] = useState(true);

  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");



  const [userId, setUserId] = useState("");

  const [projectId, setProjectId] = useState("");

  const [managerId, setManagerId] = useState("");

  const [date, setDate] = useState(todayDisplayDate());

  const [hours, setHours] = useState("1");

  const [description, setDescription] = useState("");



  const loadContext = useCallback(async () => {

    setError("");

    try {

      const data = await fetchManualTimeContext();

      setContext(data);



      if (role === "employee") {

        if (data.projects?.length) {

          setProjectId(String(data.projects[0].id));

        }



        if (data.managers?.length) {

          setManagerId(String(data.managers[0].id));

        }

      }



      if (role === "manager" && forSelf && data.self_projects?.length) {

        setProjectId(String(data.self_projects[0].id));

      }



      if (role === "manager" && !forSelf && data.team_members?.length) {

        setUserId(String(data.team_members[0].id));

        if (data.team_members[0].projects.length > 0) {

          setProjectId(String(data.team_members[0].projects[0].id));

        }

      }

    } catch (err) {

      setError(

        err instanceof ApiError

          ? formatApiErrors(err.errors) || err.message

          : "Failed to load manual entry options.",

      );

    } finally {

      setLoading(false);

    }

  }, [role, forSelf]);



  useEffect(() => {

    void loadContext();

  }, [loadContext]);



  const projectOptions = useMemo((): ManualTimeProjectOption[] => {

    if (role === "employee") {

      return context?.projects ?? [];

    }



    if (role === "manager" && forSelf) {

      return context?.self_projects ?? [];

    }



    if (role === "manager") {

      const member = context?.team_members?.find((entry) => String(entry.id) === userId);

      return member?.projects ?? [];

    }



    return context?.projects ?? [];

  }, [context, role, userId, forSelf]);



  useEffect(() => {

    if (projectOptions.length === 0) {

      setProjectId("");

      return;

    }



    if (!projectOptions.some((project) => String(project.id) === projectId)) {

      setProjectId(String(projectOptions[0].id));

    }

  }, [projectOptions, projectId]);



  function handleUserChange(nextUserId: string) {

    setUserId(nextUserId);



    if (role !== "manager" || forSelf) {

      return;

    }



    const member = context?.team_members?.find((entry) => String(entry.id) === nextUserId);

    if (member?.projects.length) {

      setProjectId(String(member.projects[0].id));

    } else {

      setProjectId("");

    }

  }



  async function handleSubmit(event: React.FormEvent) {

    event.preventDefault();

    setError("");

    setSuccess("");



    if (role === "manager" && !forSelf && !userId) {

      setError("Select an employee.");

      return;

    }



    if (!projectId) {

      setError("Project is required.");

      return;

    }



    if (role === "employee" && !managerId) {

      setError("Manager is required.");

      return;

    }



    const parsedHours = Number(hours);

    if (!Number.isFinite(parsedHours) || parsedHours <= 0 || parsedHours > 24) {

      setError("Enter a valid number of hours between 0 and 24.");

      return;

    }



    const durationSeconds = Math.round(parsedHours * 3600);

    if (durationSeconds < 60) {

      setError("Minimum entry is 1 minute.");

      return;

    }



    if (!description.trim()) {

      setError("Description is required.");

      return;

    }



    setSubmitting(true);

    try {
      const apiDate = ddMmYyyyToIso(date);

      const payload =

        role === "employee"

          ? {

              date: apiDate,

              duration: durationSeconds,

              description: description.trim(),

              project_id: Number(projectId),

              manager_id: Number(managerId),

            }

          : forSelf

            ? {

                date: apiDate,

                duration: durationSeconds,

                description: description.trim(),

                project_id: Number(projectId),

                for_self: true,

              }

            : {

                user_id: Number(userId),

                date: apiDate,

                duration: durationSeconds,

                description: description.trim(),

                project_id: Number(projectId),

              };



      const result = await createManualTimeEntry(payload);

      setSuccess(result.message);

      setDescription("");

      setHours("1");

      setDate(todayDisplayDate());

      onSubmitted?.();

    } catch (err) {

      setError(

        err instanceof ApiError

          ? formatApiErrors(err.errors) || err.message

          : "Failed to submit manual time entry.",

      );

    } finally {

      setSubmitting(false);

    }

  }



  if (loading) {

    return (

      <div

        className={`animate-pulse rounded-xl bg-[var(--accent-sand)] ${

          compact ? "h-32" : "h-48"

        }`}

      />

    );

  }



  if (role === "employee" && !context?.can_create) {

    return (

      <div className="rounded-lg border border-dashed border-[var(--accent-copper)]/30 bg-[var(--accent-copper-soft)] px-4 py-3">

        <p className="text-sm text-[var(--accent-copper)]">

          {context?.reason ??

            "Manual time entry is not available for your account yet."}

        </p>

      </div>

    );

  }



  if (role === "manager" && forSelf && !context?.can_create_self) {

    return (

      <div className="rounded-lg border border-dashed border-[var(--accent-copper)]/30 bg-[var(--accent-copper-soft)] px-4 py-3">

        <p className="text-sm text-[var(--accent-copper)]">

          {context?.reason_self ??

            "Manual time entry is not available for your account yet."}

        </p>

      </div>

    );

  }



  if (role === "manager" && !forSelf && !context?.can_create) {

    return (

      <div className="rounded-lg border border-dashed border-[var(--accent-copper)]/30 bg-[var(--accent-copper-soft)] px-4 py-3">

        <p className="text-sm text-[var(--accent-copper)]">

          {context?.reason ??

            "Manual time entry is not available for your managed teams yet."}

        </p>

      </div>

    );

  }



  const showEmployeePicker = role === "manager" && !forSelf;



  return (

    <form onSubmit={handleSubmit} className="space-y-4">

      {error ? (

        <p className="text-sm text-[var(--danger)]">{error}</p>

      ) : null}

      {success ? (

        <p className="text-sm text-[var(--accent-emerald)]">{success}</p>

      ) : null}



      {showEmployeePicker ? (

        <label className="block text-sm">

          <span className="mb-1.5 block font-medium text-[var(--foreground)]">

            Employee *

          </span>

          <Select

            required

            value={userId}

            onChange={(event) => handleUserChange(event.target.value)}


          >

            {(context?.team_members ?? []).map((member) => (

              <option key={member.id} value={member.id}>

                {member.name} ({member.team_name})

              </option>

            ))}

          </Select>

        </label>

      ) : null}



      <div className={`grid gap-4 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"}`}>

        <label className="block text-sm">

          <span className="mb-1.5 block font-medium text-[var(--foreground)]">

            Project *

          </span>

          <Select

            required

            value={projectId}

            onChange={(event) => setProjectId(event.target.value)}

            disabled={projectOptions.length === 0}

            className="disabled:opacity-60 min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--card-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-muted)]"

          >

            {projectOptions.map((project) => (

              <option key={project.id} value={project.id}>

                {project.name}

              </option>

            ))}

          </Select>

        </label>



        {role === "employee" ? (

          <label className="block text-sm">

            <span className="mb-1.5 block font-medium text-[var(--foreground)]">

              Manager *

            </span>

            <Select

              required

              value={managerId}

              onChange={(event) => setManagerId(event.target.value)}


            >

              {(context?.managers ?? []).map((manager) => (

                <option key={manager.id} value={manager.id}>

                  {manager.name}

                </option>

              ))}

            </Select>

          </label>

        ) : null}



        <DatePicker
          id="manual-entry-date"
          label="Date *"
          value={date}
          onChange={setDate}
          required
        />



        <label className="block text-sm">

          <span className="mb-1.5 block font-medium text-[var(--foreground)]">

            Hours *

          </span>

          <input

            required

            type="number"

            min="0.01"

            max="24"

            step="0.25"

            value={hours}

            onChange={(event) => setHours(event.target.value)}

            className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--card-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-muted)]"

          />

        </label>

      </div>



      <label className="block text-sm">

        <span className="mb-1.5 block font-medium text-[var(--foreground)]">

          Description *

        </span>

        <textarea

          required

          rows={compact ? 2 : 3}

          value={description}

          onChange={(event) => setDescription(event.target.value)}

          placeholder="What work was performed?"

          className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--card-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-muted)]"

        />

      </label>



      <button

        type="submit"

        disabled={submitting || projectOptions.length === 0}

        className="min-h-11 rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)] disabled:opacity-60"

      >

        {submitting

          ? "Submitting…"

          : role === "employee" || (role === "manager" && forSelf)

            ? "Submit for approval"

            : "Record team manual time"}

      </button>

    </form>

  );

}


