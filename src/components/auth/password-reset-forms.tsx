"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  requestPasswordResetAction,
  resetPasswordAction,
  type AuthState,
} from "@/app/(store)/auth-actions";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthAlert, AuthField, AuthSubmit, PasswordStrength, useAuthForm } from "@/components/auth/auth-field";
import { emailError, newPasswordError } from "@/lib/auth-rules";

const initial: AuthState = {};

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, initial);
  const [formRef, f] = useAuthForm(formAction, state, { email: emailError });

  return (
    <AuthShell backHref="/login" backLabel="Back to sign in">
      <div className="text-center">
        <h1 className="font-serif text-3xl font-bold text-ink">Forgot password</h1>
        <p className="mt-1 text-sm text-muted">We&apos;ll email you a link to choose a new one.</p>
      </div>

      {state.ok ? (
        <div className="mt-7 rounded-xl border border-ok/40 bg-ok/[0.07] px-4 py-4 text-center text-sm text-ink">
          <p className="font-serif text-lg font-semibold text-ok">Check your inbox</p>
          <p className="mt-1">{state.message}</p>
        </div>
      ) : (
        <form ref={formRef} action={formAction} onSubmit={f.onSubmit} noValidate className="mt-7 space-y-5">
          <AuthField
            name="email"
            label="Email"
            icon="mail"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            {...f.bind("email")}
            {...f.field("email")}
          />
          {state.error && <AuthAlert>{state.error}</AuthAlert>}
          <AuthSubmit pending={pending} label="Send Reset Link" pendingLabel="Sending…" />
        </form>
      )}

      <p className="mt-6 text-center text-sm text-muted">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-gold-deep hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initial);
  const [formRef, f] = useAuthForm(formAction, state, { password: newPasswordError });
  const password = f.field("password");

  return (
    <AuthShell backHref="/login" backLabel="Back to sign in">
      <div className="text-center">
        <h1 className="font-serif text-3xl font-bold text-ink">Choose a new password</h1>
        <p className="mt-1 text-sm text-muted">You&apos;ll be signed in right after.</p>
      </div>

      {token ? (
        <form ref={formRef} action={formAction} onSubmit={f.onSubmit} noValidate className="mt-7 space-y-5">
          <input type="hidden" name="token" value={token} />
          <AuthField
            name="password"
            label="New password"
            icon="lock"
            password
            autoComplete="new-password"
            placeholder="Create a password"
            {...f.bind("password")}
            {...password}
          >
            <PasswordStrength value={f.value("password")} highlight={password.status === "invalid"} />
          </AuthField>
          {state.error && <AuthAlert>{state.error}</AuthAlert>}
          <AuthSubmit pending={pending} label="Update Password" pendingLabel="Saving…" />
        </form>
      ) : (
        <div className="mt-7">
          <AuthAlert>
            This reset link is incomplete.{" "}
            <Link href="/forgot-password" className="font-semibold underline">
              Request a new one
            </Link>
            .
          </AuthAlert>
        </div>
      )}
    </AuthShell>
  );
}
