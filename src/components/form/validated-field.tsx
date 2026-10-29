"use client";

import { useId, type ReactNode } from "react";
import { FieldError, StatusIcon, statusRing, useAuthForm, type FieldStatus } from "@/components/auth/auth-field";

// Labelled field box for the Custom-design and Contact forms: gold focus, green
// with a tick when valid, red with a message when not (rules: lib/inbound-rules.ts).

/** Classes for the input / select / textarea inside a Field box. */
export const fieldControl =
  "w-full min-w-0 bg-transparent px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-muted/60";

/** Phone boxes keep only a leading "+", digits and single spaces. */
export const phoneChars = (v: string) => v.replace(/[^\d+ ]/g, "").replace(/(?!^)\+/g, "").replace(/ {2,}/g, " ");

/** Controlled value + live status wiring for a native control: `<input {...bindControl(f, "email")} />`. */
export function bindControl(f: ReturnType<typeof useAuthForm>[1], name: string, filter?: (v: string) => string) {
  const b = f.bind(name);
  return {
    name,
    value: b.value,
    onChange: (e: { target: { value: string } }) => b.onChange(filter ? filter(e.target.value) : e.target.value),
    onBlur: b.onBlur,
  };
}

export function Field({
  label,
  status,
  error,
  hint,
  multiline = false,
  children,
}: {
  label: string;
  status: FieldStatus;
  error: string | null;
  hint?: string;
  multiline?: boolean;
  children: (a11y: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => ReactNode;
}) {
  const id = useId();
  const errId = `${id}-err`;
  const showError = status === "invalid" && error;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium uppercase tracking-[0.1em] text-muted">
        {label}
      </label>
      <div className={`relative flex rounded-lg border bg-surface transition ${multiline ? "items-start" : "items-center"} ${statusRing(status)}`}>
        {children({ id, "aria-invalid": status === "invalid", "aria-describedby": showError ? errId : undefined })}
        <StatusIcon status={status} className={multiline ? "mr-3 mt-2.5" : "mr-3"} />
      </div>
      {showError ? <FieldError id={errId}>{error}</FieldError> : hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}
