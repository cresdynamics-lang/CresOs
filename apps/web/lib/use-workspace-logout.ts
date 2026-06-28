"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "../app/auth-context";

export function useWorkspaceLogout() {
  const router = useRouter();
  const { setAuth } = useAuth();

  return () => {
    setAuth({
      accessToken: null,
      refreshToken: null,
      roleKeys: [],
      userId: undefined,
      userEmail: undefined,
      userName: undefined,
      orgId: undefined,
      orgName: undefined,
      orgSlug: undefined
    });
    router.replace("/login");
  };
}
