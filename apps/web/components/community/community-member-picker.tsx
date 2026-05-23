"use client";

import { useMemo, useState } from "react";
import type { OnlineUser } from "./community-types";
import { initialsFromLabel } from "./community-utils";

export type CommunityMemberPickerProps = {
  members: OnlineUser[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  myId?: string;
  minSelected?: number;
  label?: string;
  hint?: string;
};

export function CommunityMemberPicker({
  members,
  selectedIds,
  onChange,
  myId,
  minSelected = 1,
  label = "Members",
  hint
}: CommunityMemberPickerProps) {
  const [filter, setFilter] = useState("");
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = members.filter((m) => m.id !== myId);
    if (!q) return list;
    return list.filter((m) => {
      if (m.name.toLowerCase().includes(q)) return true;
      return m.roles?.some(
        (r) => r.name.toLowerCase().includes(q) || r.key.toLowerCase().includes(q)
      );
    });
  }, [members, filter, myId]);

  const toggle = (id: string) => {
    if (selectedSet.has(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const selectAllVisible = () => {
    const ids = new Set(selectedIds);
    for (const m of filtered) ids.add(m.id);
    onChange(Array.from(ids));
  };

  const clearAll = () => onChange(myId ? [myId] : []);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-slate-300">
          {label}{" "}
          <span className="text-slate-500">
            ({selectedIds.length} selected
            {minSelected > 0 ? ` · min ${minSelected}` : ""})
          </span>
        </label>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={selectAllVisible}
            className="rounded-md px-2 py-0.5 text-[10px] text-violet-300 hover:bg-slate-800"
          >
            All shown
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="rounded-md px-2 py-0.5 text-[10px] text-slate-400 hover:bg-slate-800"
          >
            Clear
          </button>
        </div>
      </div>
      <input
        type="search"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter by name or role…"
        className="mb-2 w-full rounded-lg border border-slate-700/60 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-violet-500/40 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
      />
      <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-700/50 bg-slate-950/50">
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-slate-500">No people match.</p>
        ) : (
          filtered.map((user) => {
            const checked = selectedSet.has(user.id);
            return (
              <label
                key={user.id}
                className={`flex cursor-pointer items-center gap-3 border-b border-slate-800/80 px-3 py-2 last:border-0 hover:bg-slate-800/40 ${
                  checked ? "bg-violet-950/30" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(user.id)}
                  className="h-4 w-4 rounded border-slate-600 text-violet-600 focus:ring-violet-500/40"
                />
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600/30 to-sky-600/20 text-xs font-semibold text-white">
                  {initialsFromLabel(user.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-slate-100">{user.name}</span>
                  {user.roles?.[0] && (
                    <span className="block truncate text-[10px] text-slate-500">{user.roles[0].name}</span>
                  )}
                </span>
              </label>
            );
          })
        )}
      </div>
      {hint ? <p className="mt-1.5 text-[11px] text-slate-500">{hint}</p> : null}
      {selectedIds.length < minSelected ? (
        <p className="mt-1 text-[11px] text-amber-400/90">Select at least {minSelected} member.</p>
      ) : null}
    </div>
  );
}
