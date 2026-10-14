"use client";

import { OrganizationsTable } from "@/components/platform/OrganizationsTable";
import { PlatformShell } from "@/components/platform/PlatformShell";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  ApiError,
  createPlatformOrganization,
  deletePlatformOrganization,
  fetchPlatformDashboard,
  fetchPlatformMailStatus,
  fetchPlatformOrganizations,
  formatApiErrors,
  resendPlatformAdminInvitation,
  sendPlatformMailTest,
  updatePlatformOrganization,
  updateSuperAdminPassword,
} from "@/lib/api";
import { cn } from "@/lib/cn";
import type { PlatformDashboard, PlatformMailStatus, PlatformOrganization } from "@/lib/types";
import { Building2, Mail, Plus, Send, Users } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState, type ReactNode } from "react";

type Dialog =
  | { kind: "create" }
  | { kind: "mail-test" }
  | { kind: "password" }
  | { kind: "edit-email"; organization: PlatformOrganization }
  | { kind: "suspend"; organization: PlatformOrganization }
  | { kind: "delete"; organization: PlatformOrganization }
  | null;

type Notice = { text: string; tone: "success" | "error" } | null;

function apiMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? formatApiErrors(err.errors) || err.message : fallback;
}

export default function PlatformPage() {
  const [data, setData] = useState<PlatformDashboard | null>(null);
  const [organizations, setOrganizations] = useState<PlatformOrganization[]>([]);
  const [mailStatus, setMailStatus] = useState<PlatformMailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const [dashboard, orgs, mail] = await Promise.all([
        fetchPlatformDashboard(),
        fetchPlatformOrganizations(),
        fetchPlatformMailStatus(),
      ]);
      setData(dashboard);
      setOrganizations(orgs);
      setMailStatus(mail);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Unable to load platform dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const closeDialog = useCallback(() => setDialog(null), []);

  async function runRowAction(
    organization: PlatformOrganization,
    action: () => Promise<string>,
    fallbackError: string,
  ) {
    setBusyId(organization.id);
    setNotice(null);
    try {
      const message = await action();
      setNotice({ text: message, tone: "success" });
      await load();
    } catch (err) {
      setNotice({ text: apiMessage(err, fallbackError), tone: "error" });
    } finally {
      setBusyId(null);
    }
  }

  const actions = {
    onEditEmail: (organization: PlatformOrganization) => setDialog({ kind: "edit-email", organization }),
    onSuspend: (organization: PlatformOrganization) => setDialog({ kind: "suspend", organization }),
    onDelete: (organization: PlatformOrganization) => setDialog({ kind: "delete", organization }),
    onReactivate: (organization: PlatformOrganization) =>
      void runRowAction(
        organization,
        async () => {
          await updatePlatformOrganization(organization.id, { status: "active" });
          return `“${organization.name}” reactivated.`;
        },
        "Failed to reactivate organization.",
      ),
    onResendInvitation: (organization: PlatformOrganization) =>
      void runRowAction(
        organization,
        async () => (await resendPlatformAdminInvitation(organization.id)).message,
        "Failed to resend admin invitation.",
      ),
  };

  const mailNeedsAttention =
    mailStatus !== null && (!mailStatus.configured || Boolean(mailStatus.render_smtp_blocked_hint));

  return (
    <PlatformShell onChangePassword={() => setDialog({ kind: "password" })}>
      <div className="flex flex-col gap-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[0.8125rem] text-[var(--muted)]">Platform console</p>
            <h1 className="mt-1 text-[1.75rem] font-semibold tracking-[-0.02em]">Organizations</h1>
            <p className="mt-1 max-w-xl text-sm text-[var(--muted)]">
              Create organizations, manage their admins and suspend inactive tenants. Organization HR
              data is never visible from this account.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Button
              variant="secondary"
              size="lg"
              onClick={() => setDialog({ kind: "mail-test" })}
              disabled={!mailStatus?.configured}
              title={mailStatus?.configured ? undefined : "Configure email delivery first"}
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              Send test email
            </Button>
            <Button size="lg" onClick={() => setDialog({ kind: "create" })}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              New organization
            </Button>
          </div>
        </header>

        {loadError ? <Alert tone="error">{loadError}</Alert> : null}
        {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}

        {mailNeedsAttention && mailStatus ? <MailWarning status={mailStatus} /> : null}

        <section aria-label="Platform health" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {loading && !data ? (
            [0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[7.375rem] animate-pulse rounded-2xl bg-[var(--accent-sand)]" />
            ))
          ) : data ? (
            <>
              <StatCard
                icon={<Building2 className="h-4 w-4" />}
                label="Organizations"
                value={data.organizations_total}
                detail={`${data.organizations_active} active`}
                dot="var(--primary)"
              />
              <StatCard
                icon={<Building2 className="h-4 w-4" />}
                label="Suspended"
                value={data.organizations_suspended}
                detail={data.organizations_suspended ? "Can be reactivated or deleted" : "None suspended"}
                dot={data.organizations_suspended ? "var(--accent-coral)" : "var(--muted-foreground)"}
              />
              <StatCard
                icon={<Users className="h-4 w-4" />}
                label="Tenant users"
                value={data.tenant_users_total}
                detail="Across all organizations"
                dot="var(--accent-emerald)"
              />
              <StatCard
                icon={<Mail className="h-4 w-4" />}
                label="Email delivery"
                value={mailStatus?.mailer ? capitalize(mailStatus.mailer) : "—"}
                detail={
                  mailStatus?.configured
                    ? mailStatus.from_address
                      ? `Sending as ${mailStatus.from_address}`
                      : "Configured"
                    : "Not configured"
                }
                dot={mailStatus?.configured ? "var(--accent-emerald)" : "var(--accent-coral)"}
              />
            </>
          ) : null}
        </section>

        <OrganizationsTable organizations={organizations} busyId={busyId} actions={actions} />
      </div>

      {dialog?.kind === "create" ? (
        <CreateOrganizationDialog
          onClose={closeDialog}
          onCreated={async (message, emailFailed) => {
            closeDialog();
            setNotice({
              text: emailFailed
                ? `${message} The invitation email was not delivered — use “Resend invite” after fixing email delivery.`
                : message,
              tone: emailFailed ? "error" : "success",
            });
            await load();
          }}
        />
      ) : null}

      {dialog?.kind === "mail-test" ? (
        <MailTestDialog fromAddress={mailStatus?.from_address ?? null} onClose={closeDialog} />
      ) : null}

      {dialog?.kind === "password" ? <PasswordDialog onClose={closeDialog} /> : null}

      {dialog?.kind === "edit-email" ? (
        <EditEmailDialog
          organization={dialog.organization}
          onClose={closeDialog}
          onSaved={async () => {
            closeDialog();
            setNotice({ text: "Admin email updated.", tone: "success" });
            await load();
          }}
        />
      ) : null}

      {dialog?.kind === "suspend" ? (
        <ConfirmDialog
          title={`Suspend ${dialog.organization.name}?`}
          body="Its admin and employees lose access immediately. Nothing is deleted — you can reactivate it later, or delete it once suspended."
          confirmLabel="Suspend organization"
          onClose={closeDialog}
          onConfirm={() => {
            const organization = dialog.organization;
            closeDialog();
            void runRowAction(
              organization,
              async () => {
                await updatePlatformOrganization(organization.id, { status: "suspended" });
                return `“${organization.name}” suspended. Use Delete to remove it permanently.`;
              },
              "Failed to suspend organization.",
            );
          }}
        />
      ) : null}

      {dialog?.kind === "delete" ? (
        <ConfirmDialog
          title={`Delete ${dialog.organization.name}?`}
          body="This permanently removes the organization and all of its data — people, time entries, screenshots and payroll. It can't be undone."
          confirmLabel="Delete permanently"
          requireText={dialog.organization.name}
          onClose={closeDialog}
          onConfirm={() => {
            const organization = dialog.organization;
            closeDialog();
            void runRowAction(
              organization,
              async () => {
                await deletePlatformOrganization(organization.id);
                setOrganizations((current) => current.filter((org) => org.id !== organization.id));
                return `“${organization.name}” permanently deleted.`;
              },
              "Failed to delete organization. Suspend it first, then delete.",
            );
          }}
        />
      ) : null}
    </PlatformShell>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function Alert({ tone, children }: { tone: "success" | "error"; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-xl border px-4 py-3 text-sm",
        tone === "error"
          ? "border-[var(--accent-coral)]/30 bg-[var(--accent-coral-soft)] text-[var(--accent-coral)]"
          : "border-[var(--accent-emerald)]/30 bg-[var(--accent-emerald-soft)] text-[var(--accent-emerald)]",
      )}
    >
      {children}
    </p>
  );
}

