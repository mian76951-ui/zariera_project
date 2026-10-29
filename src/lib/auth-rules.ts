// Field rules shared by the sign-in / sign-up / reset forms (live feedback in the
// browser) and their server actions (the real check). Dependency-free so it can
// load anywhere, including standalone scripts.

/** Minimum length for customer passwords (register, checkout sign-up, reset). */
export const MIN_PASSWORD = 8;

// name@domain.tld, strictly: local part of letters / digits / . _ % + - with no
// leading, trailing or doubled dots; after the @ letters only (owner's rule — no
// digits), labels that don't start or end with "-"; a TLD of 2–24 letters.
export const EMAIL_RE =
  /^[a-z0-9_%+-]+(?:\.[a-z0-9_%+-]+)*@(?:[a-z](?:[a-z-]{0,61}[a-z])?\.)+[a-z]{2,24}$/i;

// Real endings only: any 2-letter country code (.pk, .uk, .ae …) or one of
// these. Catches ".comm", ".con", ".cmo", ".coom" and friends.
const GENERIC_TLDS = new Set(
  "com net org edu gov mil int info biz name pro mobi asia aero coop jobs travel io co app dev me tv cc ai xyz online site store shop tech cloud live email digital agency studio design media news blog website space world life today company services solutions group global network systems academy center consulting".split(" ")
);
const TLD_TYPOS = new Set(["co", "cm", "om", "con", "cmo", "ocm", "comm", "coom", "vom", "xom", "cpm", "clm", "cim", "comn", "coml", "net1"]);

// Mailboxes people actually use — a near miss ("gmial.com", "gmail.co") is a typo.
const PROVIDERS = [
  "gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "rocketmail.com", "hotmail.com", "outlook.com",
  "live.com", "msn.com", "icloud.com", "me.com", "aol.com", "protonmail.com", "proton.me", "mail.com", "zoho.com",
  "email.com", "gmx.com", "yandex.com",
];

function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  return d[a.length][b.length];
}

/** "ahmad@gmial.com" → "ahmad@gmail.com"; null when the domain looks deliberate. */
export function emailSuggestion(value: string): string | null {
  const v = value.trim().toLowerCase();
  const at = v.lastIndexOf("@");
  if (at < 1) return null;
  const domain = v.slice(at + 1);
  if (!domain || PROVIDERS.includes(domain)) return null;
  const sld = domain.split(".")[0];
  const tld = domain.slice(sld.length + 1);
  let best: string | null = null;
  let bestScore = Infinity;
  for (const p of PROVIDERS) {
    const pSld = p.split(".")[0];
    // Same provider name with a wrong ending (gmail.co, gmail.con, hotmail.comm) …
    if (sld === pSld && tld !== p.slice(pSld.length + 1) && (TLD_TYPOS.has(tld) || tld.startsWith("com") || tld === "")) return v.slice(0, at + 1) + p;
    // … or a misspelt provider name (gmial, gmai, yahooo, hotmial, outlok).
    if (pSld.length >= 5 && sld.length >= 4 && (tld === p.slice(pSld.length + 1) || TLD_TYPOS.has(tld))) {
      const dist = editDistance(sld, pSld);
      if (dist > 0 && dist <= 2 && dist < bestScore) [best, bestScore] = [p, dist];
    }
  }
  return best ? v.slice(0, at + 1) + best : null;
}

