"use client";

import { useEffect } from "react";
import { useAuth } from "../../auth-context";
import { goSsoUrl, salesGoBaseUrl } from "../../../lib/go-workspace";

export default function SalesMessagesRedirect() {
  const { auth, hydrated } = useAuth();
  useEffect(() => {
    if (!hydrated) return;
    if (!auth.accessToken) {
      window.location.replace("/login");
      return;
    }
    window.location.replace(goSsoUrl(salesGoBaseUrl(), auth.accessToken, "/messages"));
  }, [hydrated, auth.accessToken]);
  return <p className="p-8 text-sm text-neutral-500">Redirecting to Sales mail…</p>;
}
