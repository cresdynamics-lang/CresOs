/**
 * Go workspace handoff URLs.
 * Production nginx serves them under /w/sales and /w/developer on the same host.
 * Local defaults hit sales-go :4100 / developer-go :4200 directly.
 */
export function salesGoBaseUrl(): string {
  const u = (process.env.NEXT_PUBLIC_SALES_GO_URL ?? "").trim().replace(/\/+$/, "");
  if (u) return u;
  return "http://localhost:4100";
}

export function developerGoBaseUrl(): string {
  const u = (process.env.NEXT_PUBLIC_DEVELOPER_GO_URL ?? "").trim().replace(/\/+$/, "");
  if (u) return u;
  return "http://localhost:4200";
}

export function goSsoUrl(base: string, accessToken: string, nextPath = "/"): string {
  const root = base.replace(/\/+$/, "");
  const url = new URL(`${root}/sso`);
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
