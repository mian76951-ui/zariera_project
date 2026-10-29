"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { sendCustomRequest, type InboundState } from "@/app/(store)/inbound-actions";
import { PIECE_TYPES, FINISHES, BUDGETS } from "@/lib/custom-request";
import { CUSTOM_VALIDATORS } from "@/lib/inbound-rules";
import { useToast } from "@/components/ui/toast";
import { ReferencePhotos } from "@/components/reference-photos";
import { AuthAlert, useAuthForm } from "@/components/auth/auth-field";
import { Field, bindControl, fieldControl as control, phoneChars } from "@/components/form/validated-field";

const initial: InboundState = {};

export function CustomDesignForm({ whatsappUrl }: { whatsappUrl?: string }) {
  const [state, formAction, pending] = useActionState(sendCustomRequest, initial);
  const [formRef, f] = useAuthForm(formAction, state, CUSTOM_VALIDATORS);
  const toast = useToast();

  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok) toast.success("We'll contact you within 1–2 working days.", { title: "Request received" });
  }, [state, toast]);

  const bind = (name: string, filter?: (v: string) => string) => bindControl(f, name, filter);

  if (state.ok) {
    return (
      <div className="rounded-2xl border border-gold/40 bg-gold/5 px-6 py-12 text-center">
        <h3 className="font-serif text-2xl font-semibold text-ink">Thank you — your design request is in!</h3>
        <p className="mx-auto mt-2 max-w-md text-muted">
          Our team will review your idea and contact you within 1–2 working days with design options and a
          price.
        </p>
        <Link
          href="/shop"
          className="mt-6 inline-block rounded-full border border-[var(--line-strong)] px-7 py-2.5 text-sm font-medium text-ink transition hover:border-gold hover:text-gold-deep"
        >
          Browse the collection meanwhile
        </Link>
      </div>
    );
  }

  const select = (name: string, label: string, options: readonly string[]) => (
    <Field label={label} {...f.field(name)}>
      {(a11y) => (
        <select {...a11y} {...bind(name)} className={`${control} cursor-pointer`}>
          <option value="" disabled>Choose…</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      )}
    </Field>
  );

  return (
    <form ref={formRef} action={formAction} onSubmit={f.onSubmit} noValidate className="space-y-5">
      {/* Honeypot for bots */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Your name" hint="5–10 letters (A–Z)" {...f.field("name")}>
          {(a11y) => <input {...a11y} {...bind("name")} autoComplete="name" maxLength={20} placeholder="e.g. Ayesha" className={control} />}
        </Field>
        <Field label="Email" {...f.field("email")}>
          {(a11y) => (
            <input {...a11y} {...bind("email")} type="email" autoComplete="email" spellCheck={false} placeholder="you@example.com" className={control} />
          )}
        </Field>
        <Field label="Phone / WhatsApp" hint="03XX XXXXXXX, 92… or +country code" {...f.field("phone")}>
          {(a11y) => (
            <input {...a11y} {...bind("phone", phoneChars)} type="tel" inputMode="tel" autoComplete="tel" maxLength={20} placeholder="0300 1234567" className={control} />
          )}
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {select("pieceType", "What should we make?", PIECE_TYPES)}
        {select("finish", "Finish", FINISHES)}
        {select("budget", "Budget", BUDGETS)}
      </div>

      <Field label="Needed by (optional)" {...f.field("neededBy")}>
        {(a11y) => <input {...a11y} {...bind("neededBy")} maxLength={60} placeholder="e.g. Wedding on 15 December, or flexible" className={control} />}
      </Field>

      <Field label="Describe your design" multiline {...f.field("details")}>
        {(a11y) => (
          <textarea
            {...a11y}
            {...bind("details")}
            rows={5}
            maxLength={3000}
            placeholder="Names or initials to engrave, ring size or chain length, stones, style you like, the occasion…"
            className={`${control} resize-y`}
          />
        )}
      </Field>

      <ReferencePhotos resyncKey={state} whatsappUrl={whatsappUrl} />

      {state.error && <AuthAlert>{state.error}</AuthAlert>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">No payment now — we&apos;ll share designs and a price first.</p>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-maroon px-9 py-3.5 text-sm font-medium uppercase tracking-[0.12em] text-light transition hover:bg-maroon-2 disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send Design Request"}
        </button>
      </div>
    </form>
  );
}
