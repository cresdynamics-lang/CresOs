"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../auth-context";
import { ComposeMessagesPage } from "../../../components/messages/compose-messages-page";

export default function DirectorMessagesPage() {
  const router = useRouter();
  const { auth, hydrated } = useAuth();
  const allowed = auth.roleKeys.some((r) => ["admin", "director_admin"].includes(r));

  useEffect(() => {
    if (!hydrated || !auth.accessToken) return;
    if (!allowed) router.replace("/dashboard");
  }, [hydrated, auth.accessToken, allowed, router]);

  if (!hydrated || !auth.accessToken) {
    return <div className="text-sm text-slate-400">Loading…</div>;
  }
  if (!allowed) return null;

  return <ComposeMessagesPage channel="director" />;
}
