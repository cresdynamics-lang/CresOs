/** Unread counts for sidebar badges and alerts — direct messages only, not project channels. */
export type CommunityConversationUnread = {
  type?: string | null;
  unreadCount?: number | null;
};

export function sumDirectMessageUnread(conversations: CommunityConversationUnread[]): number {
  return conversations.reduce((sum, c) => {
    if (c.type !== "direct") return sum;
    const n = c.unreadCount;
    return sum + (typeof n === "number" && Number.isFinite(n) ? n : 0);
  }, 0);
}
