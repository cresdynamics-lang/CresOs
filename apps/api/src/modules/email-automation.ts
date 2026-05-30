/**
 * Email Automation — CresOS (ported from Emil-AI)
 *
 * Pipeline:
 *   IMAP inbox → extract email (body, subject, sender, attachments)
 *     → detect sender: external client OR internal team (domain + known names)
 *     → crawl cresdynamics.com for live service context
 *     → AI draft: CEO tone (external) | Director tone (internal)
 *        └─ if topic matches Cres Dynamics services → address it directly
 *        └─ if not → CEO/Director thoughtful reply
 *     → send to WhatsApp for approval
 *     → APPROVE → SMTP reply sent to sender
 *        AUDIT  → flagged in CRM for manual review (pending)
 *        IGNORE → dismissed
 *        <text> → edit draft, then SUBMIT to send
 *
 * Required env vars:
 *   IMAP_HOST, IMAP_PORT (default 993), IMAP_USER, IMAP_PASSWORD
 *   GROQ_API_KEY
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
 *   TWILIO_WHATSAPP_FROM   (e.g. whatsapp:+14155238886  — Twilio sandbox or approved sender)
 *   YOUR_WHATSAPP_NUMBER   (default: whatsapp:+254708805496)
 *   MAIL_HOST, MAIL_PORT, MAIL_USERNAME, MAIL_PASSWORD, MAIL_FROM_ADDRESS
 *
 * Optional:
 *   COMPANY_DOMAIN             (default: cresdynamics.com)
 *   GROQ_EMAIL_MODEL           (default: llama-3.3-70b-versatile)
 *   EMAIL_AUTOMATION_ORG_ID    (defaults to first org in DB)
 *   EMAIL_AUTOMATION_POLL_INTERVAL  (seconds, default 10)
 *   EMAIL_AUTOMATION_ENABLED   (default true)
 *   WEBSITE_CRAWL_URL          (default: https://www.cresdynamics.com)
 */

import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import Groq from "groq-sdk";
import { sendOutboundEmail } from "../lib/resend";
import { resolveGroqModel } from "../lib/groq-model";
import { resolveSenderGreeting } from "../lib/sender-greeting";
import https from "https";
import http from "http";
import type { Request, Response, NextFunction } from "express";

// ── Known internal team members (by first name, case-insensitive) ─────────────

const INTERNAL_TEAM_NAMES = ["reinhard", "victor", "kelvin", "brian"];

// ── CEO default instructions ──────────────────────────────────────────────────

const CEO_DEFAULT_INSTRUCTIONS = `You are the voice of Cres Dynamics — responding on behalf of the CEO.
You communicate with clarity, confidence, and purpose. No fluff. No exaggeration. No unnecessary back-and-forth.
Every message you send should move the conversation forward — toward a meeting, a decision, or a clear next step.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ABOUT CRES DYNAMICS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cres Dynamics builds the operational infrastructure that growing businesses run on.
We build websites, ERP systems, finance platforms, AI automation, and e-commerce solutions — all on our proprietary Cres Core Engine.

Our clients are businesses that have outgrown WhatsApp and Excel and need real systems.
We are based in Kenya. We understand the market. We integrate Mpesa natively.

Our philosophy: Business first. Technology second. We understand your operations before we build anything.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SERVICES & PRICING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You may share price ranges. Never give exact quotes — those come after a discovery session.

WEBSITES
- Starter Website: from KES 60,000 — professional design, mobile-first, Google Business setup, WhatsApp integration, 2-week delivery
- If they need more than a website, guide them toward CresOS

CRES OS (Business Operating System)
- Growth – CresOS Business: from KES 200,000 — operations, finance/invoicing, client & team management, analytics, Mpesa integration, 3-week delivery
- Scale – Full ERP: from KES 400,000 — custom ERP modules, multi-branch, AI automation layer, dedicated support, 4-week delivery

AI & AUTOMATION
- Foundation: from KES 120,000 — lead follow-up, automated reporting, WhatsApp integration, 3 triggers
- Suite (Most Popular): from KES 250,000 — 10+ triggers, Mpesa & email integrations, AI anomaly detection
- Enterprise: from KES 500,000 — custom AI models, predictive analytics, unlimited triggers

OPERATIONS SYSTEMS
- Team Operations: from KES 150,000 — project/task management, up to 10 users
- Operations Platform: from KES 280,000 — approval workflows, client management, performance dashboards, up to 30 users
- Operations + Finance (Enterprise): from KES 500,000 — full platform, multi-branch, unlimited users, dedicated retainer

All prices are starting points. Final scope is confirmed after a discovery session.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOW TO THINK & RESPOND
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. READ THE REAL NEED
   Do not just answer what was asked. Understand what problem they are trying to solve.
   If the email contains attachments (documents, proposals, contracts) — acknowledge them and address their content.

2. RESPOND LIKE A CEO, NOT A SALESPERSON
   - No hype. No "amazing opportunity." No "we're the best."
   - Speak plainly, directly, and with authority.
   - One or two well-chosen questions beat five generic ones.
   - Show that you understand their world before offering a solution.

3. MATCH TO SERVICES INTELLIGENTLY
   - If what they need IS something Cres Dynamics offers → be specific, mention the service, give the price range, invite a discovery call.
   - If what they need is OUTSIDE our core offerings → be honest, acknowledge their need, and explain how Cres Dynamics can still help or point to the right next step.

4. GIVE A PRICE RANGE WHEN ASKED
   Share the relevant range from the pricing above. Always add:
   "The exact investment depends on your specific requirements — we confirm that after a short discovery call."

5. HANDLE OBJECTIONS CALMLY
   - "It's too expensive" → "I understand. Let's look at what you actually need first — most clients start smaller and scale up."
   - "We're not ready yet" → "Understood. What would need to be in place for you to be ready?"
   - "We're looking at other options" → "That makes sense. What matters most to you in making this decision?"
   - "I need to think about it" → "Of course. What's the main thing holding you back?"

6. ALWAYS MOVE TOWARD A MEETING
   Every reply should end with either a single smart question OR a low-pressure invite:
   "Would it make sense to get on a 20-minute call this week so I can understand your setup properly?"

7. KEEP IT SHORT
   3–5 sentences maximum unless detail is clearly needed.
   Long replies lose people. Short, sharp replies command attention.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SIGN-OFF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Always end with:

Regards,
Cres Dynamics
info@cresdynamics.com`;

