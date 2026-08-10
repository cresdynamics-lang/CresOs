"use client";

import { useEffect } from "react";
import { useAuth } from "../../auth-context";
import { developerGoBaseUrl, goSsoUrl } from "../../../lib/go-workspace";

export default function DeveloperOnboardingRedirect() {
  const { auth, hydrated } = useAuth();
  useEffect(() => {
    if (!hydrated) return;
    if (!auth.accessToken) {
      window.location.replace("/login");
      return;
    }
    window.location.replace(goSsoUrl(developerGoBaseUrl(), auth.accessToken, "/"));
  }, [hydrated, auth.accessToken]);
  return <p className="p-8 text-sm text-neutral-500">Redirecting to Developer workspace…</p>;
}
