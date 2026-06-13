"use client";

import { ApiError, uploadOrganizationLogo } from "@/lib/api";
import { useRef, useState } from "react";

type LogoUploadFieldProps = {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
};

export function LogoUploadField({ value, onChange, disabled = false }: LogoUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");
    try {
      const response = await uploadOrganizationLogo(file);
      onChange(response.logo_url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Logo upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card-elevated)]">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="Organization logo" className="h-full w-full object-contain" />
          ) : (
            <span className="text-xs font-semibold text-[var(--muted)]">Logo</span>
          )}
        </div>
        <div className="space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
            className="hidden"
            disabled={disabled || uploading}
            onChange={(event) => void handleFileChange(event)}
          />
          <button
            type="button"
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
            className="rounded-lg border border-[var(--border)] bg-[var(--card-elevated)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:border-[var(--primary)] disabled:opacity-60"
          >
            {uploading ? "Uploading…" : value ? "Replace logo" : "Upload logo"}
          </button>
          {value ? (
            <button
              type="button"
              disabled={disabled || uploading}
              onClick={() => onChange("")}
              className="block text-xs font-medium text-[var(--muted)] hover:text-[var(--danger)]"
            >
              Remove logo
            </button>
          ) : null}
          <p className="text-xs text-[var(--muted)]">PNG, JPG, WEBP, or GIF up to 2 MB.</p>
        </div>
      </div>
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
