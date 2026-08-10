/**
 * Go workspace handoff URLs.
 * Defaults point at local sales-go / developer-go; override via env in deploy.
 */
export function salesGoBaseUrl(): string {
  const u = (process.env.NEXT_PUBLIC_SALES_GO_URL ?? "http://localhost:4100").trim().replace(/\/+$/, "");
  return u;
}

export function developerGoBaseUrl(): string {
  const u = (process.env.NEXT_PUBLIC_DEVELOPER_GO_URL ?? "http://localhost:4200").trim().replace(/\/+$/, "");
  return u;
}

export function goSsoUrl(base: string, accessToken: string, nextPath = "/"): string {
  const url = new URL("/sso", base.endsWith("/") ? base : `${base}/`);
  url.searchParams.set("token", accessToken);
  if (nextPath && nextPath !== "/") {
    url.searchParams.set("next", nextPath);
  }
  return url.toString();
}

/** Absolute URL for window.location — always used for pure sales / developer. */
export function resolveExternalGoHome(
  roleKeys: string[],
  accessToken: string | null | undefined
): string | null {
  if (!accessToken) return null;

  const isDeveloperOnly =
    roleKeys.includes("developer") &&
    !roleKeys.some((r) => ["admin", "director_admin", "finance", "sales", "analyst"].includes(r));
  const isSalesOnly =
    roleKeys.includes("sales") &&
    !roleKeys.some((r) => ["admin", "director_admin", "finance", "analyst"].includes(r));

  if (isDeveloperOnly) {
    return goSsoUrl(developerGoBaseUrl(), accessToken);
  }
  if (isSalesOnly) {
    return goSsoUrl(salesGoBaseUrl(), accessToken);
  }
  return null;
}
