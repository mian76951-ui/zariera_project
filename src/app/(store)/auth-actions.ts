"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { confirmPasswordError, emailError, nameError, newPasswordError } from "@/lib/auth-rules";
import { startCustomerSession, endCustomerSession, safeNext } from "@/lib/customer-auth";
import { clientIp, rateLimit, TOO_MANY } from "@/lib/rate-limit";
import { createToken, readToken } from "@/lib/session-token";
import { sendPasswordResetEmail } from "@/lib/email";
import { logDbError } from "@/lib/db-errors";
import { siteUrl } from "@/lib/site";
import { requireCustomer } from "@/lib/customer-auth";
import { issueCode, verifyCode, setPending, getPending, clearPending, RESEND_COOLDOWN_S } from "@/lib/otp";

export type AuthState = {
  error?: string;
  /** Inputs to mark as wrong (red) next to the error, e.g. ["email", "password"]. */
  fields?: string[];
  ok?: boolean;
  message?: string;
  values?: Record<string, string>;
};

// React 19 resets a form after its server action runs, so on an error the
// shopper would have to retype everything. Echo the (non-secret) fields back;
// the inputs use them as defaultValue.
function keep(formData: FormData, keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.map((k) => [k, String(formData.get(k) ?? "")]));
}


// First failing field (same rules the form shows live — lib/auth-rules.ts).
function firstFieldError(checks: [string, string | null][]): AuthState | null {
  const bad = checks.find(([, err]) => err);
  return bad ? { error: bad[1]!, fields: [bad[0]] } : null;
}

const MINUTE = 60_000;

export async function registerAction(prev: AuthState, formData: FormData): Promise<AuthState> {
  return { ...(await register(prev, formData)), values: keep(formData, ["name", "email"]) };
}

// Step 1 of sign-up: validate, then email a 6-digit code. The account is only
// created once the code is confirmed (step 2, verifyRegistrationAction), so
// nobody can register an email address they don't own.
async function register(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!rateLimit(`register:${await clientIp()}`, 8, 60 * MINUTE)) return { error: TOO_MANY };

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const invalid = firstFieldError([
    ["name", nameError(name)],
    ["email", emailError(email)],
    ["password", newPasswordError(password)],
    ["confirmPassword", confirmPasswordError(String(formData.get("confirmPassword") ?? ""), password)],
  ]);
  if (invalid) return invalid;

  const e = email.toLowerCase();
  const payload = { name, passwordHash: hashPassword(password), next: safeNext(formData.get("next")) };

  try {
    if (await prisma.customer.findUnique({ where: { email: e }, select: { id: true } })) {
      return {
        error: "An account with this email already exists. Please sign in or reset your password.",
        fields: ["email"],
      };
    }
    const sent = await issueCode(e, "register", payload);
    if (!sent.ok) {
      if (!sent.retryAfter) return { error: sent.error };
      // A code was sent moments ago — keep it, but use the latest name/password.
      await prisma.emailVerification.update({
        where: { email_purpose: { email: e, purpose: "register" } },
        data: { payload },
      });
    }
  } catch (err) {
    const kind = logDbError("register", err);
    if (kind === "unavailable" || kind === "not-migrated" || kind === "engine") {
      return { error: "Service unavailable. Please try again shortly." };
    }
    return { error: "Could not start sign-up. Please try again." };
  }

  await setPending(e, "register");
  redirect("/register/verify");
}

export type OtpState = { ok?: boolean; error?: string; message?: string; retryAfter?: number };

const CODE_MSG = { expired: "Your sign-up session expired. Please start again." };

