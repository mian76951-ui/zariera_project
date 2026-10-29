"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerAction, type AuthState } from "@/app/(store)/auth-actions";
import { AuthShell } from "@/components/auth/auth-shell";
import {
  AuthAlert,
  AuthField,
  AuthSubmit,
  PasswordStrength,
  SecureNote,
  useAuthForm,
} from "@/components/auth/auth-field";
import { emailError, nameError, newPasswordError } from "@/lib/auth-rules";

const initial: AuthState = {};

const VALIDATE = { name: nameError, email: emailError, password: newPasswordError };

export function RegisterForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(registerAction, initial);
  const [formRef, f] = useAuthForm(formAction, state, VALIDATE);
  const password = f.field("password");

  return (
    <AuthShell>
      <div className="text-center">
        <h1 className="font-serif text-3xl font-bold text-ink">Create account</h1>
        <p className="mt-1 text-sm text-muted">
          Join ZARIERA for a faster checkout. We&apos;ll email you a code to confirm it&apos;s you.
        </p>
      </div>

      {next?.startsWith("/checkout") && (
        <p className="mt-5 rounded-xl border border-gold/50 bg-gold/10 px-3.5 py-3 text-center text-sm text-ink">
          An account is needed to place an order — it takes a minute and your cart is saved.
        </p>
      )}

      <form ref={formRef} action={formAction} onSubmit={f.onSubmit} noValidate className="mt-7 space-y-5">
        {next && <input type="hidden" name="next" value={next} />}
        <AuthField
          name="name"
          label="Full name"
          icon="user"
          autoComplete="name"
          placeholder="Your name"
          {...f.bind("name")}
          {...f.field("name")}
        />
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
        <AuthField
          name="password"
          label="Password"
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

        <div>
          <AuthSubmit pending={pending} label="Continue" pendingLabel="Sending code…" />
          <SecureNote />
        </div>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link
          href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
          className="font-semibold text-gold-deep hover:underline"
        >
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