function StatCard({
  icon,
  label,
  value,
  detail,
  dot,
}: {
  icon: ReactNode;
  label: string;
  value: number | string;
  detail: string;
  dot: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="flex items-center justify-between text-[var(--muted)]">
        <p className="text-[0.8125rem]">{label}</p>
        <span aria-hidden="true">{icon}</span>
      </div>
      <p
        className={cn(
          "mt-2 truncate text-[1.625rem] font-semibold tracking-[-0.01em] text-[var(--foreground)]",
          typeof value === "number" && "num",
        )}
      >
        {value}
      </p>
      <p className="mt-1.5 flex items-center gap-2 text-[0.8125rem] text-[var(--muted)]" title={detail}>
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: dot }} aria-hidden="true" />
        <span className="truncate">{detail}</span>
      </p>
    </div>
  );
}

function MailWarning({ status }: { status: PlatformMailStatus }) {
  return (
    <section
      aria-labelledby="mail-warning"
      className="rounded-2xl border border-[var(--accent-copper)]/30 bg-[var(--accent-copper-soft)] p-5 text-[var(--foreground)]"
    >
      <h2 id="mail-warning" className="text-sm font-semibold text-[var(--accent-copper)]">
        {status.configured ? "Email delivery is failing" : "Email delivery isn’t configured"}
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Organization invitations won’t reach inboxes until this is fixed in the API’s environment variables.
      </p>
      {[status.issue, status.render_smtp_blocked_hint, status.brevo_sender_verification_hint]
        .filter(Boolean)
        .map((line) => (
          <p key={line} className="mt-2 text-sm">
            {line}
          </p>
        ))}
      <p className="mt-3 text-xs text-[var(--muted)]">
        Mailer <span className="num">{status.mailer}</span>
        {status.recommended_mailer ? (
          <>
            {" "}
            · recommended <span className="num">{status.recommended_mailer}</span>
          </>
        ) : null}
        {status.host ? (
          <>
            {" "}
            · <span className="num">{status.host}:{status.port}</span>
          </>
        ) : null}
      </p>
    </section>
  );
}

