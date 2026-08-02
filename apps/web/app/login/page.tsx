"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-context";
import { resolveHomeRouteForUser } from "../../lib/resolve-home-route";

function apiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/+$/, "");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const fieldClass =
  "w-full rounded-xl border border-[#D8DEE8] bg-[#F8FAFC] px-3.5 py-3 text-sm text-[#0B1F3A] placeholder:text-[#8B93A1] outline-none transition focus:border-[#0B1F3A]/45 focus:bg-white focus:ring-2 focus:ring-[#0B1F3A]/12";

/** Compact black capsule login action (not a full-width bar). */
const loginPillClass =
  "inline-flex items-center justify-center rounded-full bg-black px-8 py-2.5 text-sm font-semibold text-white transition hover:bg-[#111] disabled:pointer-events-none disabled:opacity-50";

const dialogBtnClass =
  "inline-flex w-full items-center justify-center rounded-full bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#111]";

export default function LoginPage() {
  const { setAuth } = useAuth();
  const router = useRouter();
  const passwordRef = useRef<HTMLInputElement>(null);
  const checkSeq = useRef(0);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailKnown, setEmailKnown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disabledPopup, setDisabledPopup] = useState(false);
  const [pendingPopup, setPendingPopup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);

  // Debounced lookup: show password field only when email exists and can log in.
  const verifyEmail = async (rawEmail: string, seq: number) => {
    const trimmed = rawEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) {
      setEmailKnown(false);
      setCheckingEmail(false);
      return;
    }
    setCheckingEmail(true);
    try {
      const res = await fetch(`${apiBase()}/auth/check-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed })
      });
      if (seq !== checkSeq.current) return;

      const body = (await res.json().catch(() => ({}))) as {
        exists?: boolean;
        canLogin?: boolean;
        code?: string;
        error?: string;
      };

      if (!res.ok) {
        setEmailKnown(false);
        setError(
          body.error === "Could not verify email"
            ? "Can't verify email — API can't reach the database. Start Docker Postgres (port 5435) and try again."
            : body.error ?? "Can't verify email. Try again."
        );
        return;
      }

      if (body.code === "ACCOUNT_PENDING") {
        setEmailKnown(false);
        setError(null);
        setPendingPopup(true);
        return;
      }
      if (body.code === "ACCOUNT_DISABLED") {
        setEmailKnown(false);
        setError(null);
        setDisabledPopup(true);
        return;
      }

      setPendingPopup(false);
      setDisabledPopup(false);
      setError(null);
      setEmailKnown(Boolean(body.exists && body.canLogin));
    } catch {
      if (seq !== checkSeq.current) return;
      setEmailKnown(false);
      setError("Can't reach the API. Start it: cd apps/api && npm run dev");
    } finally {
      if (seq === checkSeq.current) setCheckingEmail(false);
    }
  };

  useEffect(() => {
    const trimmed = email.trim().toLowerCase();
    setPassword("");

    if (!EMAIL_RE.test(trimmed)) {
      setEmailKnown(false);
      setDisabledPopup(false);
      setPendingPopup(false);
      setCheckingEmail(false);
      setError((prev) =>
        prev?.startsWith("Can't verify") || prev?.startsWith("Can't reach") ? null : prev
      );
      return;
    }

    const seq = ++checkSeq.current;
    const timer = window.setTimeout(() => {
      void verifyEmail(trimmed, seq);
    }, 350);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- verify on email only
  }, [email]);

  useEffect(() => {
    if (emailKnown) {
      passwordRef.current?.focus();
    }
  }, [emailKnown]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    // Enter on email: re-check immediately if password step not ready yet.
    if (!emailKnown) {
      const seq = ++checkSeq.current;
      await verifyEmail(email, seq);
      return;
    }
    if (!password.trim()) return;

    setLoading(true);
    setError(null);
    setDisabledPopup(false);
    setPendingPopup(false);
    try {
      const res = await fetch(`${apiBase()}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password })
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          hint?: string;
          message?: string;
          code?: string;
        };
        if (body.code === "ACCOUNT_PENDING") {
          setPendingPopup(true);
          setLoading(false);
          return;
        }
        if (body.code === "ACCOUNT_DISABLED") {
          setDisabledPopup(true);
          setLoading(false);
          return;
        }
        const parts = [body.error ?? body.message, body.hint].filter(Boolean);
        setError(parts.length ? parts.join(" — ") : "Login failed");
        setLoading(false);
        return;
      }
      const data = await res.json();
      const roleKeys = data.roleKeys ?? [];
      const org = data.org as { id: string; name: string | null; slug: string | null } | undefined;
      setAuth({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken ?? null,
        roleKeys,
        userId: data.user?.id,
        userEmail: data.user?.email,
        userName: data.user?.name ?? null,
        orgId: data.orgId ?? org?.id,
        orgName: org?.name ?? null,
        orgSlug: org?.slug ?? null
      });
      const isClientOnly =
        roleKeys.includes("client") &&
        !roleKeys.some((r: string) =>
          ["admin", "director_admin", "finance", "sales", "developer", "analyst"].includes(r)
        );
      const isDeveloperOnly =
        roleKeys.includes("developer") &&
        !roleKeys.some((r: string) =>
          ["admin", "director_admin", "finance", "sales", "analyst"].includes(r)
        );
      router.push(
        isClientOnly ? "/client" : isDeveloperOnly ? "/developer" : resolveHomeRouteForUser(roleKeys)
      );
    } catch (err) {
      const msg =
        err instanceof TypeError && err.message === "Failed to fetch"
          ? "Can't reach the API. Start it: cd apps/api && npm run dev"
          : "Network error. Start the API: cd apps/api && npm run dev";
      setError(msg);
      setLoading(false);
    }
  };

  const showLoginButton = emailKnown && password.length > 0;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#E8EEF4] px-4 py-8 text-[#0B1F3A] sm:px-6">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_10%_0%,rgba(11,31,58,0.12),transparent_55%),radial-gradient(ellipse_55%_45%_at_95%_90%,rgba(45,90,90,0.1),transparent_50%)]" />
      </div>

      <div className="relative z-[1] grid w-full max-w-5xl overflow-hidden rounded-[1.75rem] border border-white/70 bg-white shadow-[0_24px_80px_rgba(11,31,58,0.14)] lg:grid-cols-2">
        <aside className="relative hidden min-h-[520px] overflow-hidden lg:block">
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(145deg, #071528 0%, #0B1F3A 42%, #123B52 72%, #1A4E56 100%)"
            }}
          />
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.18) 0, transparent 28%), radial-gradient(circle at 80% 20%, rgba(120,180,200,0.2) 0, transparent 32%), radial-gradient(circle at 60% 80%, rgba(255,255,255,0.08) 0, transparent 35%)"
            }}
            aria-hidden
          />
          <div
            className="absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.35) 1px, transparent 1px)",
              backgroundSize: "42px 42px"
            }}
            aria-hidden
          />

          <div className="relative flex h-full flex-col justify-between p-10 text-white">
            <Link href="/" className="inline-flex items-center gap-2.5 text-sm font-semibold text-white/95">
              <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-white/25 bg-white/10 backdrop-blur-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/LOGO.jpg" width={36} height={36} alt="" className="h-8 w-8 rounded-lg object-cover" />
              </span>
              CresOS
            </Link>

            <div className="mx-auto max-w-sm rounded-2xl border border-white/20 bg-white/10 p-7 shadow-[0_16px_48px_rgba(0,0,0,0.2)] backdrop-blur-xl">
              <p className="inline-flex rounded-md border border-white/35 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/90">
                Cres Dynamics
              </p>
              <h2 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight">
                Run your workspace with clarity
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-white/80">
                Projects, finance, clients, and teams — one place to sign in and get to work.
              </p>
            </div>

            <p className="text-xs text-white/55">Built for Cres Dynamics teams and clients.</p>
          </div>
        </aside>

        <section className="flex flex-col justify-center px-6 py-10 sm:px-10 sm:py-12">
          <div className="mb-8 lg:hidden">
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#0B1F3A]">
              <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-[#E5E9EF] bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/LOGO.jpg" width={32} height={32} alt="" className="h-7 w-7 rounded-lg" />
              </span>
              CresOS
            </Link>
          </div>

          <div className="mx-auto w-full max-w-[360px]">
            <h1 className="text-center font-display text-3xl font-bold tracking-tight text-[#0B1F3A]">
              Log in
            </h1>
            <p className="mt-2 text-center text-sm text-[#5B6472]">
              {emailKnown
                ? "Enter your password to continue."
                : checkingEmail
                  ? "Checking email…"
                  : "Enter your work email."}
            </p>

            <form onSubmit={handleLogin} className="mt-8 flex flex-col gap-4">
              <label className="block text-sm">
                <span className="mb-1.5 block text-sm font-medium text-[#0B1F3A]">Email Address</span>
                <input
                  type="email"
                  className={fieldClass}
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  autoFocus
                />
              </label>

              <div
                className={`grid transition-all duration-300 ease-out ${
                  emailKnown
                    ? "grid-rows-[1fr] opacity-100"
                    : "pointer-events-none grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden">
                  <label className="block pt-1 text-sm">
                    <span className="mb-1.5 block text-sm font-medium text-[#0B1F3A]">Password</span>
                    <input
                      ref={passwordRef}
                      type="password"
                      className={fieldClass}
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      tabIndex={emailKnown ? 0 : -1}
                    />
                  </label>
                </div>
              </div>

              {error && (
                <p
                  className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3 py-2.5 text-sm text-[#C62828]"
                  role="alert"
                >
                  {error}
                </p>
              )}

              {showLoginButton && (
                <div className="flex justify-center pt-1">
                  <button type="submit" disabled={loading} className={loginPillClass}>
                    {loading ? "Signing in…" : "Log in"}
                  </button>
                </div>
              )}
            </form>

            <p className="mt-8 text-center text-sm text-[#5B6472]">
              Don&apos;t have an account?{" "}
              <Link
                href="/register"
                className="font-semibold text-[#0B1F3A] underline-offset-2 transition hover:underline"
              >
                Sign up
              </Link>
            </p>

            <p className="mt-6 text-center text-[11px] text-[#8B93A1]">
              Built by{" "}
              <a
                href="https://cresdynamics.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[#0B1F3A] underline-offset-2 hover:underline"
              >
                Cres Dynamics
              </a>
            </p>
          </div>
        </section>
      </div>

      {pendingPopup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1F3A]/45 px-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="account-pending-title"
          onClick={() => setPendingPopup(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-[#E5E9EF] bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="account-pending-title" className="font-display text-lg font-bold text-[#0B1F3A]">
              Awaiting approval
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#5B6472]">
              Your account is awaiting admin approval. You will receive an email when it is approved.
            </p>
            <button type="button" className={`${dialogBtnClass} mt-5`} onClick={() => setPendingPopup(false)}>
              OK
            </button>
          </div>
        </div>
      )}

      {disabledPopup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1F3A]/45 px-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="account-disabled-title"
          onClick={() => setDisabledPopup(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-[#E5E9EF] bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="account-disabled-title" className="font-display text-lg font-bold text-[#0B1F3A]">
              Account disabled
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#5B6472]">
              Your account has been disabled. You will be notified when it is active again.
            </p>
            <button type="button" className={`${dialogBtnClass} mt-5`} onClick={() => setDisabledPopup(false)}>
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
