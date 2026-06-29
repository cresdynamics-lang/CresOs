import PizZip from "pizzip";

function stripXmlTags(xml: string): string {
  return xml
    .replace(/<w:tab[^/]*\/>/g, "\t")
    .replace(/<w:br[^/]*\/>/g, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export async function extractDocxText(buffer: Buffer): Promise<string> {
  const zip = new PizZip(buffer);
  const docXml = zip.file("word/document.xml")?.asText();
  if (!docXml) return "";
  return stripXmlTags(docXml);
}

export async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse") as (data: Buffer) => Promise<{ text?: string }>;
    const result = await pdfParse(buffer);
    return (result.text ?? "").trim();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[project-document] PDF extract failed:", e);
    return "";
  }
}

export async function extractPlanningDocumentText(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<string> {
  const name = (filename || "").toLowerCase();
  const mime = (mimeType || "").toLowerCase();

  if (mime.includes("pdf") || name.endsWith(".pdf")) {
    return extractPdfText(buffer);
  }
  if (
    mime.includes("wordprocessingml") ||
    mime.includes("msword") ||
    name.endsWith(".docx") ||
    name.endsWith(".doc")
  ) {
    if (name.endsWith(".doc") && !name.endsWith(".docx")) {
      throw new Error("Legacy .doc files are not supported — save as .docx or PDF");
    }
    return extractDocxText(buffer);
  }
  if (mime.startsWith("text/") || name.endsWith(".txt") || name.endsWith(".md")) {
    return buffer.toString("utf8").trim();
  }
  throw new Error("Unsupported file type. Upload PDF, Word (.docx), or plain text.");
}
