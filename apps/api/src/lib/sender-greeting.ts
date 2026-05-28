/**
 * Resolve how to greet an email sender: sign-off → From display name/email.
 */

export type GreetingNameSource = "signoff" | "from_header";

export type ResolvedGreeting = {
  /** First name (or single name) to use in "Hi {greetingName}," */
  greetingName: string;
  /** Full resolved display name when available */
  fullName: string;
  source: GreetingNameSource;
};

const SIGNOFF_BLOCKLIST = new Set([
  "team",
  "support",
  "admin",
  "sales",
  "info",
  "noreply",
  "no-reply",
  "cres",
  "dynamics",
  "cres dynamics",
  "thanks",
  "thank",
  "regards",
  "sincerely",
  "faithfully",
  "best",
  "cheers",
  "sent",
  "from",
  "the",
]);

function titleCaseWord(w: string): string {
  if (!w) return w;
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

function titleCaseName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part.split("-").map(titleCaseWord).join("-"))
    .join(" ");
}

/** Validate and normalize a human name (not a role/team label). */
export function normalizePersonName(raw: string): string | null {
  let name = raw
    .trim()
    .replace(/^["'(<\[]+/, "")
    .replace(/["')>\]]+$/, "")
    .replace(/\s+/g, " ");

  // Strip trailing job titles after comma: "Jane Doe, CEO"
  if (name.includes(",")) {
    name = name.split(",")[0].trim();
  }

  if (name.length < 2 || name.length > 48) return null;
  if (!/^[\p{L}'.\-]+(?:\s+[\p{L}'.\-]+)*$/u.test(name)) return null;

  const words = name.split(/\s+/);
  if (words.length > 4) return null;

  for (const w of words) {
    if (w.length < 2) return null;
    if (SIGNOFF_BLOCKLIST.has(w.toLowerCase())) return null;
    if (/^\d/.test(w)) return null;
  }

  return titleCaseName(name);
}

export function firstNameForGreeting(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return trimmed;
  return trimmed.split(/\s+/)[0];
}

/**
 * 1) Name after sign-off lines (Regards, Yours faithfully, etc.) in the message body.
 */
export function extractNameFromSignoff(body: string): string | null {
  const main = (body.split("ATTACHMENTS RECEIVED:")[0] ?? body).trim();
  if (!main) return null;

  const tail = main.slice(-1200);

  const signoffPatterns = [
    /(?:^|\n)\s*(?:best\s+regards?|kind\s+regards?|warm\s+regards?|with\s+regards?|regards?|yours?\s+faithfully|yours?\s+sincerely|sincerely|thanks(?:\s+you)?|thank\s+you|many\s+thanks|cheers|respectfully|best),?\s*\n+\s*([^\n<]{2,48}?)\s*(?:\n|$)/i,
    /(?:^|\n)\s*(?:best\s+regards?|regards?),?\s+([A-Z][\p{L}'.\-]+(?:\s+[A-Z][\p{L}'.\-]+)?)\s*$/imu,
  ];

  for (const re of signoffPatterns) {
    const m = tail.match(re);
    if (m?.[1]) {
      const n = normalizePersonName(m[1]);
      if (n) return n;
    }
  }

  return null;
}

/**
 * Resolve greeting name: sign-off → From header display name.
 */
export function resolveSenderGreeting(params: {
  fromName: string;
  fromEmail: string;
  subject: string;
  body: string;
}): ResolvedGreeting {
  const fromSignoff = extractNameFromSignoff(params.body);
  if (fromSignoff) {
    return {
      greetingName: firstNameForGreeting(fromSignoff),
      fullName: fromSignoff,
      source: "signoff",
    };
  }

  const headerName = normalizePersonName(params.fromName);
  if (headerName) {
    return {
      greetingName: firstNameForGreeting(headerName),
      fullName: headerName,
      source: "from_header",
    };
  }

  // Last resort: local part of email only if it looks like a real name (not marikahelton123)
  const local = (params.fromEmail.split("@")[0] ?? "").replace(/[._+\-0-9]+/g, " ").trim();
  const localName = normalizePersonName(local);
  if (localName) {
    return {
      greetingName: firstNameForGreeting(localName),
      fullName: localName,
      source: "from_header",
    };
  }

  return {
    greetingName: "there",
    fullName: params.fromEmail || "Unknown",
    source: "from_header",
  };
}
