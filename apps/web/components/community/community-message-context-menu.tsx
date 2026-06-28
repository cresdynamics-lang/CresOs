"use client";

import type { Message } from "./community-types";

export type MessageMenuAction =
  | "reply"
  | "forward"
  | "copy"
  | "edit"
  | "star"
  | "save"
  | "info"
  | "delete-self"
  | "delete-everyone"
  | "react";

type CommunityMessageContextMenuProps = {
  message: Message;
  isMine: boolean;
  position: { x: number; y: number } | null;
  isDesktop: boolean;
  onAction: (action: MessageMenuAction, emoji?: string) => void;
  onClose: () => void;
  sheetBg: string;
};

const DESKTOP_ITEM =
  "flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[#E9EDEF] hover:bg-[#2A3942] whitespace-nowrap";
const SHEET_ITEM =
  "flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] text-[#E9EDEF] active:bg-[#2A3942]";

export function CommunityMessageContextMenu({
  message,
  isMine,
  position,
  isDesktop,
  onAction,
  onClose,
  sheetBg
}: CommunityMessageContextMenuProps) {
  if (message.type === "deleted" || message.revokedAt) return null;

  const canEdit = isMine && message.type === "text";
  const preview = message.content?.trim() || "(attachment)";

  const items: { id: MessageMenuAction; label: string; danger?: boolean; emoji?: string }[] = [
    { id: "reply", label: "Reply" },
    { id: "forward", label: "Forward" },
    { id: "copy", label: "Copy" },
    ...(canEdit ? [{ id: "edit" as const, label: "Edit" }] : []),
    { id: "star", label: message.flags?.starred ? "Unstar" : "Star" },
    { id: "save", label: message.flags?.saved ? "Unsave" : "Save" },
    { id: "info", label: "Message info" },
    { id: "delete-self", label: "Delete for me" },
    ...(isMine ? [{ id: "delete-everyone" as const, label: "Delete for everyone", danger: true }] : [])
  ];

  if (isDesktop && position) {
    const menuW = 200;
    const menuH = items.length * 36 + 8;
    const x = Math.min(position.x, typeof window !== "undefined" ? window.innerWidth - menuW - 8 : position.x);
    const y = Math.min(position.y, typeof window !== "undefined" ? window.innerHeight - menuH - 8 : position.y);

    return (
      <>
        <div className="fixed inset-0 z-[139]" onClick={onClose} aria-hidden />
        <div
          className="fixed z-[140] min-w-[11rem] overflow-hidden rounded-lg border border-[#2A3942] bg-[#233138] py-1 shadow-2xl"
          style={{ left: x, top: y }}
          role="menu"
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className={`${DESKTOP_ITEM} ${item.danger ? "text-rose-300" : ""}`}
              onClick={() => onAction(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[140] flex flex-col justify-end bg-black/55"
      role="dialog"
      aria-label="Message options"
      onClick={onClose}
    >
      <div
        className={`message-menu-sheet mx-auto w-full max-w-lg rounded-t-2xl shadow-2xl ${sheetBg}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto my-2 h-1 w-10 rounded-full bg-[#3d4f56]" />
        <div className="px-4 pb-2">
          <p className="text-[11px] uppercase tracking-wide text-[#8696A0]">Message</p>
          <p className="mt-1 line-clamp-2 text-sm text-[#E9EDEF]">{preview}</p>
        </div>
        <div className="border-t border-[#2A3942]/80">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`${SHEET_ITEM} ${item.danger ? "text-rose-300" : ""}`}
              onClick={() => onAction(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="mt-1 w-full border-t border-[#2A3942]/80 py-4 text-center text-[15px] font-medium text-[#53BDEB]"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function ForwardedLabel() {
  return (
    <p className="mb-1 flex items-center gap-1 text-[11px] font-medium italic text-[#53BDEB]/90">
      <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M13 5v2h6.59L12 14.59 6.41 9H13V7H4v10h2v-6.59l7.59 7.59 2-2L8.41 13H18v2h4V5h-9z" />
      </svg>
      Forwarded
    </p>
  );
}

export function isForwardedMessage(message: Message): boolean {
  const md = message.metadata;
  return Boolean(md && typeof md === "object" && (md as { forwarded?: boolean }).forwarded === true);
}

export function StickerBubble({ emoji, label }: { emoji: string; label?: string }) {
  return (
    <div className="flex flex-col items-center py-1">
      <span className="text-5xl leading-none drop-shadow-sm">{emoji}</span>
      {label ? <span className="mt-1 text-[10px] text-[#8696A0]">{label}</span> : null}
    </div>
  );
}
