export type IntelligenceFocus = "projects" | "person" | "hours" | "services" | "general";

const FOCUS_VALUES = new Set<IntelligenceFocus>([
  "projects",
  "person",
  "hours",
  "services",
  "general"
]);

export function parseIntelligenceFocus(raw: unknown): IntelligenceFocus | undefined {
  if (typeof raw !== "string") return undefined;
  const v = raw.trim().toLowerCase() as IntelligenceFocus;
  return FOCUS_VALUES.has(v) ? v : undefined;
}

/** Auto-detect intelligence focus from the admin's question. */
export function detectIntelligenceFocus(
  message: string,
  explicit?: IntelligenceFocus
): IntelligenceFocus {
  if (explicit && FOCUS_VALUES.has(explicit)) return explicit;
  const q = message.toLowerCase();

  if (
    /\b(hours?\s+vs\s+days?|convert.*\b(days?)\b.*\bhours?\b|\bhours?\b.*\b(days?)\b|estimated\s*hours?|actual\s*hours?)\b/.test(
      q
    )
  ) {
    return "hours";
  }
  if (
    /\b(cres dynamics|cresos|service|pricing|tier|website|hosting|saas)\b/.test(q) ||
    /what can (we|you) (offer|do|build)/.test(q)
  ) {
    return "services";
  }
  if (
    /\b(how is|who is|person|people|team member|developer|wilson|salim|reporting)\b/.test(q) ||
    /\b\w+\s+(doing|performed|worked)\b/.test(q)
  ) {
    return "person";
  }
  if (
    /\b(project|risk|delivery|milestone|active|at.?risk|health|pipeline)\b/.test(q) ||
    /summarize all/.test(q)
  ) {
    return "projects";
  }
  return "general";
}

export function intelligenceFocusLabel(focus: IntelligenceFocus): string {
  switch (focus) {
    case "projects":
      return "Projects";
    case "person":
      return "People";
    case "hours":
      return "Hours vs days";
    case "services":
      return "Cres Dynamics fit";
    default:
      return "General";
  }
}

export function intelligenceSystemAddon(focus: IntelligenceFocus): string {
  switch (focus) {
    case "projects":
      return "FOCUS: Project rollup — per-project status, health score, risks, owners, open tasks, blockers. Flag at-risk and critical projects explicitly.";
    case "person":
      return "FOCUS: Person activity — report days in last 30, tasks assigned, estimated vs actual hours, current focus project. Include personInsights with reportDaysLast30 when known.";
    case "hours":
      return "FOCUS: Hours vs days — convert report language (days worked) to estimated deliverable hours using task estimates. Include hoursInsights with daysMentioned and estimatedHours.";
    case "services":
      return "FOCUS: Map client/project needs to Cres Dynamics services from website context. Recommend tiers or offerings with rationale.";
    default:
      return "FOCUS: General org intelligence across projects, people, and operations.";
  }
}
