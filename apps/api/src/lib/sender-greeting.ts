/**
 * Resolve how to greet an email sender: subject → sign-off → From display name.
 */

export type GreetingNameSource = "subject" | "signoff" | "from_header";

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

/** Strip Re:/Fwd: chains from subject. */
function cleanSubject(subject: string): string {
  let s = subject.trim();
  for (let i = 0; i < 8; i++) {
    const next = s.replace(/^\s*(?:re|fw|fwd)\s*:\s*/i, "").trim();
    if (next === s) break;
    s = next;
  }
  return s;
}

/**
 * 1) Name explicitly in subject (Hi/Dear Name, dash suffix, or From header name appearing in subject).
 */
export function extractNameFromSubject(subject: string, fromName: string): string | null {
  const sub = cleanSubject(subject);
  if (!sub) return null;

  const hiDear = sub.match(/\b(?:hi|hello|dear)\s+([A-Z][\p{L}'.\-]+(?:\s+[A-Z][\p{L}'.\-]+)?)/iu);
  if (hiDear?.[1]) {
    const n = normalizePersonName(hiDear[1]);
    if (n) return n;
  }

  const fromLine = sub.match(/\bfrom\s+([A-Z][\p{L}'.\-]+(?:\s+[A-Z][\p{L}'.\-]+)?)/iu);
  if (fromLine?.[1]) {
    const n = normalizePersonName(fromLine[1]);
    if (n) return n;
  }

  const headerName = normalizePersonName(fromName);
  if (headerName) {
    const subLower = sub.toLowerCase();
    const fullLower = headerName.toLowerCase();
    if (subLower.includes(fullLower)) return headerName;

    const parts = headerName.split(/\s+/).filter((p) => p.length >= 3);
    for (const part of parts) {
      const re = new RegExp(`\\b${part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (re.test(sub)) return headerName;
    }
  }

  const dashSuffix = sub.match(/(?:^|[\s—–\-|])\s*([A-Z][\p{L}'.\-]{1,24}(?:\s+[A-Z][\p{L}'.\-]{1,24})?)\s*$/u);
  if (dashSuffix?.[1]) {
    const n = normalizePersonName(dashSuffix[1]);
    if (n && !/^(search|growth|update|invoice|payment|meeting|project)$/i.test(n.split(/\s+/)[0])) {
      return n;
    }
  }

  return null;
}

/**
 * 2) Name after sign-off lines (Regards, Yours faithfully, etc.) in the message body.
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
 * Resolve greeting name: subject → sign-off → From header display name.
 */
export function resolveSenderGreeting(params: {
  fromName: string;
  fromEmail: string;
  subject: string;
  body: string;
}): ResolvedGreeting {
  const fromSubject = extractNameFromSubject(params.subject, params.fromName);
  if (fromSubject) {
    return {
      greetingName: firstNameForGreeting(fromSubject),
      fullName: fromSubject,
      source: "subject",
    };
  }

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