const DIRECTOR_DEFAULT_INSTRUCTIONS = `You are responding as the Director of Operations at Cres Dynamics to an internal team member.
Be direct, clear, and professional. Focus on action items, decisions, and next steps.
Address the specific issue raised without unnecessary preamble.
If they attached a document, acknowledge it and respond to its content.
Keep responses concise and actionable.

Sign off as:
Regards,
[Director, Cres Dynamics]`;

// ── Website crawler & context cache ──────────────────────────────────────────

interface SiteCache {
  content: string;
  fetchedAt: number;
}

let _siteCache: SiteCache | null = null;
const SITE_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

async function httpFetch(url: string, redirects = 5): Promise<string> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https://") ? https : http;
    const req = protocol.get(
      url,
      {
        headers: {
          "User-Agent": "CresOS-EmailBot/1.0",
          Accept: "text/html,*/*",
        },
      },
      (res) => {
        if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location && redirects > 0) {
          const next = res.headers.location.startsWith("http")
            ? res.headers.location
            : new URL(res.headers.location, url).toString();
          res.resume();
          httpFetch(next, redirects - 1).then(resolve).catch(reject);
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        res.on("error", reject);
      }
    );
    req.on("error", reject);
    req.setTimeout(12000, () => {
      req.destroy();
      reject(new Error("HTTP timeout"));
    });
  });
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function crawlWebsiteContext(): Promise<string> {
  const baseUrl = (process.env.WEBSITE_CRAWL_URL || "https://www.cresdynamics.com").replace(/\/$/, "");

  const pagesToTry = [
    baseUrl,
    `${baseUrl}/services`,
    `${baseUrl}/about`,
    `${baseUrl}/solutions`,
    `${baseUrl}/products`,
    `${baseUrl}/pricing`,
  ];

  const collected: string[] = [];

  for (const url of pagesToTry) {
    try {
      const html = await httpFetch(url);
      const text = htmlToText(html);
      if (text.length > 100) {
        // Keep first 3000 chars per page to stay within token limits
        collected.push(`[PAGE: ${url}]\n${text.slice(0, 3000)}`);
      }
    } catch {
      // Page may not exist — skip silently
    }
  }

  return collected.join("\n\n---\n\n").slice(0, 12000); // hard cap
}

async function getWebsiteContext(): Promise<string> {
  const now = Date.now();
  if (_siteCache && now - _siteCache.fetchedAt < SITE_CACHE_TTL_MS && _siteCache.content) {
    return _siteCache.content;
  }

  try {
    const content = await crawlWebsiteContext();
    _siteCache = { content, fetchedAt: now };
    console.info(`[email-automation] Website context refreshed (${content.length} chars)`);
    return content;
  } catch (err) {
    console.warn("[email-automation] Website crawl failed, using embedded instructions only:", err);
    return "";
  }
}

// Kick off the first crawl on startup (non-blocking)
setTimeout(() => {
  getWebsiteContext().catch(() => {});
}, 8000);

// ── Sender type detection ─────────────────────────────────────────────────────

function detectSenderType(fromEmail: string, fromName: string): "internal" | "external" {
  // 1. Domain check (email from @cresdynamics.com)
  const domain = (process.env.COMPANY_DOMAIN || "cresdynamics.com").trim().toLowerCase();
  const emailDomain = fromEmail.split("@")[1]?.toLowerCase() || "";
  if (emailDomain === domain) return "internal";

  // 2. Known team member by first name (Reinhard, Victor, Kelvin, Brian)
  const nameLower = fromName.toLowerCase();
  for (const teamName of INTERNAL_TEAM_NAMES) {
    // Match if name starts with or contains the team member's first name as a word
    if (nameLower === teamName || nameLower.startsWith(`${teamName} `) || nameLower.includes(` ${teamName}`)) {
      return "internal";
    }
  }

  return "external";
}

// ── Groq AI drafting ──────────────────────────────────────────────────────────

function getGroqClient(): Groq | null {
  const key = [
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_KEY_SECONDARY,
    process.env.GROQ_API_KEY_TERTIARY,
  ]
    .find((k) => typeof k === "string" && k.trim().length > 0)
    ?.trim();
  if (!key) return null;
  return new Groq({ apiKey: key });
}

