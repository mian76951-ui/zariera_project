"use client";

import { useActionState, useEffect } from "react";
import { sendContactMessage, type InboundState } from "@/app/(store)/inbound-actions";
import { CONTACT_VALIDATORS } from "@/lib/inbound-rules";
import { useToast } from "@/components/ui/toast";
import { AuthAlert, useAuthForm } from "@/components/auth/auth-field";
import { Field, bindControl, fieldControl as control, phoneChars } from "@/components/form/validated-field";

const initial: InboundState = {};

export function ContactForm({ topic, defaultSubject }: { topic?: string; defaultSubject?: string }) {
  const [state, formAction, pending] = useActionState(sendContactMessage, initial);
  const [formRef, f] = useAuthForm(formAction, state, CONTACT_VALIDATORS, {
    initial: defaultSubject ? { subject: defaultSubject } : {},
  });
  const bind = (name: string, filter?: (v: string) => string) => bindControl(f, name, filter);
  const toast = useToast();

  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok) toast.success("We'll get back to you soon.", { title: "Message sent" });
  }, [state, toast]);

  if (state.ok) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--line)] bg-cream-soft p-10 text-center">
        <h2 className="font-serif text-2xl font-semibold text-ink">Thank you!</h2>
        <p className="mt-2 text-muted">Your message has been received. We&apos;ll reply shortly.</p>
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} onSubmit={f.onSubmit} noValidate className="space-y-4">
      {topic && <input type="hidden" name="topic" value={topic} />}
      {/* Honeypot for bots — hidden from people and screen readers */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" hint="5–10 letters (A–Z)" {...f.field("name")}>
          {(a11y) => <input {...a11y} {...bind("name")} autoComplete="name" maxLength={20} placeholder="e.g. Ayesha" className={control} />}
        </Field>
        <Field label="Email" {...f.field("email")}>
          {(a11y) => (
            <input {...a11y} {...bind("email")} type="email" autoComplete="email" spellCheck={false} placeholder="you@example.com" className={control} />
          )}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone (optional)" hint="03XX XXXXXXX, 92… or +country code" {...f.field("phone")}>
          {(a11y) => (
            <input {...a11y} {...bind("phone", phoneChars)} type="tel" inputMode="tel" autoComplete="tel" maxLength={20} placeholder="0300 1234567" className={control} />
          )}
        </Field>
        <Field label="Subject (optional)" {...f.field("subject")}>
          {(a11y) => <input {...a11y} {...bind("subject")} maxLength={200} placeholder="What's it about?" className={control} />}
        </Field>
      </div>
      <Field label="Your message" multiline {...f.field("message")}>
        {(a11y) => (
          <textarea {...a11y} {...bind("message")} rows={5} maxLength={5000} placeholder="How can we help?" className={`${control} resize-y`} />
        )}
      </Field>
      {state.error && <AuthAlert>{state.error}</AuthAlert>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-maroon px-9 py-3 text-sm font-medium uppercase tracking-[0.12em] text-light transition hover:bg-maroon-2 disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send Message"}
      </button>
    </form>
  );
}
