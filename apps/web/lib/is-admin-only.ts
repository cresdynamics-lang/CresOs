/** Admin role without director, sales, finance, developer, or analyst — unified admin chrome. */
export function isAdminOnly(roleKeys: string[]): boolean {
  return (
    roleKeys.includes("admin") &&
    !roleKeys.includes("director_admin") &&
    !roleKeys.includes("sales") &&
    !roleKeys.includes("finance") &&
    !roleKeys.includes("developer") &&
    !roleKeys.includes("analyst")
  );
}
