import { emailError, phoneError } from "./auth-rules";
import { PIECE_TYPES, FINISHES, BUDGETS } from "./custom-request";

// Field rules for the Custom-design and Contact forms: checked live in the
// browser and enforced again by the server actions (inbound-actions.ts).

type Validators = Record<string, (value: string) => string | null>;

/** 5–10 letters (A–Z), single spaces between words allowed. */
export const PERSON_NAME_RE = /^[A-Za-z]+(?: [A-Za-z]+)*$/;

export function personNameError(value: string): string | null {
  const v = value.trim();
  if (!v) return "Please enter your name";
  if (!PERSON_NAME_RE.test(v)) return /\s{2,}/.test(v) ? "Use a single space between words" : "Use letters only (A–Z)";
  const letters = v.replace(/ /g, "").length;
  if (letters < 5) return "Name must have at least 5 letters";
  if (letters > 10) return "Name can have at most 10 letters";
  return null;
}

const oneOf = (options: readonly string[], message: string) => (v: string) => (options.includes(v) ? null : message);
const optional = (rule: (v: string) => string | null) => (v: string) => (v.trim() ? rule(v) : null);
const maxLen = (n: number, message: string) => (v: string) => (v.trim().length > n ? message : null);
const textBetween = (min: number, max: number, short: string) => (v: string) => {
  const t = v.trim();
  if (t.length < min) return short;
  if (t.length > max) return `Please keep this under ${max.toLocaleString("en-PK")} characters`;
  return null;
};

export const CUSTOM_VALIDATORS: Validators = {
  name: personNameError,
  email: emailError,
  phone: phoneError,
  pieceType: oneOf(PIECE_TYPES, "Choose what you'd like us to make"),
  finish: oneOf(FINISHES, "Choose a finish"),
  budget: oneOf(BUDGETS, "Choose a budget"),
  neededBy: maxLen(60, "Keep this under 60 characters"),
  details: textBetween(10, 3000, "Tell us a little about your design (at least a sentence)"),
};

export const CONTACT_VALIDATORS: Validators = {
  name: personNameError,
  email: emailError,
  phone: optional(phoneError),
  subject: maxLen(200, "Keep the subject under 200 characters"),
  message: textBetween(5, 5000, "Please write a short message (at least 5 characters)"),
};

/** Runs the rules over submitted values: the bad fields (in form order) and the first message. */
export function checkFields(rules: Validators, values: Record<string, string>) {
  const fields = Object.keys(rules).filter((k) => rules[k](values[k] ?? ""));
  return fields.length ? { fields, error: rules[fields[0]](values[fields[0]] ?? "")! } : null;
}
