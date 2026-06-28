"use client";

import { useRef, useState } from "react";
import { useAuth } from "../app/auth-context";
import { useSettingsTheme } from "./settings/settings-primitives";
import { profileAvatarUrl } from "../lib/profile-avatar-url";

type SettingsProfilePhotoProps = {
  /** Path from API, e.g. /uploads/... */
  picturePath?: string | null;
  displayName?: string;
  onPictureChange?: (path: string | null) => void;
  compact?: boolean;
  /** Full-width hero band layout for settings account page */
  hero?: boolean;
};

export function SettingsProfilePhoto({
  picturePath,
  displayName = "User",
  onPictureChange,
  compact = false,
  hero = false
}: SettingsProfilePhotoProps) {
  const { apiFetch, patchAuth, auth } = useAuth();
  const theme = useSettingsTheme();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [localPath, setLocalPath] = useState<string | null | undefined>(undefined);

  const path = localPath !== undefined ? localPath : picturePath ?? auth.profilePicture;
  const src = profileAvatarUrl(path);
  const initial = (displayName || auth.userName || auth.userEmail || "U").trim().charAt(0).toUpperCase();
  const size = hero
    ? "h-28 w-28 text-3xl sm:h-32 sm:w-32 sm:text-4xl"
    : compact
      ? "h-16 w-16 text-xl"
      : "h-24 w-24 text-3xl sm:h-28 sm:w-28";

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiFetch("/user/profile-picture", { method: "POST", body: fd });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert((data as { error?: string })?.error ?? "Failed to upload profile picture");
        return;
      }
      const next = (data as { data?: { profilePicture?: string } })?.data?.profilePicture;
      if (next) {
        setLocalPath(next);
        patchAuth({ profilePicture: next });
        onPictureChange?.(next);
      }
    } catch {
      alert("Failed to upload profile picture. Please try again.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  return (
    <div
      className={`flex items-center gap-5 ${hero ? "sm:gap-8" : compact ? "" : "sm:gap-6"}`}
    >
      <div
        className={`relative shrink-0 overflow-hidden rounded-full bg-slate-800 ring-2 ring-white/[0.08] shadow-[4px_4px_14px_rgba(0,0,0,0.45)] ${size} flex items-center justify-center font-display font-semibold text-slate-200`}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          <span>{initial}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`font-display font-semibold text-slate-100 ${
            hero ? "text-2xl sm:text-3xl" : "text-base sm:text-lg"
          }`}
        >
          {displayName}
        </p>
        <p className={`mt-1 text-slate-400 ${hero ? "text-sm sm:text-base" : "text-xs sm:text-sm"}`}>
          Shown in community and across the workspace.
        </p>
        <div className={`flex flex-wrap gap-2 ${hero ? "mt-4" : "mt-3"}`}>
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className={`${theme.btnPrimary} px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm`}
          >
            {uploading ? "Uploading…" : "Change photo"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleUpload}
          />
        </div>
      </div>
    </div>
  );
}
