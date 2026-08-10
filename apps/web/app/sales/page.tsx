"use client";

import { useEffect } from "react";
import { useAuth } from "../auth-context";
import { goSsoUrl, salesGoBaseUrl } from "../../lib/go-workspace";

/** Sales workspace moved to Go (sales-go). This route only hands off via SSO. */
export default function SalesPage() {
  const { auth, hydrated } = useAuth();

  useEffect(() => {
    if (!hydrated) return;
    if (!auth.accessToken) {
      window.location.replace("/login");
      return;
    }
    window.location.replace(goSsoUrl(salesGoBaseUrl(), auth.accessToken));
  }, [hydrated, auth.accessToken]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#E8EEF4] text-sm text-[#5B6472]">
      Opening CresOS Sales…
    </div>
  );
}
