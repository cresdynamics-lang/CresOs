"use client";

import { useRef, useEffect } from "react";

export const CHAT_EMOJIS = [
  "😀", "😂", "🥰", "😍", "😊", "😎", "🤔", "😢", "😡", "👍",
  "👎", "🙏", "👏", "🔥", "❤️", "💯", "✅", "❌", "🎉", "💪",
  "🚀", "⭐", "📌", "📞", "📹", "🎤", "💬", "🤝", "👋", "✋"
];

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (emoji: string) => void;
  className?: string;
};

export function CommunityEmojiPicker({ open, onClose, onPick, className = "" }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className={`grid max-h-40 grid-cols-8 gap-0.5 overflow-y-auto rounded-xl border border-slate-700/60 bg-slate-900 p-2 shadow-xl ${className}`}
      role="listbox"
    >
      {CHAT_EMOJIS.map((e) => (
        <button
          key={e}
          type="button"
          className="rounded-lg p-1.5 text-xl hover:bg-slate-800"
          onClick={() => {
            onPick(e);
            onClose();
          }}
        >
          {e}
        </button>
      ))}
    </div>
  );
}
