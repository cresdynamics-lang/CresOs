"use client";

import { useEffect } from "react";
import { useAuth } from "../auth-context";
import { developerGoBaseUrl, goSsoUrl } from "../../lib/go-workspace";

/** Developer workspace moved to Go (developer-go). This route only hands off via SSO. */
export default function DeveloperPage() {
  const { auth, hydrated } = useAuth();

  useEffect(() => {
    if (!hydrated) return;
    if (!auth.accessToken) {
      window.location.replace("/login");
      return;
    }
    window.location.replace(goSsoUrl(developerGoBaseUrl(), auth.accessToken));
  }, [hydrated, auth.accessToken]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#EBE6DC] text-sm text-[#5B6472]">
      Opening CresOS Developer…
    </div>
  );
}
