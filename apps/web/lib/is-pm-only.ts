export function canAccessPmWorkspace(roleKeys: string[]): boolean {
  return roleKeys.includes("project_manager") || roleKeys.includes("admin") || roleKeys.includes("director_admin");
}

export function canAccessKnowledgePool(roleKeys: string[]): boolean {
  return canAccessPmWorkspace(roleKeys) || roleKeys.includes("sales");
}

export function isPmOnly(roleKeys: string[]): boolean {
  return (
    roleKeys.includes("project_manager") &&
    !roleKeys.some((r) =>
      ["admin", "director_admin", "finance", "sales", "developer", "analyst", "hr"].includes(r)
    )
  );
}