async function draftEmailReply(params: {
  fromName: string;
  fromEmail: string;
  subject: string;
  body: string;
  senderType: "internal" | "external";
  revisionNotes?: string | null;
  customInstructions: string;
}): Promise<string> {
  const greeting = resolveSenderGreeting({
    fromName: params.fromName,
    fromEmail: params.fromEmail,
    subject: params.subject,
    body: params.body,
  });

  const groq = getGroqClient();
  if (!groq) throw new Error("GROQ_API_KEY not configured");

  const model = resolveGroqModel(
    process.env.GROQ_EMAIL_MODEL,
    process.env.GROQ_DIRECTOR_MODEL,
    process.env.GROQ_REMINDER_MODEL
  );

  const baseInstructions =
    params.customInstructions.trim() ||
    (params.senderType === "internal" ? DIRECTOR_DEFAULT_INSTRUCTIONS : CEO_DEFAULT_INSTRUCTIONS);

  // Fetch live website context (cached, non-blocking if unavailable)
  const websiteContext = params.senderType === "external" ? await getWebsiteContext() : "";

  const websiteBlock = websiteContext
    ? `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LIVE WEBSITE CONTEXT (cresdynamics.com — use this to answer specific service questions)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${websiteContext}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    : "";

  const revisionBlock = params.revisionNotes
    ? `\n\nThe reviewer has requested these changes to the previous draft:\n<revision_notes>\n${params.revisionNotes}\n</revision_notes>\nPlease rewrite the reply incorporating these changes.`
    : "";

  const toneNote =
    params.senderType === "internal"
      ? "This email is from an INTERNAL Cres Dynamics team member (Reinhard, Victor, Kelvin, Brian, or @cresdynamics.com). Reply as the Director/Management — direct, actionable, no formality."
      : "This email is from an EXTERNAL client or prospect. Reply as the CEO of Cres Dynamics.";

  const serviceMatchNote = params.senderType === "external"
    ? `\nBefore drafting your reply:
- Check if what the sender needs is something Cres Dynamics offers (websites, ERP, AI automation, operations systems, finance platforms).
- If YES: be specific about which service applies, give a price range, and invite a discovery call.
- If NO: acknowledge their need thoughtfully, respond as a CEO would, and where possible redirect to how Cres Dynamics could still add value.`
    : "";

  const systemPrompt = `You are handling emails for Cres Dynamics (info@cresdynamics.com).

${toneNote}

${baseInstructions}${websiteBlock}${serviceMatchNote}

IMPORTANT RULES:
- Write ONLY the email reply body. Do not include subject lines, "To:", "From:", or any metadata.
- Start directly with a greeting using the sender's first name exactly as specified below (e.g. "Hi ${greeting.greetingName}," or "Dear ${greeting.greetingName},"). Do not use a different name or a generic greeting if a name is provided.
- Think and respond like a CEO who is diagnosing business problems, clarifying goals, and guiding the sender toward practical next steps.
- Be detailed enough to show understanding of the sender's context and propose a clear solution path based on Cres Dynamics services.
- Keep confidence high but avoid hype; tie recommendations to websites, CresOS/ERP, AI automation, operations systems, and finance platforms where relevant.
- If the email mentions or contains attachments/documents, acknowledge them naturally in your reply.
- Do not add any preamble, meta-commentary, or explanation of what you are doing.`;

  const greetingSourceNote =
    greeting.source === "signoff"
      ? "Name taken from the sender's sign-off (e.g. Regards, Yours faithfully)."
      : "Name taken from the email From header (display name/email identity).";

  const userPrompt = `Incoming email:
- From: ${params.fromName ? `${params.fromName} <${params.fromEmail}>` : params.fromEmail}
- Subject: ${params.subject}
- Resolved sender name for greeting: ${greeting.fullName} → use first name "${greeting.greetingName}" (${greetingSourceNote})
- Body:
${params.body}${revisionBlock}`;

  const response = await groq.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: 1200,
    temperature: 0.45,
  });

  return response.choices[0].message.content?.trim() ?? "";
}

// ── WhatsApp (Twilio) ─────────────────────────────────────────────────────────

function getTwilioConfig(): { sid: string; token: string; from: string; to: string } | null {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim() || "";
  const token = process.env.TWILIO_AUTH_TOKEN?.trim() || "";
  const from = process.env.TWILIO_WHATSAPP_FROM?.trim() || "";
  // Default to the configured approval number
  const to =
    process.env.YOUR_WHATSAPP_NUMBER?.trim() ||
    "whatsapp:+254708805496";
  if (!sid || !token || !from) return null;
  return { sid, token, from, to };
}

async function sendWhatsAppDraft(params: {
  threadId: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  senderType: "internal" | "external";
  draft: string;
  hasAttachments?: boolean;
}): Promise<string | null> {
  const cfg = getTwilioConfig();
  if (!cfg) {
    console.warn("[email-automation] WhatsApp not configured — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM");
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  let Twilio: any;
  try { Twilio = require("twilio"); } catch {
    console.warn("[email-automation] twilio package not installed");
    return null;
  }

  const client = new Twilio(cfg.sid, cfg.token);
  const sender = params.fromName ? `${params.fromName} <${params.fromEmail}>` : params.fromEmail;
  const typeLabel = params.senderType === "internal" ? "👤 Internal Team" : "🌐 External Client";
  const attachNote = params.hasAttachments ? "\n📎 *Has attachments* (see CRM for details)" : "";

  const body = [
    `📩 *New Email — Action Required*`,
    `─────────────────────────────`,
    `${typeLabel}${attachNote}`,
    `*From:* ${sender}`,
    `*Subject:* ${params.subject}`,
    `─────────────────────────────`,
    `*AI Draft Reply:*`,
    ``,
    params.draft,
    ``,
    `─────────────────────────────`,
    `Reply *APPROVE* — send this reply`,
    `Reply *AUDIT*   — flag for manual review in CRM`,
    `Reply *IGNORE*  — dismiss this email`,
    `Or *type your own reply* — confirm with SUBMIT`,
  ].join("\n");

  try {
    const msg = await client.messages.create({ from: cfg.from, to: cfg.to, body });
    console.info(`[email-automation] Draft sent to WhatsApp +254708805496 — SID: ${msg.sid}`);
    return String(msg.sid);
  } catch (err) {
    console.error("[email-automation] WhatsApp send failed:", err);
    return null;
  }
}

async function sendWhatsAppNotification(text: string): Promise<void> {
  const cfg = getTwilioConfig();
  if (!cfg) return;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  let Twilio: any;
  try { Twilio = require("twilio"); } catch { return; }
  const client = new Twilio(cfg.sid, cfg.token);
  try {
    await client.messages.create({ from: cfg.from, to: cfg.to, body: text });
  } catch (err) {
    console.error("[email-automation] WhatsApp notification failed:", err);
  }
}

async function sendWhatsAppEditConfirmation(draft: string): Promise<void> {
  const cfg = getTwilioConfig();
  if (!cfg) return;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  let Twilio: any;
  try { Twilio = require("twilio"); } catch { return; }
  const client = new Twilio(cfg.sid, cfg.token);
  const body = [
    `✏️ *Draft Updated*`,
    `─────────────────────────────`,
    `*This will be sent:*`,
    ``,
    draft,
    ``,
    `─────────────────────────────`,
    `Reply *SUBMIT* to send now`,
    `Reply *AUDIT* to flag for CRM review`,
    `Reply *IGNORE* to dismiss`,
    `Or keep typing to update further`,
  ].join("\n");
  try {
    await client.messages.create({ from: cfg.from, to: cfg.to, body });
  } catch (err) {
    console.error("[email-automation] WhatsApp edit confirmation failed:", err);
  }
}

// ── SMTP reply sending ────────────────────────────────────────────────────────

async function sendEmailReply(params: {
  toEmail: string;
  toName: string;
  subject: string;
  body: string;
  originalMessageId?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const subject = params.subject.startsWith("Re:") ? params.subject : `Re: ${params.subject}`;
  const htmlBody = params.body.replace(/\n/g, "<br>");
  const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;font-size:15px;color:#222;line-height:1.6;">${htmlBody}</body></html>`;
  const to = params.toName ? `${params.toName} <${params.toEmail}>` : params.toEmail;
  const result = await sendOutboundEmail({ to, subject, text: params.body, html });
  if (result.ok) {
    console.info(`[email-automation] Reply sent to ${params.toEmail} — ${subject}`);
    return { ok: true };
  }
  console.error(`[email-automation] Send failed to ${params.toEmail}:`, result.error);
  return { ok: false, error: result.error };
}