export function emailError(value: string): string | null {
  const v = value.trim();
  if (!v) return "Please enter your email";
  if (/\s/.test(v)) return "Email can't contain spaces";
  const at = v.split("@").length - 1;
  if (at === 0) return "Email needs an @, like name@example.com";
  if (at > 1) return "Email can have only one @";
  const [local, domain] = v.split("@");
  if (!local) return "Add your name before the @";
  if (!domain) return "Add the domain after the @, like gmail.com";
  if (/[^a-z.-]/i.test(domain)) return "Use letters only after the @, like gmail.com";
  if (!domain.includes(".")) return "The domain needs an ending, like .com or .pk";
  if (v.length > 200 || local.length > 64 || !EMAIL_RE.test(v)) return "Enter a valid email, like name@example.com";
  const tld = domain.slice(domain.lastIndexOf(".") + 1).toLowerCase();
  const fix = emailSuggestion(v);
  if (fix) return `Did you mean ${fix}?`;
  if (tld.length !== 2 && !GENERIC_TLDS.has(tld)) return `".${tld}" isn't a real email ending — check it (e.g. .com, .pk)`;
  return null;
}

// Letters in any script (Urdu too) plus spaces, dots, apostrophes and hyphens;
// starts with a letter.
export const NAME_RE = /^\p{L}[\p{L}\p{M} .'-]*$/u;

export function nameError(value: string): string | null {
  const v = value.trim();
  if (!v) return "Please enter your name";
  if (v.length < 2) return "Name is too short";
  if (v.length > 120) return "Name is too long";
  if (!NAME_RE.test(v)) return "Use letters only (spaces, . ' - are fine)";
  return null;
}

// Phone / WhatsApp. Pakistani mobiles in any usual form — 03XX XXXXXXX,
// 92 3XX XXXXXXX or +92 3XX XXXXXXX — or any number with a "+" country code
// (E.164: 8–15 digits). Spaces and dashes are fine while typing.
export const PHONE_RE = /^\+[1-9]\d{7,14}$/;

/** Saved form: "0300 1234567" / "92 300-1234567" → "+923001234567"; others lose spaces / dashes. */
export function normalizePhone(value: string): string {
  const v = value.trim().replace(/[\s-]/g, "");
  if (/^03\d{9}$/.test(v)) return `+92${v.slice(1)}`;
  if (/^923\d{9}$/.test(v)) return `+${v}`;
  return v;
}

export function phoneError(value: string): string | null {
  const v = value.trim().replace(/[\s-]/g, "");
  if (!v) return "Please enter your phone / WhatsApp number";
  if (!/^\+?\d+$/.test(v)) return "Use numbers only (a + at the start is fine)";
  if (v.startsWith("0")) return /^03\d{9}$/.test(v) ? null : "Mobile numbers look like 03XX XXXXXXX (11 digits)";
  if (v.startsWith("+920")) return "Drop the 0 after +92, like +92 300 1234567";
  if (v.startsWith("92")) return /^923\d{9}$/.test(v) ? null : "Numbers with 92 look like 92 3XX XXXXXXX";
  if (v.startsWith("+92")) return /^\+923\d{9}$/.test(v) ? null : "Pakistani mobile numbers look like +92 3XX XXXXXXX";
  if (!v.startsWith("+")) return "Start with 03, 92 or your country code (like +44)";
  return PHONE_RE.test(v) ? null : "Enter a full number with country code, like +44 7911 123456";
}

/** The checklist shown under a new-password field. */
export function passwordRules(value: string) {
  return [
    { id: "length", label: `At least ${MIN_PASSWORD} characters`, ok: value.length >= MIN_PASSWORD },
    { id: "letter", label: "A letter", ok: /\p{L}/u.test(value) },
    { id: "number", label: "A number", ok: /\d/.test(value) },
  ];
}

export function newPasswordError(value: string): string | null {
  if (!value) return "Please choose a password";
  if (value.length > 200) return "Password is too long";
  const missing = passwordRules(value).find((r) => !r.ok);
  return missing ? `Password needs ${missing.label.toLowerCase()}` : null;
}

/** 0–4: drives the strength meter (rules met, plus a bonus for length / symbols). */
export function passwordStrength(value: string): number {
  if (!value) return 0;
  const met = passwordRules(value).filter((r) => r.ok).length;
  let score = met; // 0–3
  if (met === 3 && (value.length >= 12 || /[^\p{L}\d]/u.test(value))) score = 4;
  return score;
}
