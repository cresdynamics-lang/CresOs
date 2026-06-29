"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { checkInGlass } from "./check-in-glass-theme";

type CheckInReplySlideProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
};

export function CheckInReplySlide({ open, title, subtitle, onClose, children }: CheckInReplySlideProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <>
      <button
        type="button"
        className={checkInGlass.slideBackdrop}
        aria-label="Close reply panel"
        onClick={onClose}
      />
      <div
        className={`${checkInGlass.slideShell} animate-in slide-in-from-bottom duration-300`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mx-auto mt-3 h-1 w-12 rounded-full bg-white/20" />
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold text-slate-50">{title}</p>
            {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
          </div>
          <button type="button" className={checkInGlass.btnGhost} onClick={onClose}>
            Close
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </>,
    document.body
  );
}