// ── IMAP email fetching ───────────────────────────────────────────────────────

function formatAttachmentBlock(attachments: Array<{ filename: string; contentType: string; size: number; text?: string }>): string {
  if (!attachments.length) return "";
  const lines: string[] = ["\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "ATTACHMENTS RECEIVED:"];
  for (const att of attachments) {
    const sizeKb = Math.round(att.size / 1024);
    lines.push(`• ${att.filename || "unnamed"} (${att.contentType}, ${sizeKb}KB)`);
    if (att.text && att.text.trim().length > 20) {
      // Include up to 1500 chars of text content from the attachment
      lines.push(`  [Content preview]: ${att.text.trim().slice(0, 1500)}${att.text.length > 1500 ? "…" : ""}`);
    }
  }
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  return lines.join("\n");
}

async function fetchNewEmails(orgId: string, prisma: PrismaClient): Promise<number> {
  const imapHost = (process.env.IMAP_HOST || process.env.MAIL_HOST || "").trim();
  const imapPort = parseInt(process.env.IMAP_PORT || "993", 10);
  const imapUser = (
    process.env.IMAP_USER ||
    process.env.IMAP_USERNAME ||
    process.env.MAIL_USERNAME ||
    ""
  ).trim();
  const imapPass = process.env.IMAP_PASSWORD || process.env.MAIL_PASSWORD || "";
  const imapSecure =
    process.env.IMAP_SECURE !== "false" && (imapPort === 993 || process.env.IMAP_SECURE === "true");

  if (!imapHost || !imapUser || !imapPass) {
    console.warn("[email-automation] IMAP not configured — set IMAP_HOST, IMAP_USER, IMAP_PASSWORD");
    return 0;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  let ImapFlow: any;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  let simpleParser: any;
  try {
    ImapFlow = require("imapflow").ImapFlow;
    simpleParser = require("mailparser").simpleParser;
  } catch {
    console.warn("[email-automation] imapflow/mailparser not installed");
    return 0;
  }

  const client = new ImapFlow({
    host: imapHost,
    port: imapPort,
    secure: imapSecure,
    auth: { user: imapUser, pass: imapPass },
    logger: false,
  });

  // Prevent unhandled ImapFlow socket errors from crashing the API process.
  client.on("error", (err: Error) => {
    console.error("[email-automation] IMAP client error (non-fatal):", err.message);
  });

  let count = 0;
  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const uids: number[] = await client.search({ seen: false }, { uid: true });
      if (uids.length === 0) return 0;

      for await (const msg of client.fetch(uids, { uid: true, source: true, envelope: true }, { uid: true })) {
        const uid = String(msg.uid);
        const already = await prisma.emailThread.findFirst({ where: { orgId, uid } });
        if (already) continue;

        let fromEmail = "";
        let fromName = "";
        let subject = "(no subject)";
        let messageId = uid;
        let body = "";
        let hasAttachments = false;

        if (msg.source) {
          try {
            const parsed = await simpleParser(msg.source);

            // ── Sender details ─────────────────────────────────────────────
            fromEmail = parsed.from?.value?.[0]?.address || msg.envelope?.from?.[0]?.address || "";
            fromName = parsed.from?.value?.[0]?.name || msg.envelope?.from?.[0]?.name || "";
            subject = parsed.subject || msg.envelope?.subject || "(no subject)";
            messageId = parsed.messageId || msg.envelope?.messageId || uid;

            // ── Body: prefer plain text, fall back to HTML→text ────────────
            body = parsed.text || "";
            if (!body && parsed.html) {
              body = String(parsed.html)
                .replace(/<br\s*\/?>/gi, "\n")
                .replace(/<p[^>]*>/gi, "\n")
                .replace(/<[^>]+>/g, "")
                .replace(/&amp;/g, "&")
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">")
                .replace(/&nbsp;/g, " ")
                .replace(/\s{3,}/g, "\n\n")
                .trim();
            }

            // ── Attachments ────────────────────────────────────────────────
            if (parsed.attachments && parsed.attachments.length > 0) {
              hasAttachments = true;
              const attSummary: Array<{ filename: string; contentType: string; size: number; text?: string }> = [];
              for (const att of parsed.attachments as Array<{
                filename?: string;
                contentType: string;
                size: number;
                content: Buffer;
              }>) {
                let attText: string | undefined;
                // Extract text from plain-text or CSV attachments
                if (
                  att.contentType.startsWith("text/") ||
                  att.contentType === "application/json" ||
                  att.contentType === "application/csv"
                ) {
                  try {
                    attText = att.content.toString("utf8");
                  } catch { /* ignore */ }
                }
                attSummary.push({
                  filename: att.filename || "unnamed",
                  contentType: att.contentType,
                  size: att.size,
                  ...(attText ? { text: attText } : {}),
                });
              }
              // Append attachment block to body so AI sees it
              body += formatAttachmentBlock(attSummary);
            }
          } catch {
            fromEmail = msg.envelope?.from?.[0]?.address || "";
            fromName = msg.envelope?.from?.[0]?.name || "";
            subject = msg.envelope?.subject || "(no subject)";
            messageId = msg.envelope?.messageId || uid;
          }
        }

        // Hard cap to avoid overwhelming AI context
        if (body.length > 10000) body = body.slice(0, 10000) + "\n\n[... message truncated ...]";

        const senderType = detectSenderType(fromEmail, fromName);

        await prisma.emailThread.create({
          data: { orgId, uid, messageId, fromEmail, fromName, subject, body, senderType, status: "pending_draft" },
        });
        count++;
        console.info(`[email-automation] New ${senderType} email from ${fromName || fromEmail} — "${subject}"${hasAttachments ? " [+attachments]" : ""}`);
      }
    } finally {
      lock.release();
    }
  } catch (err) {
    console.error("[email-automation] IMAP fetch error:", err);
  } finally {
    try {
      await client.logout();
    } catch {
      /* connection may already be closed */
    }
  }

  return count;
}