// Step 2 of sign-up: confirm the code, then create the (verified) account.
export async function verifyRegistrationAction(_prev: OtpState, formData: FormData): Promise<OtpState> {
  if (!rateLimit(`otp:${await clientIp()}`, 25, 10 * MINUTE)) return { error: TOO_MANY };
  const pending = await getPending("register");
  if (!pending) return { error: CODE_MSG.expired };

  let created;
  try {
    const r = await verifyCode(pending.email, "register", String(formData.get("code") ?? ""));
    if (!r.ok) return { error: r.error };
    const data = (r.payload ?? {}) as { name?: string; passwordHash?: string; next?: string };
    if (!data.name || !data.passwordHash) return { error: CODE_MSG.expired };
    created = await prisma.customer.create({
      data: { name: data.name, email: pending.email, passwordHash: data.passwordHash, emailVerifiedAt: new Date() },
    });
    await clearPending();
    await startCustomerSession({ id: created.id, email: created.email, name: created.name });
    redirect(withFlash(safeNext(data.next), "register"));
  } catch (err) {
    if (isRedirect(err)) throw err;
    const kind = logDbError("register-verify", err);
    if (kind === "duplicate") return { error: "An account with this email already exists. Please sign in." };
    return { error: "Service unavailable. Please try again shortly." };
  }
}

export async function resendRegistrationCode(): Promise<OtpState> {
  if (!rateLimit(`otp-resend:${await clientIp()}`, 10, 60 * MINUTE)) return { error: TOO_MANY };
  const pending = await getPending("register");
  if (!pending) return { error: CODE_MSG.expired };
  try {
    const r = await issueCode(pending.email, "register");
    if (!r.ok) return { error: r.error, retryAfter: r.retryAfter };
  } catch (err) {
    logDbError("register-resend", err);
    return { error: "Service unavailable. Please try again shortly." };
  }
  return { ok: true, message: "A new code is on its way.", retryAfter: RESEND_COOLDOWN_S };
}

// ---------- Existing customers: verify email (accounts made before OTP / at checkout) ----------

export async function startEmailVerification(): Promise<void> {
  const session = await requireCustomer("/account");
  const customer = await prisma.customer.findUnique({
    where: { id: session.id },
    select: { email: true, emailVerifiedAt: true },
  });
  if (!customer) {
    // Account was removed but the browser still holds its session cookie.
    await endCustomerSession();
    redirect("/login");
  }
  if (customer.emailVerifiedAt) redirect("/account");
  const r = await issueCode(customer.email, "verify");
  if (!r.ok && !r.retryAfter) redirect("/account?flash=verify-send-failed");
  await setPending(customer.email, "verify");
  redirect("/account/verify-email");
}

export async function verifyEmailAction(_prev: OtpState, formData: FormData): Promise<OtpState> {
  if (!rateLimit(`otp:${await clientIp()}`, 25, 10 * MINUTE)) return { error: TOO_MANY };
  const session = await requireCustomer("/account");
  const pending = await getPending("verify");
  if (!pending || pending.email !== session.email.toLowerCase())
    return { error: "This verification session expired. Please start again from your account." };
  try {
    const r = await verifyCode(pending.email, "verify", String(formData.get("code") ?? ""));
    if (!r.ok) return { error: r.error };
    await prisma.customer.update({ where: { id: session.id }, data: { emailVerifiedAt: new Date() } });
    await clearPending();
    redirect("/account?flash=email-verified");
  } catch (err) {
    if (isRedirect(err)) throw err;
    logDbError("verify-email", err);
    return { error: "Service unavailable. Please try again shortly." };
  }
}

export async function resendEmailVerification(): Promise<OtpState> {
  if (!rateLimit(`otp-resend:${await clientIp()}`, 10, 60 * MINUTE)) return { error: TOO_MANY };
  const session = await requireCustomer("/account");
  const pending = await getPending("verify");
  if (!pending || pending.email !== session.email.toLowerCase())
    return { error: "This verification session expired. Please start again from your account." };
  try {
    const r = await issueCode(pending.email, "verify");
    if (!r.ok) return { error: r.error, retryAfter: r.retryAfter };
  } catch (err) {
    logDbError("verify-resend", err);
    return { error: "Service unavailable. Please try again shortly." };
  }
  return { ok: true, message: "A new code is on its way.", retryAfter: RESEND_COOLDOWN_S };
}

