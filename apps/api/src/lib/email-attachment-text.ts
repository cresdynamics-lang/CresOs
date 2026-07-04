import { extractDocxText, extractPdfText } from "./project-document-text";

export type EmailAttachmentSummary = {
  filename: string;
  contentType: string;
  size: number;
  text?: string;
  extractNote?: string;
};

const PER_ATTACHMENT_CHAR_LIMIT = 5_000;
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

function normalizeFilename(filename: string, contentType: string): string {
  const name = (filename || "unnamed").trim();
  if (name.includes(".")) return name.toLowerCase();
  if (contentType.includes("pdf")) return `${name}.pdf`;
  if (contentType.includes("wordprocessingml")) return `${name}.docx`;
  if (contentType.startsWith("text/")) return `${name}.txt`;
  return name.toLowerCase();
}

/** Extract readable text from an inbound email attachment for AI drafting. */
export async function extractEmailAttachmentText(
  buffer: Buffer,
  contentType: string,
  filename: string
): Promise<{ text: string; note?: string }> {
  if (!buffer?.length) {
    return { text: "", note: "empty file" };
  }
  if (buffer.length > MAX_ATTACHMENT_BYTES) {
    return { text: "", note: `file too large (${Math.round(buffer.length / 1024)}KB) — review manually` };
  }

  const mime = (contentType || "").toLowerCase();
  const name = normalizeFilename(filename, mime);

  try {
    if (mime.startsWith("text/") || mime === "application/json" || mime === "application/csv" || name.endsWith(".csv")) {
      return { text: buffer.toString("utf8").trim() };
    }

    if (mime.includes("pdf") || name.endsWith(".pdf")) {
      const text = await extractPdfText(buffer);
      if (!text.trim()) return { text: "", note: "PDF had no extractable text (may be scanned/image-only)" };
      return { text: text.trim() };
    }

    if (mime.includes("wordprocessingml") || name.endsWith(".docx")) {
      const text = await extractDocxText(buffer);
      if (!text.trim()) return { text: "", note: "Word document had no extractable text" };
      return { text: text.trim() };
    }

    if (name.endsWith(".txt") || name.endsWith(".md")) {
      return { text: buffer.toString("utf8").trim() };
    }

    return {
      text: "",
      note: `unsupported type (${contentType || "unknown"}) — filename: ${filename || "unnamed"}`
    };
  } catch (e) {
    return {
      text: "",
      note: `extraction failed: ${e instanceof Error ? e.message : String(e)}`
    };
  }
}

export async function summarizeEmailAttachments(
  attachments: Array<{ filename?: string; contentType: string; size: number; content: Buffer }>
): Promise<EmailAttachmentSummary[]> {
  const out: EmailAttachmentSummary[] = [];

  for (const att of attachments) {
    const filename = att.filename || "unnamed";
    const { text, note } = await extractEmailAttachmentText(att.content, att.contentType, filename);
    const trimmed = text.trim();
    out.push({
      filename,
      contentType: att.contentType,
      size: att.size,
      ...(trimmed ? { text: trimmed.slice(0, PER_ATTACHMENT_CHAR_LIMIT) } : {}),
      ...(note ? { extractNote: note } : {})
    });
  }

  return out;
}

export function formatAttachmentBlockForAi(attachments: EmailAttachmentSummary[]): string {
  if (!attachments.length) return "";

  const lines: string[] = [
    "",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "ATTACHMENTS (combined with email body for your reply):"
  ];

  for (const att of attachments) {
    const sizeKb = Math.round(att.size / 1024);
    lines.push(`\n▸ ${att.filename} (${att.contentType}, ${sizeKb}KB)`);
    if (att.text && att.text.trim().length > 20) {
      lines.push(`[Extracted content]:\n${att.text.trim()}`);
    } else if (att.extractNote) {
      lines.push(`[Note]: ${att.extractNote}`);
    } else {
      lines.push("[Note]: No text could be extracted — acknowledge the attachment and ask clarifying questions if needed.");
    }
  }

  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  return lines.join("\n");
}

export function attachmentsHaveExtractedContent(attachments: EmailAttachmentSummary[]): boolean {
  return attachments.some((a) => Boolean(a.text?.trim() && a.text.trim().length > 20));
}

export function capEmailBodyForAi(body: string, maxChars = 28_000): string {
  if (body.length <= maxChars) return body;
  return `${body.slice(0, maxChars)}\n\n[... message truncated for AI context — full text is stored in CRM ...]`;
}