// ── Send draft to WhatsApp for approval ──────────────────────────────────────

async function dispatchDraft(
  thread: { id: string; fromName: string; fromEmail: string; subject: string; senderType: string; draftReply: string | null; body?: string },
  prisma: PrismaClient
): Promise<void> {
  const hasAttachments = !!(thread.body && thread.body.includes("ATTACHMENTS RECEIVED:"));
  const sid = await sendWhatsAppDraft({
    threadId: thread.id,
    fromName: thread.fromName,
    fromEmail: thread.fromEmail,
    subject: thread.subject,
    senderType: thread.senderType as "internal" | "external",
    draft: thread.draftReply || "",
    hasAttachments,
  });

  await prisma.emailThread.update({
    where: { id: thread.id },
    data: {
      status: "awaiting_approval",
      ...(sid ? { waMessageSid: sid } : {}),
    },
  });
}

// ── Core approve & send (used by both WhatsApp webhook and CRM) ───────────────

async function doApproveAndSend(threadId: string, prisma: PrismaClient): Promise<{ ok: boolean; error?: string }> {
  const thread = await prisma.emailThread.findUnique({ where: { id: threadId } });
  if (!thread || !thread.draftReply) {
    return { ok: false, error: "Thread not found or no draft" };
  }

  await prisma.emailThread.update({ where: { id: threadId }, data: { status: "approved" } });

  const result = await sendEmailReply({
    toEmail: thread.fromEmail,
    toName: thread.fromName,
    subject: thread.subject,
    body: thread.draftReply,
    originalMessageId: thread.messageId,
  });

  if (result.ok) {
    await prisma.emailThread.update({ where: { id: threadId }, data: { status: "sent" } });
    await sendWhatsAppNotification(
      `✅ *Reply sent* to ${thread.fromEmail}\n*Subject:* ${thread.subject}`
    );
  } else {
    await prisma.emailThread.update({ where: { id: threadId }, data: { status: "failed" } });
    await sendWhatsAppNotification(
      `❌ *Send failed* — ${thread.fromEmail}\n*Subject:* ${thread.subject}\nError: ${result.error}\nCheck CRM to retry.`
    );
  }

  return result;
}

