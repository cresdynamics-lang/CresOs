/** Client portal password: first name + finance project sequence (e.g. Charles13). */
export function extractClientFirstName(clientName: string): string {
  const trimmed = String(clientName ?? "").trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0] ?? "";
}

export function buildClientPortalPassword(firstName: string, projectSeq: number): string {
  return `${firstName}${projectSeq}`;
}

export function matchesClientPortalPassword(
  clientName: string,
  projectSeq: number,
  password: string
): boolean {
  const firstName = extractClientFirstName(clientName);
  if (!firstName || !Number.isFinite(projectSeq)) return false;
  return password === buildClientPortalPassword(firstName, projectSeq);
}
