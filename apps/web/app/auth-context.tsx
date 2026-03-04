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
};

type AuthContextValue = {
  auth: AuthState;
  setAuth: (next: AuthState) => void;
  apiFetch: (input: string, init?: RequestInit) => Promise<Response>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuthState] = useState<AuthState>({
    accessToken: null,
    roleKeys: []
  });

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
  }, []);

  const setAuth = (next: AuthState) => {
    setAuthState(next);
    window.localStorage.setItem("cresos_auth", JSON.stringify(next));
  };

  const apiFetch = async (input: string, init?: RequestInit) => {
    const headers: HeadersInit = {
      ...(init?.headers || {}),
      "Content-Type": "application/json"
    };
    if (auth.accessToken) {
      headers.Authorization = `Bearer ${auth.accessToken}`;
    }
    const res = await fetch(
      process.env.NEXT_PUBLIC_API_URL + input,
      {
        ...init,
        headers
      }
    );
    return res;
  };

  const value = useMemo(
    () => ({
      auth,
      setAuth,
      apiFetch
    }),
    [auth]
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

