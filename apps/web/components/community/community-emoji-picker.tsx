"use client";

import { useRef, useEffect, useState } from "react";

type EmojiCategory = {
  id: string;
  label: string;
  icon: string;
  emojis: string[];
};

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: "smileys",
    label: "Smileys",
    icon: "😀",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃", "😉", "😊", "😇", "🥰", "😍", "🤩",
      "😘", "😗", "😚", "😙", "🥲", "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔", "🤐",
      "🤨", "😐", "😑", "😶", "😏", "😒", "🙄", "😬", "😮‍💨", "🤥", "😌", "😔", "😪", "🤤", "😴", "😷",
      "🤒", "🤕", "🤢", "🤮", "🤧", "🥵", "🥶", "🥴", "😵", "🤯", "🤠", "🥳", "🥸", "😎", "🤓", "🧐"
    ]
  },
  {
    id: "gestures",
    label: "People",
    icon: "👋",
    emojis: [
      "👋", "🤚", "🖐", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆",
      "👇", "☝️", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "💪", "🦾",
      "👶", "👧", "🧒", "👦", "👩", "🧑", "👨", "👵", "🧓", "👴", "👮", "👷", "💂", "🕵", "👩‍💻", "👨‍💻"
    ]
  },
  {
    id: "nature",
    label: "Nature",
    icon: "🌿",
    emojis: [
      "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🐔",
      "🌸", "🌺", "🌻", "🌹", "🌷", "🌼", "🌱", "🌿", "🍀", "🍃", "🍂", "🍁", "🌳", "🌴", "🌵", "🌾",
      "☀️", "🌤", "⛅", "🌥", "☁️", "🌦", "🌧", "⛈", "🌩", "🌨", "❄️", "☃️", "🌈", "💧", "🌊", "🔥"
    ]
  },
  {
    id: "food",
    label: "Food",
    icon: "🍕",
    emojis: [
      "🍎", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🥑",
      "🍔", "🍟", "🍕", "🌭", "🥪", "🌮", "🌯", "🥗", "🍝", "🍜", "🍲", "🍛", "🍣", "🍱", "🥟", "🍤",
      "☕", "🍵", "🧃", "🥤", "🍺", "🍻", "🥂", "🍷", "🍾", "🧁", "🍰", "🎂", "🍪", "🍩", "🍫", "🍬"
    ]
  },
  {
    id: "activities",
    label: "Activities",
    icon: "⚽",
    emojis: [
      "⚽", "🏀", "🏈", "⚾", "🎾", "🏐", "🏉", "🎱", "🏓", "🏸", "🥅", "⛳", "🪁", "🏹", "🎣", "🤿",
      "🥊", "🥋", "🎽", "🛹", "🛼", "⛸", "🎿", "⛷", "🏂", "🪂", "🏋️", "🤸", "⛹️", "🤾", "🏌️", "🏇",
      "🎯", "🎮", "🕹", "🎲", "🧩", "♟", "🎭", "🎨", "🎬", "🎤", "🎧", "🎼", "🎹", "🥁", "🎷", "🎸"
    ]
  },
  {
    id: "travel",
    label: "Travel",
    icon: "✈️",
    emojis: [
      "🚗", "🚕", "🚙", "🚌", "🚎", "🏎", "🚓", "🚑", "🚒", "🚐", "🛻", "🚚", "🚛", "🚜", "🏍", "🛵",
      "🚲", "🛴", "🚂", "🚆", "🚇", "🚊", "🚉", "✈️", "🛫", "🛬", "🚀", "🛸", "🚁", "⛵", "🚤", "🛳",
      "🏠", "🏡", "🏢", "🏬", "🏭", "🏗", "🏛", "⛪", "🕌", "🕍", "⛩", "🗼", "🗽", "⛲", "🏰", "🌁"
    ]
  },
  {
    id: "objects",
    label: "Objects",
    icon: "💡",
    emojis: [
      "⌚", "📱", "💻", "⌨️", "🖥", "🖨", "🖱", "💾", "💿", "📷", "📹", "🎥", "📞", "☎️", "📺", "📻",
      "⏰", "⌛", "⏳", "🔋", "🔌", "💡", "🔦", "🕯", "🧯", "💰", "💳", "💎", "⚖️", "🔧", "🔨", "⚒",
      "📌", "📍", "✂️", "📝", "✏️", "📁", "📂", "📅", "📊", "📈", "📉", "📎", "🔗", "📧", "📩", "📨"
    ]
  },
  {
    id: "symbols",
    label: "Symbols",
    icon: "❤️",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖",
      "💘", "💝", "✨", "⭐", "🌟", "💫", "🔥", "💥", "💯", "✅", "❌", "⚠️", "❗", "❓", "💬", "👁‍🗨",
      "🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "⚫", "⚪", "🟤", "🔶", "🔷", "🔸", "🔹", "▶️", "⏸", "⏹"
    ]
  }
];

