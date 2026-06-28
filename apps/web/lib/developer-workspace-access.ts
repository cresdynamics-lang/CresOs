/** Anyone with the developer role can use the developer workspace (including admin+developer). */
export function canAccessDeveloperWorkspace(roleKeys: string[]): boolean {
  return roleKeys.includes("developer");
}
