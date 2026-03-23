"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";

export type AuthState = {
  accessToken: string | null;
  roleKeys: string[];
  userId?: string;
  userEmail?: string;
  userName?: string | null;
  orgId?: string;
  orgName?: string | null;
  orgSlug?: string | null;
};

type AuthContextValue = {
  auth: AuthState;
  setAuth: (next: AuthState) => void;
  /** Merge profile fields (persists to localStorage). */
  patchAuth: (partial: Partial<AuthState>) => void;
  apiFetch: (input: string, init?: RequestInit) => Promise<Response>;
  hydrated: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const API_BASE =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL
    : "http://localhost:4000";

function persistAuth(state: AuthState) {
  window.localStorage.setItem("cresos_auth", JSON.stringify(state));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuthState] = useState<AuthState>({
    accessToken: null,
    roleKeys: [],
    userId: undefined
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("cresos_auth");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as AuthState;
        setAuthState(parsed);
      } catch {
        // ignore
      }
    }
    setHydrated(true);
  }, []);

  const setAuth = (next: AuthState) => {
    setAuthState(next);
    persistAuth(next);
  };

  const patchAuth = useCallback((partial: Partial<AuthState>) => {
    setAuthState((prev) => {
      const next = { ...prev, ...partial };
      persistAuth(next);
      return next;
    });
  }, []);

  const profileBootstrapDone = useRef(false);

  useEffect(() => {
    if (!auth.accessToken) profileBootstrapDone.current = false;
  }, [auth.accessToken]);

  /** Load org + name for sessions created before profile fields existed. */
  useEffect(() => {
    if (!hydrated || !auth.accessToken) return;
    if (profileBootstrapDone.current) return;
    if (auth.orgName) {
      profileBootstrapDone.current = true;
      return;
    }
    profileBootstrapDone.current = true;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${API_BASE}/account/me`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${auth.accessToken}`
          }
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          name?: string | null;
          email?: string;
          org?: { id: string; name: string | null; slug: string | null };
        };
        if (cancelled) return;
        patchAuth({
          userName: data.name ?? undefined,
          userEmail: data.email,
          orgId: data.org?.id,
          orgName: data.org?.name ?? null,
          orgSlug: data.org?.slug ?? null
        });
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, auth.accessToken, auth.orgName, patchAuth]);

  const apiFetch = async (input: string, init?: RequestInit) => {
    const headers: Record<string, string> = init?.headers
      ? Object.fromEntries(new Headers(init.headers))
      : {};
    if (!Object.keys(headers).some((k) => k.toLowerCase() === "content-type")) {
      headers["Content-Type"] = "application/json";
    }
    if (auth.accessToken) {
      headers["Authorization"] = `Bearer ${auth.accessToken}`;
    }
    const res = await fetch(API_BASE + input, {
      ...init,
      headers
    });
    return res;
  };

  const value = useMemo(
    () => ({
      auth,
      setAuth,
      patchAuth,
      apiFetch,
      hydrated
    }),
    [auth, hydrated]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