// ── Email pipeline ────────────────────────────────────────────────────────────

export async function runEmailPipeline(prisma: PrismaClient): Promise<void> {
  const orgId = await resolveOrgId(prisma);
  if (!orgId) {
    console.warn("[email-automation] No org found — set EMAIL_AUTOMATION_ORG_ID or create an org");
    return;
  }

  // 1. Fetch new emails from IMAP
  await fetchNewEmails(orgId, prisma);

  // 2. Generate AI drafts for pending_draft threads
  const pending = await prisma.emailThread.findMany({
    where: { orgId, status: "pending_draft" },
    orderBy: { receivedAt: "asc" },
    take: 10,
  });

  if (pending.length === 0) return;

  const config = await prisma.emailAutomationConfig.findUnique({ where: { orgId } });
  const customInstructions = config?.instructions || "";

  for (const thread of pending) {
    try {
      const draft = await draftEmailReply({
        fromName: thread.fromName,
        fromEmail: thread.fromEmail,
        subject: thread.subject,
        body: thread.body,
        senderType: thread.senderType as "internal" | "external",
        revisionNotes: thread.revisionNotes,
        customInstructions,
      });

      await prisma.emailThread.update({
        where: { id: thread.id },
        data: { draftReply: draft },
      });

      await dispatchDraft({ ...thread, draftReply: draft }, prisma);
      const g = resolveSenderGreeting({
        fromName: thread.fromName,
        fromEmail: thread.fromEmail,
        subject: thread.subject,
        body: thread.body,
      });
      console.info(
        `[email-automation] Draft dispatched for ${thread.fromEmail} — greeting "${g.greetingName}" (from ${g.source})`
      );
    } catch (err) {
      console.error(`[email-automation] Pipeline error for thread ${thread.id}:`, err);
      await prisma.emailThread.update({ where: { id: thread.id }, data: { status: "failed" } });
    }
  }
}

// ── Org resolution ────────────────────────────────────────────────────────────

async function resolveOrgId(prisma: PrismaClient): Promise<string | null> {
  const envOrg = process.env.EMAIL_AUTOMATION_ORG_ID?.trim();
  if (envOrg) return envOrg;
  const first = await prisma.org.findFirst({ select: { id: true } });
  return first?.id ?? null;
}

// ── Scheduler ─────────────────────────────────────────────────────────────────

export function scheduleEmailPipeline(prisma: PrismaClient): void {
  if (process.env.EMAIL_AUTOMATION_ENABLED === "false") return;

  const interval = parseInt(process.env.EMAIL_AUTOMATION_POLL_INTERVAL || "10", 10) * 1000;
  setTimeout(() => runEmailPipeline(prisma).catch(console.error), 5000);
  setInterval(() => runEmailPipeline(prisma).catch(console.error), interval);
  console.info(`[email-automation] Scheduler started — polling every ${interval / 1000}s`);
}

// ── Public webhook router (registered BEFORE auth middleware) ─────────────────

