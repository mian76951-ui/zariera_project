"use client";

import { useCallback, useEffect, useId, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { passwordRules, passwordStrength } from "@/lib/auth-rules";
import { RevealToggle } from "./password-input";

// Shared building blocks for the sign-in / sign-up / reset cards: icon inputs
// with live valid / invalid states, the "no" shake, an error banner, the
// password checklist + strength meter, and the submit button.

export type FieldStatus = "idle" | "valid" | "invalid";

const ICONS = {
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m4 7 8 6 8-6" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 19.5c1.2-3.4 3.8-5 7-5s5.8 1.6 7 5" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
};

function Svg({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

const CheckIcon = ({ className = "" }: { className?: string }) => (
  <Svg className={className}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);
const AlertIcon = ({ className = "" }: { className?: string }) => (
  <Svg className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5.5M12 16.5h.01" />
  </Svg>
);

/** Re-triggerable "no" shake on an element (restarts even mid-animation). */
export function useShake<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const shake = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.remove("animate-shake");
    void el.offsetWidth; // reflow so the animation restarts
    el.classList.add("animate-shake");
  }, []);
  return [ref, shake] as const;
}

/** Border + focus ring for a field box: red when invalid, green when valid, gold focus otherwise. */
export function statusRing(status: FieldStatus): string {
  return status === "invalid"
    ? "border-bad bg-bad/[0.04] focus-within:ring-[3px] focus-within:ring-bad/15"
    : status === "valid"
      ? "border-ok/70 focus-within:border-ok focus-within:ring-[3px] focus-within:ring-ok/15"
      : "border-[var(--line-strong)] focus-within:border-gold focus-within:ring-[3px] focus-within:ring-[rgba(195,154,78,0.22)]";
}