const fieldClass =
  "min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--card-elevated)] px-3 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20";

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-[0.8125rem] font-medium text-[var(--foreground)]">
      {label}
      {children}
      {hint ? <span className="text-xs font-normal text-[var(--muted)]">{hint}</span> : null}
    </label>
  );
}

function FormError({ message }: { message: string }) {
  return message ? (
    <p role="alert" className="text-sm text-[var(--danger)]">
      {message}
    </p>
  ) : null;
}

function DialogActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap justify-end gap-2 pt-2">{children}</div>;
}

function CreateOrganizationDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (message: string, emailFailed: boolean) => Promise<void>;
}) {
  const [orgName, setOrgName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const response = await createPlatformOrganization({
        organization_name: orgName,
        admin_name: adminName,
        admin_email: adminEmail,
      });
      await onCreated(response.message, response.invitation_email_sent === false);
    } catch (err) {
      setError(apiMessage(err, "Failed to create organization."));
      setSaving(false);
    }
  }

  return (
    <Modal
      title="New organization"
      description="Creates the organization and emails its admin an invitation to set a password."
      onClose={onClose}
    >
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <Field label="Organization name">
          <input required value={orgName} onChange={(e) => setOrgName(e.target.value)} className={fieldClass} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Admin full name">
            <input required value={adminName} onChange={(e) => setAdminName(e.target.value)} className={fieldClass} />
          </Field>
          <Field label="Admin email">
            <input
              required
              type="email"
              autoComplete="off"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              className={fieldClass}
            />
          </Field>
        </div>
        <FormError message={error} />
        <DialogActions>
          <Button type="button" variant="secondary" size="lg" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="lg" disabled={saving}>
            {saving ? "Creating…" : "Create organization"}
          </Button>
        </DialogActions>
      </form>
    </Modal>
  );
}

