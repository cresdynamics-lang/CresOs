import fs from "fs";
import path from "path";
import crypto from "crypto";

/**
 * Persist binary under `uploads/chat/{orgId}/{conversationId}/` and return public URL path.
 */
export function saveChatUpload(orgId: string, conversationId: string, originalname: string, buffer: Buffer): string {
  const dir = path.join(process.cwd(), "uploads", "chat", orgId, conversationId);
  fs.mkdirSync(dir, { recursive: true });
  const ext = path.extname(originalname) || "";
  const base = path.basename(originalname, ext).replace(/[^\w.-]+/g, "_").slice(0, 80);
  const file = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}-${base || "file"}${ext}`;
  fs.writeFileSync(path.join(dir, file), buffer);
  return `/uploads/chat/${orgId}/${conversationId}/${file}`;
}

export function messageTypeFromMime(mime: string): "image" | "voice" | "video" | "file" {
  const m = mime.toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("audio/")) return "voice";
  if (m.startsWith("video/")) return "video";
  return "file";
}
