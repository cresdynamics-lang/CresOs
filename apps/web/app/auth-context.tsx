"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

type AuthState = {
  accessToken: string | null;
  roleKeys: string[];
  userId?: string;
};

type AuthContextValue = {
  auth: AuthState;
  setAuth: (next: AuthState) => void;
  apiFetch: (input: string, init?: RequestInit) => Promise<Response>;
  hydrated: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const API_BASE = typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL
  : "http://localhost:4000";

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
    window.localStorage.setItem("cresos_auth", JSON.stringify(next));
  };

  const apiFetch = async (input: string, init?: RequestInit) => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(init?.headers ? Object.fromEntries(new Headers(init.headers)) : {})
    };
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

