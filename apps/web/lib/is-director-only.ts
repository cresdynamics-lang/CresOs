/** Director role without admin, sales, finance, developer, or analyst — unified director chrome. */
export function isDirectorOnly(roleKeys: string[]): boolean {
  return (
    roleKeys.includes("director_admin") &&
    !roleKeys.includes("admin") &&
    !roleKeys.includes("sales") &&
    !roleKeys.includes("finance") &&
    !roleKeys.includes("developer") &&
    !roleKeys.includes("analyst")
  );
}
