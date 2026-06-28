/** HR role without admin, director, sales, finance, developer, or analyst — dedicated HR workspace. */
export function isHrOnly(roleKeys: string[]): boolean {
  return (
    roleKeys.includes("hr") &&
    !roleKeys.includes("admin") &&
    !roleKeys.includes("director_admin") &&
    !roleKeys.includes("sales") &&
    !roleKeys.includes("finance") &&
    !roleKeys.includes("developer") &&
    !roleKeys.includes("analyst")
  );
}

export function canAccessHrWorkspace(roleKeys: string[]): boolean {
  return roleKeys.includes("hr") || roleKeys.includes("admin");
}
