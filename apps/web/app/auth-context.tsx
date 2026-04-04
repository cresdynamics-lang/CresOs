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
  /** Used to obtain a new access token when it expires (7d). */
  refreshToken?: string | null;
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

function normalizeApiBase(raw: string | undefined): string {
  const fallback = "http://localhost:4000";
  const s = (raw ?? fallback).trim();
  if (!s) return fallback;
  return s.replace(/\/+$/, "");
}

const API_BASE = normalizeApiBase(
  typeof process !== "undefined" ? process.env.NEXT_PUBLIC_API_URL : undefined
);

function joinApiPath(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${p}`;
}

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

  const refreshInFlight = useRef<Promise<string | null> | null>(null);

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    const rt = auth.refreshToken;
    if (!rt) return null;
    if (refreshInFlight.current) {
      return refreshInFlight.current;
    }
    const p = (async () => {
      try {
        const res = await fetch(joinApiPath("/auth/refresh"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: rt })
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { accessToken?: string };
        if (!data.accessToken) return null;
        patchAuth({ accessToken: data.accessToken });
        return data.accessToken;
      } catch {
        return null;
      }
    })();
    refreshInFlight.current = p.finally(() => {
      refreshInFlight.current = null;
    });
    return refreshInFlight.current;
  }, [auth.refreshToken, patchAuth]);

  const clearAuthAndRedirectToLogin = useCallback(() => {
    const empty: AuthState = {
      accessToken: null,
      refreshToken: null,
      roleKeys: [],
      userId: undefined,
      userEmail: undefined,
      userName: undefined,
      orgId: undefined,
      orgName: undefined,
      orgSlug: undefined
    };
    setAuthState(empty);
    persistAuth(empty);
    window.location.assign("/login");
  }, []);

  const apiFetch = useCallback(
    async (input: string, init?: RequestInit) => {
      const buildHeaders = (accessToken: string | null) => {
        const headers: Record<string, string> = init?.headers
          ? Object.fromEntries(new Headers(init.headers))
          : {};
        const hasBody = init?.body != null && init.body !== "";
        const isFormData =
          typeof FormData !== "undefined" && init?.body instanceof FormData;
        if (
          hasBody &&
          !isFormData &&
          !Object.keys(headers).some((k) => k.toLowerCase() === "content-type")
        ) {
          headers["Content-Type"] = "application/json";
        }
        if (accessToken) {
          headers["Authorization"] = `Bearer ${accessToken}`;
        }
        return headers;
      };

      const run = async (
        accessToken: string | null,
        alreadyRetried: boolean
      ): Promise<Response> => {
        const url = joinApiPath(input);
        try {
          const res = await fetch(url, {
            ...init,
            headers: buildHeaders(accessToken)
          });
          if (res.status === 401 && auth.refreshToken && !alreadyRetried) {
            const newToken = await refreshAccessToken();
            if (newToken) {
              return run(newToken, true);
            }
            clearAuthAndRedirectToLogin();
            return res;
          }
          if (res.status === 401 && !auth.refreshToken && accessToken) {
            clearAuthAndRedirectToLogin();
          }
          return res;
        } catch (e) {
          const reason = e instanceof Error ? e.message : String(e);
          throw new Error(
            `Could not reach API at ${API_BASE} (${reason}). ` +
              `Start the API server or set NEXT_PUBLIC_API_URL in apps/web/.env.local. ` +
              `On HTTPS sites the API URL must also use HTTPS (or a same-origin proxy).`
          );
        }
      };

      return run(auth.accessToken, false);
    },
    [auth.accessToken, auth.refreshToken, refreshAccessToken, clearAuthAndRedirectToLogin]
  );

  const profileBootstrapDone = useRef(false);

  useEffect(() => {
    if (!auth.accessToken) profileBootstrapDone.current = false;
  }, [auth.accessToken]);

  /** Load org + name, and always sync `userId` from the API when missing (needed for Community / participant matching). */
  useEffect(() => {
    if (!hydrated || !auth.accessToken) return;
    if (profileBootstrapDone.current) return;
    if (auth.orgName && auth.userId) {
      profileBootstrapDone.current = true;
      return;
    }
    profileBootstrapDone.current = true;
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch("/account/me");
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          id?: string;
          name?: string | null;
          email?: string;
          org?: { id: string; name: string | null; slug: string | null };
        };
        if (cancelled) return;
        patchAuth({
          ...(data.id && { userId: data.id }),
          userName: data.name ?? undefined,
          userEmail: data.email,
          orgId: data.org?.id,
          orgName: data.org?.name ?? null,
          orgSlug: data.org?.slug ?? null
        });
      } catch {
        /* offline / API down — avoid noisy console; user can still use app with cached auth */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, auth.accessToken, auth.orgName, auth.userId, patchAuth, apiFetch]);

  const value = useMemo(
    () => ({
      auth,
      setAuth,
      patchAuth,
      apiFetch,
      hydrated
    }),
    [auth, hydrated, apiFetch]
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