/** Green tick / red alert at the end of a field box. */
export function StatusIcon({ status, className = "" }: { status: FieldStatus; className?: string }) {
  if (status === "valid")
    return (
      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ok text-white ${className}`}>
        <CheckIcon className="h-3.5 w-3.5" />
      </span>
    );
  if (status === "invalid") return <AlertIcon className={`h-5 w-5 shrink-0 text-bad ${className}`} />;
  return null;
}

/** Red message under an invalid field. */
export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-bad">
      <AlertIcon className="h-3.5 w-3.5 shrink-0" />
      {children}
    </p>
  );
}

type ServerState = { error?: string; fields?: string[] };
type Validators = Record<string, (value: string) => string | null>;

/** Field values, live status, client-side check before submit and the shake —
 *  shared by the sign-in / sign-up / reset forms.
 *  `<form action={formAction}>` stays as the no-JS fallback; with JS, onSubmit
 *  validates first and dispatches the action itself (so React doesn't reset the
 *  controlled inputs). */
export function useAuthForm(
  formAction: (payload: FormData) => void,
  state: ServerState,
  validators: Validators,
  { clearOnError = [], initial = {} }: { clearOnError?: string[]; initial?: Record<string, string> } = {}
) {
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [serverBad, setServerBad] = useState<string[]>([]);
  const [seen, setSeen] = useState(state);
  const [formRef, shake] = useShake<HTMLFormElement>();
  const [, startTransition] = useTransition();

  // New server answer: mark its fields, empty secrets (adjust-state-during-render).
  if (state !== seen) {
    setSeen(state);
    setServerBad(state.error ? (state.fields ?? []) : []);
    if (state.error && clearOnError.length) {
      setValues((v) => ({ ...v, ...Object.fromEntries(clearOnError.map((k) => [k, ""])) }));
    }
  }
  useEffect(() => {
    if (state.error) shake();
  }, [state, shake]);

  const value = (name: string) => values[name] ?? "";
  const set = (name: string, v: string) => {
    setValues((prev) => ({ ...prev, [name]: v }));
    setServerBad((prev) => prev.filter((n) => n !== name));
  };
  const blur = (name: string) => setTouched((t) => ({ ...t, [name]: true }));

  // The ref goes out separately so render code never touches an object holding it.
  const api = {
    value,
    /** Wires an AuthField to this form's state: `<AuthField {...f.bind("email")} />`. */
    bind: (name: string) => ({
      value: value(name),
      onChange: (v: string) => set(name, v),
      onBlur: () => blur(name),
    }),
    /** `positive: false` = never show green (e.g. a sign-in password we can't judge). */
    field(name: string, { positive = true }: { positive?: boolean } = {}): { status: FieldStatus; error: string | null } {
      const err = validators[name]?.(value(name)) ?? null;
      if (serverBad.includes(name)) return { status: "invalid", error: null };
      if ((touched[name] || submitted) && err) return { status: "invalid", error: err };
      if (positive && value(name) && !err) return { status: "valid", error: null };
      return { status: "idle", error: null };
    },
    onSubmit(e: FormEvent<HTMLFormElement>) {
      e.preventDefault();
      const bad = Object.keys(validators).filter((k) => validators[k](value(k)));
      if (bad.length) {
        setSubmitted(true);
        shake();
        e.currentTarget.querySelector<HTMLInputElement>(`[name="${bad[0]}"]`)?.focus();
        return;
      }
      const data = new FormData(e.currentTarget);
      startTransition(() => formAction(data));
    },
  };
  return [formRef, api] as const;
}

export function AuthField({
  name,
  label,
  icon,
  type = "text",
  value,
  onChange,
  onBlur,
  status,
  error,
  autoComplete,
  placeholder,
  password = false,
  labelAside,
  children,
}: {
  name: string;
  label: string;
  icon: keyof typeof ICONS;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  status: FieldStatus;
  /** Shown under the field when status is "invalid". */
  error?: string | null;
  autoComplete?: string;
  placeholder?: string;
  /** Adds a show / hide toggle. */
  password?: boolean;
  /** Small element at the right of the label row (e.g. "Forgot password?"). */
  labelAside?: ReactNode;
  children?: ReactNode;
}) {
  const id = useId();
  const [show, setShow] = useState(false);
  const errId = `${id}-err`;

  const ring = statusRing(status);
  const iconColor = status === "invalid" ? "text-bad" : status === "valid" ? "text-ok" : "text-muted group-focus-within:text-gold-deep";

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted">
          {label}
        </label>
        {labelAside}
      </div>

      <div className={`group relative flex items-center rounded-xl border bg-surface shadow-[inset_0_1px_2px_rgba(38,8,16,0.05)] transition ${ring}`}>
        <Svg className={`pointer-events-none ml-3.5 h-[1.15rem] w-[1.15rem] shrink-0 transition-colors ${iconColor}`}>
          {ICONS[icon]}
        </Svg>
        <input
          id={id}
          name={name}
          type={password ? (show ? "text" : "password") : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={status === "invalid"}
          aria-describedby={status === "invalid" && error ? errId : undefined}
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent px-3 py-3.5 text-[0.95rem] text-ink outline-none placeholder:text-muted/55"
        />
        <StatusIcon status={status} className="mr-1" />
        {password ? (
          <RevealToggle shown={show} onToggle={() => setShow((v) => !v)} />
        ) : (
          <span className="w-3" />
        )}
      </div>

      {status === "invalid" && error && <FieldError id={errId}>{error}</FieldError>}
      {children}
    </div>
  );
}

/** Checklist + 4-bar strength meter under a new-password field. */
export function PasswordStrength({ value, highlight }: { value: string; highlight?: boolean }) {
  const rules = passwordRules(value);
  const score = passwordStrength(value);
  const names = ["", "Weak", "Fair", "Good", "Strong"];
  const bar = score <= 1 ? "bg-bad" : score === 2 ? "bg-gold" : "bg-ok";

  return (
    <div className="mt-2.5 rounded-lg bg-sand/40 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1">
          {[1, 2, 3, 4].map((i) => (
            <span key={i} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= score ? bar : "bg-[var(--line)]"}`} />
          ))}
        </div>
        <span className={`w-12 text-right text-[0.65rem] font-semibold uppercase tracking-wider ${score ? (score <= 1 ? "text-bad" : score === 2 ? "text-gold-deep" : "text-ok") : "text-muted"}`}>
          {names[score] || "—"}
        </span>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {rules.map((r) => (
          <li
            key={r.id}
            className={`flex items-center gap-1.5 text-xs transition-colors ${r.ok ? "text-ok" : highlight ? "text-bad" : "text-muted"}`}
          >
            <span className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border ${r.ok ? "border-ok bg-ok text-white" : "border-current"}`}>
              {r.ok && <CheckIcon className="h-2.5 w-2.5" />}
            </span>
            {r.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Error banner shown above the submit button. */
export function AuthAlert({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-bad/30 bg-bad/[0.06] px-3.5 py-3 text-sm text-bad">
      <AlertIcon className="mt-px h-[1.1rem] w-[1.1rem] shrink-0" />
      <span>{children}</span>
    </div>
  );
}

/** Maroon pill with a gold sheen on hover and a spinner while pending. */
export function AuthSubmit({ pending, label, pendingLabel }: { pending: boolean; label: string; pendingLabel: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="group relative w-full overflow-hidden rounded-full bg-gradient-to-r from-[#6b2133] via-maroon to-wine-deep px-6 py-3.5 text-sm font-semibold uppercase tracking-[0.16em] text-light shadow-[0_16px_34px_-14px_rgba(91,26,43,0.8)] transition hover:shadow-[0_18px_40px_-14px_rgba(91,26,43,0.95)] disabled:cursor-wait disabled:opacity-80"
    >
      <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-[rgba(236,208,140,0.35)] to-transparent opacity-0 transition-all duration-700 group-hover:left-[110%] group-hover:opacity-100" />
      <span className="relative inline-flex items-center justify-center gap-2.5">
        {pending && <span className="h-4 w-4 animate-spin rounded-full border-2 border-light/30 border-t-gold-hi" />}
        {pending ? pendingLabel : label}
        {!pending && <span className="text-gold-hi transition-transform group-hover:translate-x-0.5">→</span>}
      </span>
    </button>
  );
}

/** Small reassurance line under the submit button. */
export function SecureNote() {
  return (
    <p className="mt-3 flex items-center justify-center gap-1.5 text-[0.68rem] uppercase tracking-[0.14em] text-muted">
      <Svg className="h-3.5 w-3.5 text-gold-deep">{ICONS.lock}</Svg>
      Secure, encrypted sign-in
    </p>
  );
}