export function emailAutomationPublicRouter(prisma: PrismaClient): Router {
  const router = Router();

  /**
   * POST /email-automation/webhook/whatsapp
   * Twilio sends URL-encoded: Body=<text>&From=<wa:+...>&To=<wa:+...>
   *
   * Approval state machine:
   *   awaiting_approval:
   *     APPROVE  → send email immediately
   *     AUDIT    → flag for CRM review (stays awaiting_approval, notified)
   *     IGNORE   → mark ignored
   *     <text>   → save as edited draft, move to "editing", ask for SUBMIT
   *   editing:
   *     SUBMIT   → send edited draft
   *     AUDIT    → flag for CRM review
   *     IGNORE   → mark ignored
   *     <text>   → overwrite draft, stay in editing
   */
  router.post("/webhook/whatsapp", async (req: Request, res: Response) => {
    const msgBody: string = (req.body?.Body ?? req.body?.body ?? "").toString().trim();
    const from: string = (req.body?.From ?? req.body?.from ?? "").toString().trim();

    if (!msgBody) {
      res.status(200).send("OK");
      return;
    }

    // Validate sender is the approved WhatsApp number
    const cfg = getTwilioConfig();
    const approvedNumber = cfg?.to || "";
    if (approvedNumber && from && from !== approvedNumber) {
      console.warn(`[email-automation] WhatsApp from unauthorized number: ${from}`);
      res.status(200).send("OK");
      return;
    }

    const cmd = msgBody.toUpperCase().trim();
    console.info(`[email-automation] WhatsApp [${from}]: ${msgBody.slice(0, 80)}`);

    try {
      const orgId = await resolveOrgId(prisma);
      if (!orgId) { res.status(200).send("OK"); return; }

      // Find oldest thread awaiting approval or in editing
      const thread = await prisma.emailThread.findFirst({
        where: { orgId, status: { in: ["awaiting_approval", "editing"] } },
        orderBy: { receivedAt: "asc" },
      });

      if (!thread) {
        console.info("[email-automation] No active thread for WhatsApp reply");
        // Let sender know there's nothing pending
        await sendWhatsAppNotification("ℹ️ No emails currently awaiting approval.");
        res.status(200).send("OK");
        return;
      }

      if (cmd === "APPROVE" && thread.status === "awaiting_approval") {
        // ── APPROVE: send the AI draft immediately ────────────────────────
        await doApproveAndSend(thread.id, prisma);
        console.info(`[email-automation] Thread ${thread.id} APPROVED via WhatsApp`);

      } else if (cmd === "SUBMIT" && thread.status === "editing") {
        // ── SUBMIT: send the edited draft ─────────────────────────────────
        await doApproveAndSend(thread.id, prisma);
        console.info(`[email-automation] Thread ${thread.id} SUBMITTED via WhatsApp`);

      } else if (cmd === "IGNORE") {
        // ── IGNORE: dismiss this email ────────────────────────────────────
        await prisma.emailThread.update({ where: { id: thread.id }, data: { status: "ignored" } });
        await sendWhatsAppNotification(`⏭ *Ignored* — ${thread.fromEmail}\n*Subject:* ${thread.subject}`);
        console.info(`[email-automation] Thread ${thread.id} IGNORED via WhatsApp`);

      } else if (cmd === "AUDIT" || cmd === "NEEDS AUDIT" || cmd === "NEEDSAUDIT") {
        // ── AUDIT: flag for manual CRM review, stays pending ─────────────
        await prisma.emailThread.update({ where: { id: thread.id }, data: { status: "awaiting_approval" } });
        await sendWhatsAppNotification(
          `🔎 *Flagged for audit* — email from ${thread.fromEmail}\n*Subject:* ${thread.subject}\nReview and approve it in the CRM under Emil-AI.`
        );
        console.info(`[email-automation] Thread ${thread.id} flagged AUDIT via WhatsApp`);

      } else if (thread.status === "awaiting_approval") {
        // ── User typed their own reply → save as edited draft ─────────────
        await prisma.emailThread.update({
          where: { id: thread.id },
          data: { draftReply: msgBody, status: "editing" },
        });
        await sendWhatsAppEditConfirmation(msgBody);
        console.info(`[email-automation] Thread ${thread.id} draft edited via WhatsApp`);

      } else if (thread.status === "editing") {
        // ── Further edits ──────────────────────────────────────────────────
        await prisma.emailThread.update({ where: { id: thread.id }, data: { draftReply: msgBody } });
        await sendWhatsAppEditConfirmation(msgBody);
        console.info(`[email-automation] Thread ${thread.id} draft re-edited via WhatsApp`);
      }
    } catch (err) {
      console.error("[email-automation] WhatsApp webhook error:", err);
    }

    res.status(200).send("OK");
  });

  return router;
}

// ── Admin REST router (registered AFTER auth middleware) ──────────────────────