/** Sticker pack — sends as sticker message content (WhatsApp-style). */
export const COMMUNITY_STICKERS: { id: string; label: string; emoji: string }[] = [
  { id: "thumbs-up", label: "Nice!", emoji: "👍" },
  { id: "clap", label: "Clap", emoji: "👏" },
  { id: "fire", label: "On fire", emoji: "🔥" },
  { id: "rocket", label: "Ship it", emoji: "🚀" },
  { id: "100", label: "100", emoji: "💯" },
  { id: "check", label: "Done", emoji: "✅" },
  { id: "party", label: "Party", emoji: "🎉" },
  { id: "star", label: "Star", emoji: "⭐" },
  { id: "heart", label: "Love", emoji: "❤️" },
  { id: "muscle", label: "Strong", emoji: "💪" },
  { id: "eyes", label: "Looking", emoji: "👀" },
  { id: "think", label: "Thinking", emoji: "🤔" },
  { id: "wave", label: "Hello", emoji: "👋" },
  { id: "pray", label: "Thanks", emoji: "🙏" },
  { id: "coffee", label: "Coffee", emoji: "☕" },
  { id: "laptop", label: "Work", emoji: "💻" },
  { id: "bug", label: "Bug", emoji: "🐛" },
  { id: "tools", label: "Fix", emoji: "🛠️" },
  { id: "chart", label: "Growth", emoji: "📈" },
  { id: "target", label: "Goal", emoji: "🎯" },
  { id: "bell", label: "Alert", emoji: "🔔" },
  { id: "lock", label: "Secure", emoji: "🔒" },
  { id: "sparkle", label: "New", emoji: "✨" },
  { id: "sun", label: "Bright", emoji: "☀️" }
];

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (emoji: string) => void;
  onPickSticker?: (sticker: { id: string; emoji: string; label: string }) => void;
  className?: string;
};

export function CommunityEmojiPicker({ open, onClose, onPick, onPickSticker, className = "" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<"emoji" | "stickers">("emoji");
  const [categoryId, setCategoryId] = useState(EMOJI_CATEGORIES[0]?.id ?? "smileys");

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, onClose]);

  if (!open) return null;

  const activeCategory = EMOJI_CATEGORIES.find((c) => c.id === categoryId) ?? EMOJI_CATEGORIES[0];

  return (
    <div
      ref={ref}
      className={`flex w-72 flex-col overflow-hidden rounded-xl border border-[#2A3942] bg-[#111B21] shadow-2xl sm:w-80 ${className}`}
      role="listbox"
    >
      <div className="flex border-b border-[#2A3942]">
        <button
          type="button"
          className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wide ${
            tab === "emoji" ? "bg-[#202C33] text-[#25D366]" : "text-[#8696A0] hover:bg-[#202C33]/60"
          }`}
          onClick={() => setTab("emoji")}
        >
          Emoji
        </button>
        <button
          type="button"
          className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wide ${
            tab === "stickers" ? "bg-[#202C33] text-[#25D366]" : "text-[#8696A0] hover:bg-[#202C33]/60"
          }`}
          onClick={() => setTab("stickers")}
        >
          Stickers
        </button>
      </div>

      {tab === "emoji" ? (
        <>
          <div className="flex gap-0.5 overflow-x-auto border-b border-[#2A3942] px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {EMOJI_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                title={cat.label}
                className={`shrink-0 rounded-lg px-2 py-1 text-lg ${
                  categoryId === cat.id ? "bg-[#2A3942]" : "hover:bg-[#202C33]"
                }`}
                onClick={() => setCategoryId(cat.id)}
              >
                {cat.icon}
              </button>
            ))}
          </div>
          <div className="grid max-h-52 grid-cols-8 gap-0.5 overflow-y-auto p-2">
            {activeCategory?.emojis.map((e) => (
              <button
                key={`${categoryId}-${e}`}
                type="button"
                className="rounded-lg p-1.5 text-xl hover:bg-[#2A3942]"
                onClick={() => {
                  onPick(e);
                  onClose();
                }}
              >
                {e}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="grid max-h-52 grid-cols-4 gap-2 overflow-y-auto p-3">
          {COMMUNITY_STICKERS.map((s) => (
            <button
              key={s.id}
              type="button"
              title={s.label}
              className="flex flex-col items-center gap-1 rounded-xl border border-[#2A3942] bg-[#202C33] p-2 hover:border-[#25D366]/40 hover:bg-[#2A3942]"
              onClick={() => {
                if (onPickSticker) {
                  onPickSticker(s);
                } else {
                  onPick(s.emoji);
                }
                onClose();
              }}
            >
              <span className="text-3xl leading-none">{s.emoji}</span>
              <span className="max-w-full truncate text-[9px] text-[#8696A0]">{s.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** @deprecated use EMOJI_CATEGORIES */
export const CHAT_EMOJIS = EMOJI_CATEGORIES.flatMap((c) => c.emojis).slice(0, 30);
