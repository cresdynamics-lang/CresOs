/** Client role without internal workspace roles — unified client portal chrome. */
export function isClientOnly(roleKeys: string[]): boolean {
  return (
    roleKeys.includes("client") &&
    !roleKeys.includes("admin") &&
    !roleKeys.includes("director_admin") &&
    !roleKeys.includes("sales") &&
    !roleKeys.includes("finance") &&
    !roleKeys.includes("developer") &&
    !roleKeys.includes("analyst") &&
    !roleKeys.includes("hr")
  );
}