export default function emailAutomationRouter(prisma: PrismaClient): Router {
  const router = Router();

  function adminOnly(req: Request, res: Response, next: NextFunction) {
    if (!req.auth?.roleKeys?.includes("admin")) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    next();
  }

  // GET /email-automation/stats
  router.get("/stats", adminOnly, async (req: Request, res: Response) => {
    const orgId = req.auth!.orgId;
    const [total, pending, sent, failed, ignored] = await Promise.all([
      prisma.emailThread.count({ where: { orgId } }),
      prisma.emailThread.count({ where: { orgId, status: "awaiting_approval" } }),
      prisma.emailThread.count({ where: { orgId, status: "sent" } }),
      prisma.emailThread.count({ where: { orgId, status: "failed" } }),
      prisma.emailThread.count({ where: { orgId, status: "ignored" } }),
    ]);
    res.json({ total, pending, sent, failed, ignored });
  });

  // GET /email-automation/threads
  router.get("/threads", adminOnly, async (req: Request, res: Response) => {
    const orgId = req.auth!.orgId;
    const status = (req.query.status as string) || "";
    const limit = Math.min(parseInt(String(req.query.limit || "50"), 10), 200);
    const offset = parseInt(String(req.query.offset || "0"), 10);
    const where = status ? { orgId, status } : { orgId };
    const [threads, total] = await Promise.all([
      prisma.emailThread.findMany({
        where,
        orderBy: { receivedAt: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true, fromEmail: true, fromName: true, subject: true,
          status: true, senderType: true, receivedAt: true, updatedAt: true,
          draftReply: true, waMessageSid: true,
        },
      }),
      prisma.emailThread.count({ where }),
    ]);
    res.json({ threads, total, limit, offset });
  });

  // GET /email-automation/threads/:id
  router.get("/threads/:id", adminOnly, async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const orgId = req.auth!.orgId;
    const thread = await prisma.emailThread.findFirst({ where: { id, orgId } });
    if (!thread) { res.status(404).json({ error: "Thread not found" }); return; }
    res.json(thread);
  });

  // POST /email-automation/threads/:id/regenerate-draft
  router.post("/threads/:id/regenerate-draft", adminOnly, async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const orgId = req.auth!.orgId;
    const thread = await prisma.emailThread.findFirst({ where: { id, orgId } });
    if (!thread) { res.status(404).json({ error: "Thread not found" }); return; }

    const revisionNotes = (req.body?.revisionNotes as string) || null;
    const config = await prisma.emailAutomationConfig.findUnique({ where: { orgId } });

    try {
      await prisma.emailThread.update({
        where: { id: thread.id },
        data: { status: "pending_draft", ...(revisionNotes !== null && { revisionNotes }) },
      });

      const draft = await draftEmailReply({
        fromName: thread.fromName,
        fromEmail: thread.fromEmail,
        subject: thread.subject,
        body: thread.body,
        senderType: thread.senderType as "internal" | "external",
        revisionNotes,
        customInstructions: config?.instructions || "",
      });

      await prisma.emailThread.update({ where: { id: thread.id }, data: { draftReply: draft } });
      await dispatchDraft({ ...thread, draftReply: draft }, prisma);

      const updated = await prisma.emailThread.findUnique({ where: { id: thread.id } });
      res.json(updated);
    } catch (err) {
      await prisma.emailThread.update({ where: { id: thread.id }, data: { status: "failed" } });
      res.status(500).json({ error: err instanceof Error ? err.message : "Draft generation failed" });
    }
  });

  // PATCH /email-automation/threads/:id/draft
  router.patch("/threads/:id/draft", adminOnly, async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const orgId = req.auth!.orgId;
    const thread = await prisma.emailThread.findFirst({ where: { id, orgId } });
    if (!thread) { res.status(404).json({ error: "Thread not found" }); return; }
    const { draftReply } = req.body as { draftReply: string };
    if (typeof draftReply !== "string") { res.status(400).json({ error: "draftReply required" }); return; }
    const updated = await prisma.emailThread.update({
      where: { id: thread.id },
      data: { draftReply, status: "editing" },
    });
    res.json(updated);
  });

  // POST /email-automation/threads/:id/approve  — CRM approval → send reply
  router.post("/threads/:id/approve", adminOnly, async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const orgId = req.auth!.orgId;

    const inlineDraft = (req.body?.draftReply as string) || null;
    if (inlineDraft) {
      await prisma.emailThread.update({ where: { id }, data: { draftReply: inlineDraft, status: "editing" } });
    }

    const thread = await prisma.emailThread.findFirst({ where: { id, orgId } });
    if (!thread) { res.status(404).json({ error: "Thread not found" }); return; }
    if (!thread.draftReply) { res.status(400).json({ error: "No draft reply to send" }); return; }

    const result = await doApproveAndSend(thread.id, prisma);
    const updated = await prisma.emailThread.findUnique({ where: { id: thread.id } });

    if (result.ok) {
      res.json({ ok: true, thread: updated });
    } else {
      res.status(500).json({ ok: false, error: result.error, thread: updated });
    }
  });

  // POST /email-automation/threads/:id/ignore
  router.post("/threads/:id/ignore", adminOnly, async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const orgId = req.auth!.orgId;
    const thread = await prisma.emailThread.findFirst({ where: { id, orgId } });
    if (!thread) { res.status(404).json({ error: "Thread not found" }); return; }
    const updated = await prisma.emailThread.update({ where: { id: thread.id }, data: { status: "ignored" } });
    res.json(updated);
  });

  // GET /email-automation/config
  router.get("/config", adminOnly, async (req: Request, res: Response) => {
    const orgId = req.auth!.orgId;
    const config = await prisma.emailAutomationConfig.findUnique({ where: { orgId } });
    res.json({
      instructions: config?.instructions || "",
      isEnabled: config?.isEnabled ?? true,
      ceoDefaultInstructions: CEO_DEFAULT_INSTRUCTIONS,
      directorDefaultInstructions: DIRECTOR_DEFAULT_INSTRUCTIONS,
    });
  });

  // PUT /email-automation/config
  router.put("/config", adminOnly, async (req: Request, res: Response) => {
    const orgId = req.auth!.orgId;
    const { instructions, isEnabled } = req.body as { instructions?: string; isEnabled?: boolean };
    const config = await prisma.emailAutomationConfig.upsert({
      where: { orgId },
      create: { orgId, instructions: instructions ?? "", isEnabled: isEnabled ?? true },
      update: {
        ...(typeof instructions === "string" && { instructions }),
        ...(typeof isEnabled === "boolean" && { isEnabled }),
      },
    });
    res.json({ ok: true, config });
  });

  // POST /email-automation/poll  — manual inbox check
  router.post("/poll", adminOnly, async (req: Request, res: Response) => {
    const orgId = req.auth!.orgId;
    try {
      const newEmails = await fetchNewEmails(orgId, prisma);
      await runEmailPipeline(prisma);
      res.json({ ok: true, newEmails });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /email-automation/threads/:id/resend-whatsapp
  router.post("/threads/:id/resend-whatsapp", adminOnly, async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const orgId = req.auth!.orgId;
    const thread = await prisma.emailThread.findFirst({ where: { id, orgId } });
    if (!thread) { res.status(404).json({ error: "Thread not found" }); return; }
    if (!thread.draftReply) { res.status(400).json({ error: "No draft to send" }); return; }
    await dispatchDraft(thread as Parameters<typeof dispatchDraft>[0], prisma);
    res.json({ ok: true });
  });

  // POST /email-automation/refresh-website-context — force re-crawl cresdynamics.com
  router.post("/refresh-website-context", adminOnly, async (_req: Request, res: Response) => {
    _siteCache = null;
    try {
      const content = await getWebsiteContext();
      res.json({ ok: true, chars: content.length });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  return router;
}
