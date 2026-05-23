"use client";

import { useRef, useState } from "react";
import { useAuth } from "../app/auth-context";
import { profileAvatarUrl } from "../lib/profile-avatar-url";

type SettingsProfilePhotoProps = {
  /** Path from API, e.g. /uploads/... */
  picturePath?: string | null;
  displayName?: string;
  onPictureChange?: (path: string | null) => void;
  compact?: boolean;
};

export function SettingsProfilePhoto({
  picturePath,
  displayName = "User",
  onPictureChange,
  compact = false
}: SettingsProfilePhotoProps) {
  const { apiFetch, patchAuth, auth } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [localPath, setLocalPath] = useState<string | null | undefined>(undefined);

  const path = localPath !== undefined ? localPath : picturePath ?? auth.profilePicture;
  const src = profileAvatarUrl(path);
  const initial = (displayName || auth.userName || auth.userEmail || "U").trim().charAt(0).toUpperCase();
  const size = compact ? "h-16 w-16 text-xl" : "h-24 w-24 text-3xl sm:h-28 sm:w-28";

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
    <div className={`flex items-center gap-4 ${compact ? "" : "sm:gap-6"}`}>
      <div
        className={`relative shrink-0 overflow-hidden rounded-full bg-slate-800 ring-2 ring-slate-700/80 ${size} flex items-center justify-center font-display font-semibold text-slate-200`}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          <span>{initial}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display text-base font-semibold text-slate-100 sm:text-lg">{displayName}</p>
        <p className="mt-0.5 text-xs text-slate-400 sm:text-sm">
          Shown in the sidebar, community, and across the workspace.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand/90 disabled:opacity-60 sm:px-4 sm:py-2 sm:text-sm"
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
