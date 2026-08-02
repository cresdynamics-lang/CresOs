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
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../../app/auth-context";
import { resolveHomeRouteForUser } from "../../lib/resolve-home-route";

type NavHistoryContextValue = {
  canGoBack: boolean;
  goBack: (fallbackHref?: string) => void;
  homeHref: string;
};

const NavHistoryContext = createContext<NavHistoryContextValue | null>(null);

const MAX_STACK = 40;

function isAuthPublicPath(path: string): boolean {
  return path === "/login" || path === "/register" || path.startsWith("/login/") || path.startsWith("/register/");
}

/** Parent path fallback when browser history is empty (e.g. hard-open URL). */
export function parentPathFor(pathname: string, homeHref: string): string {
  const path = (pathname || "/").split("?")[0] || "/";
  if (path === "/" || path === homeHref) return homeHref;

  const segments = path.split("/").filter(Boolean);
  if (segments.length <= 1) {
    return homeHref;
  }
  return `/${segments.slice(0, -1).join("/")}`;
}

export function NavigationHistoryProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const { auth } = useAuth();
  const stackRef = useRef<string[]>([]);
  const [stackDepth, setStackDepth] = useState(0);
  const homeHref = useMemo(
    () => resolveHomeRouteForUser(auth.roleKeys ?? []),
    [auth.roleKeys]
  );

  useEffect(() => {
    if (isAuthPublicPath(pathname)) {
      stackRef.current = [];
      setStackDepth(0);
      return;
    }
    const stack = stackRef.current;
    const last = stack[stack.length - 1];
    if (last === pathname) return;
    stack.push(pathname);
    if (stack.length > MAX_STACK) stack.splice(0, stack.length - MAX_STACK);
    setStackDepth(stack.length);
  }, [pathname]);

  const canGoBack = stackDepth > 1 || pathname !== homeHref;

  const goBack = useCallback(
    (fallbackHref?: string) => {
      const stack = stackRef.current;
      if (stack[stack.length - 1] === pathname) {
        stack.pop();
      }
      const prev = stack.pop();
      setStackDepth(stack.length);
      if (prev && prev !== pathname) {
        router.push(prev);
        return;
      }
      const fallback = fallbackHref || parentPathFor(pathname, homeHref) || homeHref;
      router.push(fallback);
    },
    [homeHref, pathname, router]
  );

  const value = useMemo(
    () => ({
      canGoBack,
      goBack,
      homeHref
    }),
    [canGoBack, goBack, homeHref]
  );

  return <NavHistoryContext.Provider value={value}>{children}</NavHistoryContext.Provider>;
}

export function useNavigationHistory(): NavHistoryContextValue {
  const ctx = useContext(NavHistoryContext);
  const router = useRouter();
  const pathname = usePathname() || "/";
  const { auth } = useAuth();
  const homeHref = resolveHomeRouteForUser(auth.roleKeys ?? []);

  if (ctx) return ctx;

  return {
    canGoBack: true,
    homeHref,
    goBack: (fallbackHref?: string) => {
      if (typeof window !== "undefined" && window.history.length > 1) {
        router.back();
        return;
      }
      router.push(fallbackHref || parentPathFor(pathname, homeHref));
    }
  };
}
