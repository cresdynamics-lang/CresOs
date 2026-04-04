/**
 * All product role keys. Community and shared shell items use this list.
 * Keep in sync with `ALL_APP_ROLE_KEYS` / `ROLE_KEYS` in apps/api auth-middleware.
 */
export const ALL_APP_ROLE_KEYS = [
  "admin",
  "director_admin",
  "finance",
  "developer",
  "sales",
  "analyst",
  "client"
] as const;

export type AppRoleKey = (typeof ALL_APP_ROLE_KEYS)[number];