function MailTestDialog({ fromAddress, onClose }: { fromAddress: string | null; onClose: () => void }) {
  const [recipient, setRecipient] = useState("");
  const [result, setResult] = useState<Notice>(null);
  const [sending, setSending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);
    setSending(true);
    try {
      const response = await sendPlatformMailTest(recipient.trim() || undefined);
      setResult({ text: response.message, tone: "success" });
    } catch (err) {
      setResult({ text: apiMessage(err, "Mail test failed."), tone: "error" });
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal
      title="Send a test email"
      description={
        fromAddress ? `Sent from ${fromAddress}. Check spam if it doesn’t arrive.` : "Uses the configured sender."
      }
      onClose={onClose}
    >
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <Field label="Recipient" hint="Leave empty to send it to yourself.">
          <input
            type="email"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="name@company.com"
            className={fieldClass}
          />
        </Field>
        {result ? <Alert tone={result.tone}>{result.text}</Alert> : null}
        <DialogActions>
          <Button type="button" variant="secondary" size="lg" onClick={onClose}>
            Close
          </Button>
          <Button type="submit" size="lg" disabled={sending}>
            {sending ? "Sending…" : "Send test email"}
          </Button>
        </DialogActions>
      </form>
    </Modal>
  );
}

function PasswordDialog({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [result, setResult] = useState<Notice>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);
    setSaving(true);
    try {
      const response = await updateSuperAdminPassword({
        current_password: current,
        password: next,
        password_confirmation: confirm,
      });
      setResult({ text: response.message, tone: "success" });
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setResult({ text: apiMessage(err, "Password update failed."), tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Change password" description="Only you can change the super admin password." onClose={onClose} size="sm">
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <Field label="Current password">
          <input
            required
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className={fieldClass}
          />
        </Field>
        <Field label="New password" hint="At least 8 characters.">
          <input
            required
            type="password"
            minLength={8}
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className={fieldClass}
          />
        </Field>
        <Field label="Confirm new password">
          <input
            required
            type="password"
            minLength={8}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={fieldClass}
          />
        </Field>
        {result ? <Alert tone={result.tone}>{result.text}</Alert> : null}
        <DialogActions>
          <Button type="button" variant="secondary" size="lg" onClick={onClose}>
            Close
          </Button>
          <Button type="submit" size="lg" disabled={saving}>
            {saving ? "Saving…" : "Update password"}
          </Button>
        </DialogActions>
      </form>
    </Modal>
  );
}

function EditEmailDialog({
  organization,
  onClose,
  onSaved,
}: {
  organization: PlatformOrganization;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [email, setEmail] = useState(organization.admin_email ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await updatePlatformOrganization(organization.id, { admin_email: email.trim() });
      await onSaved();
    } catch (err) {
      setError(apiMessage(err, "Failed to update admin email."));
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Edit admin email"
      description={`${organization.name} · admin ${organization.admin_name ?? "unknown"}`}
      onClose={onClose}
      size="sm"
    >
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <Field label="Admin email" hint="The admin signs in with this address.">
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={fieldClass} />
        </Field>
        <FormError message={error} />
        <DialogActions>
          <Button type="button" variant="secondary" size="lg" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="lg" disabled={saving}>
            {saving ? "Saving…" : "Save email"}
          </Button>
        </DialogActions>
      </form>
    </Modal>
  );
}

function ConfirmDialog({
  title,
  body,
  confirmLabel,
  requireText,
  onClose,
  onConfirm,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  requireText?: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState("");
  const blocked = Boolean(requireText) && typed.trim() !== requireText;

  return (
    <Modal title={title} onClose={onClose} size="sm">
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!blocked) onConfirm();
        }}
      >
        <p className="text-sm leading-relaxed text-[var(--muted)]">{body}</p>
        {requireText ? (
          <Field label={`Type “${requireText}” to confirm`}>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} className={fieldClass} autoComplete="off" />
          </Field>
        ) : null}
        <DialogActions>
          <Button type="button" variant="secondary" size="lg" onClick={onClose}>
            Cancel
          </Button>
          <button
            type="submit"
            disabled={blocked}
            className="inline-flex h-11 items-center rounded-xl bg-[var(--danger)] px-5 text-sm font-semibold text-[var(--primary-foreground)] transition hover:brightness-110 disabled:opacity-50"
          >
            {confirmLabel}
          </button>
        </DialogActions>
      </form>
    </Modal>
  );
}
