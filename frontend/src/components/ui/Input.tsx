"use client";

import { SelectFromChildren } from "@/components/ui/Dropdown";
import { cn } from "@/lib/cn";
import { Eye, EyeOff } from "lucide-react";
import { useState, type InputHTMLAttributes, type SelectHTMLAttributes } from "react";

const baseClass =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--card-elevated)] px-3.5 py-2.5 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(baseClass, className)} {...props} />;
}

export function PasswordInput({
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        className={cn(baseClass, "pr-10", className)}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={visible ? "Hide password" : "Show password"}
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function Select({
  className,
  children,
  value,
  onChange,
  disabled,
  id,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  void props;
  return (
    <SelectFromChildren
      id={id}
      value={value === undefined || Array.isArray(value) ? "" : String(value)}
      onChange={onChange}
      disabled={disabled}
      className={className}
    >
      {children}
    </SelectFromChildren>
  );
}

export function Label({
  children,
  htmlFor,
  required,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="text-label mb-2 block">
      {children}
      {required ? <span className="ml-0.5 text-[var(--accent-coral)]">*</span> : null}
    </label>
  );
}

export function FormField({
  label,
  htmlFor,
  required,
  children,
  hint,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <Label htmlFor={htmlFor} required={required}>
        {label}
      </Label>
      {children}
      {hint ? <p className="mt-1.5 text-xs text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
}
