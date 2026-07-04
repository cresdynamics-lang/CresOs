import { describe, expect, it } from "vitest";
import {
  attachmentsHaveExtractedContent,
  formatAttachmentBlockForAi,
  extractEmailAttachmentText
} from "../src/lib/email-attachment-text";

describe("email attachment text", () => {
  it("extracts plain text attachments", async () => {
    const { text } = await extractEmailAttachmentText(
      Buffer.from("Hello from attachment\nLine two"),
      "text/plain",
      "notes.txt"
    );
    expect(text).toContain("Hello from attachment");
  });

  it("formats attachment block with extracted content label", () => {
    const block = formatAttachmentBlockForAi([
      { filename: "brief.pdf", contentType: "application/pdf", size: 1200, text: "Project scope: ERP rollout" }
    ]);
    expect(block).toContain("[Extracted content]");
    expect(block).toContain("Project scope");
  });

  it("detects when attachments have extracted content", () => {
    expect(
      attachmentsHaveExtractedContent([
        { filename: "a.txt", contentType: "text/plain", size: 10, text: "substantial content here" }
      ])
    ).toBe(true);
    expect(
      attachmentsHaveExtractedContent([
        { filename: "a.pdf", contentType: "application/pdf", size: 10, extractNote: "scan only" }
      ])
    ).toBe(false);
  });
});