// next/navigation's redirect() works by throwing — let it through our catch blocks.
function isRedirect(err: unknown): boolean {
  const digest = (err as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

export async function loginAction(prev: AuthState, formData: FormData): Promise<AuthState> {
  return { ...(await login(prev, formData)), values: keep(formData, ["email"]) };
}

async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "Please enter your email and password.", fields: [!email ? "email" : "password"] };
  }
  if (emailError(email)) return { error: emailError(email)!, fields: ["email"] };

  const ip = await clientIp();
  if (!rateLimit(`login:${ip}`, 20, 15 * MINUTE) || !rateLimit(`login:${email}`, 8, 15 * MINUTE)) {
    return { error: TOO_MANY };
  }

  let customer;
  try {
    customer = await prisma.customer.findUnique({ where: { email } });
  } catch (err) {
    logDbError("login", err);
    return { error: "Service unavailable. Please try again shortly." };
  }

  if (!customer || !verifyPassword(password, customer.passwordHash)) {
    // Don't reveal which one was wrong — mark both.
    return { error: "Incorrect email or password. Please try again.", fields: ["email", "password"] };
  }

  await startCustomerSession({ id: customer.id, email: customer.email, name: customer.name });
  redirect(withFlash(safeNext(formData.get("next")), "login"));
}

export async function logoutAction(): Promise<void> {
  await endCustomerSession();
  redirect("/?flash=signed-out");
}

// ---------- Password reset ----------
// Stateless signed link (1 hour). It embeds a fingerprint of the current
// password hash, so it stops working as soon as the password is changed —
// i.e. each link is single-use.

const RESET_TTL_SECONDS = 60 * 60;
type ResetToken = { id: string; v: string; exp: number };

function fingerprint(passwordHash: string): string {
  return createHash("sha256").update(passwordHash).digest("base64url").slice(0, 16);
}

export async function requestPasswordResetAction(prev: AuthState, formData: FormData): Promise<AuthState> {
  return { ...(await requestReset(prev, formData)), values: keep(formData, ["email"]) };
}

async function requestReset(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (emailError(email)) return { error: emailError(email)!, fields: ["email"] };
  if (!rateLimit(`reset:${await clientIp()}`, 5, 30 * MINUTE) || !rateLimit(`reset:${email}`, 3, 30 * MINUTE)) {
    return { error: TOO_MANY };
  }

  // Same answer whether or not the account exists (no account enumeration).
  const done: AuthState = {
    ok: true,
    message: "If an account exists for that email, we've sent a link to reset your password.",
  };

  try {
    const customer = await prisma.customer.findUnique({ where: { email } });
    if (!customer) return done;
    const token = createToken<ResetToken>("reset", {
      id: customer.id,
      v: fingerprint(customer.passwordHash),
      exp: Math.floor(Date.now() / 1000) + RESET_TTL_SECONDS,
    });
    await sendPasswordResetEmail({
      to: customer.email,
      name: customer.name,
      url: `${siteUrl}/reset-password?token=${encodeURIComponent(token)}`,
    });
  } catch (err) {
    console.error("[auth] password reset request failed:", err);
  }
  return done;
}

export async function resetPasswordAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!rateLimit(`reset-submit:${await clientIp()}`, 10, 30 * MINUTE)) return { error: TOO_MANY };

  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const invalidField = firstFieldError([
    ["password", newPasswordError(password)],
    ["confirmPassword", confirmPasswordError(String(formData.get("confirmPassword") ?? ""), password)],
  ]);
  if (invalidField) return invalidField;

  const data = readToken<ResetToken>("reset", token);
  const invalid = { error: "This reset link is invalid or has expired. Please request a new one." };
  if (!data) return invalid;

  let customer;
  try {
    customer = await prisma.customer.findUnique({ where: { id: data.id } });
    if (!customer || fingerprint(customer.passwordHash) !== data.v) return invalid;
    customer = await prisma.customer.update({
      where: { id: customer.id },
      data: { passwordHash: hashPassword(password) },
    });
  } catch {
    return { error: "Service unavailable. Please try again shortly." };
  }

  await startCustomerSession({ id: customer.id, email: customer.email, name: customer.name });
  redirect("/account?flash=password-reset");
}

function withFlash(path: string, flash: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}flash=${flash}`;
}
