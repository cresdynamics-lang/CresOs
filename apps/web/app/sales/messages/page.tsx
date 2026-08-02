"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../auth-context";
import { ComposeMessagesPage } from "../../../components/messages/compose-messages-page";

export default function SalesMessagesPage() {
  const router = useRouter();
  const { auth, hydrated } = useAuth();
  const allowed = auth.roleKeys.some((r) => ["admin", "sales"].includes(r));

  useEffect(() => {
    if (!hydrated || !auth.accessToken) return;
    if (!allowed) router.replace("/dashboard");
  }, [hydrated, auth.accessToken, allowed, router]);

  if (!hydrated || !auth.accessToken) {
    return (
      <div className="flex min-h-[8rem] items-center justify-center text-[13px] text-[#8A8886]">
        Loading mails…
      </div>
    );
  }
  if (!allowed) return null;

  return <ComposeMessagesPage channel="sales" />;
}
