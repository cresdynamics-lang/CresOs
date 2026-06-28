import type { PrismaClient } from "@prisma/client";
import {
  compileTemplateHtml,
  defaultDesignForKey,
  mergeDesign,
  type EmailTemplateDesign
} from "./email-template-design";

export type EmailTemplateCategory = "reply" | "compose" | "transactional";

export type EmailTemplateDef = {
  key: string;
  name: string;
  category: EmailTemplateCategory;
  description: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  variables: string[];
  design: EmailTemplateDesign;
  useCustomHtml: boolean;
};

export type EmailTemplateOverride = {
  subject?: string;
  htmlBody?: string;
  textBody?: string;
  design?: Partial<EmailTemplateDesign>;
  useCustomHtml?: boolean;
};

export type EmailTemplateOverrides = Record<string, EmailTemplateOverride>;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const BASE_META: Omit<EmailTemplateDef, "key" | "design" | "htmlBody" | "useCustomHtml">[] = [
  {
    name: "AI reply",
    category: "reply",
    description: "Wraps approved AI replies to inbound emails.",
    subject: "",
    variables: ["body", "recipient_name", "subject", "greeting", "footer_note"],
    textBody: "{{greeting}}\n\n{{body}}\n\n—\nCres Dynamics"
  },
  {
    name: "Finance compose",
    category: "compose",
    description: "Manual emails sent from the Finance workspace.",
    subject: "{{subject}}",
    variables: ["body", "subject", "channel_label", "footer_note"],
    textBody: "{{body}}\n\n—\nCres Dynamics Finance"
  },
  {
    name: "Director compose",
    category: "compose",
    description: "Manual emails sent from the Director workspace.",
    subject: "{{subject}}",
    variables: ["body", "subject", "channel_label", "footer_note"],
    textBody: "{{body}}\n\n—\nCres Dynamics"
  },
  {
    name: "Sales compose",
    category: "compose",
    description: "Manual emails sent from the Sales workspace.",
    subject: "{{subject}}",
    variables: ["body", "subject", "channel_label", "footer_note"],
    textBody: "{{body}}\n\n—\nCres Dynamics Sales"
  },
  {
    name: "System notification",
    category: "transactional",
    description: "Default wrapper for queued system emails (reminders, alerts).",
    subject: "{{subject}}",
    variables: ["body", "subject", "footer_note"],
    textBody: "{{subject}}\n\n{{body}}\n\n—\nCres Dynamics"
  }
];

const TEMPLATE_KEYS = ["reply", "compose_finance", "compose_director", "compose_sales", "notification"] as const;

function buildDefaultTemplate(key: (typeof TEMPLATE_KEYS)[number]): EmailTemplateDef {
  const meta = BASE_META[TEMPLATE_KEYS.indexOf(key)];
  const design = defaultDesignForKey(key);
  return {
    key,
    ...meta,
    design,
    useCustomHtml: false,
    htmlBody: compileTemplateHtml(design)
  };
}

export const DEFAULT_EMAIL_TEMPLATES: EmailTemplateDef[] = TEMPLATE_KEYS.map(buildDefaultTemplate);

function resolveTemplate(base: EmailTemplateDef, override?: EmailTemplateOverride): EmailTemplateDef {
  if (!override) return { ...base };

  const design = mergeDesign(base.key, override.design);
  const useCustomHtml = override.useCustomHtml === true;
  const htmlBody =
    useCustomHtml && typeof override.htmlBody === "string"
      ? override.htmlBody
      : compileTemplateHtml(design);

  return {
    ...base,
    subject: typeof override.subject === "string" ? override.subject : base.subject,
    textBody: typeof override.textBody === "string" ? override.textBody : base.textBody,
    design,
    useCustomHtml,
    htmlBody
  };
}

export function mergeTemplates(overrides: EmailTemplateOverrides | null | undefined): EmailTemplateDef[] {
  const map = overrides && typeof overrides === "object" ? overrides : {};
  return DEFAULT_EMAIL_TEMPLATES.map((base) => resolveTemplate(base, map[base.key]));
}

function applyVars(template: string, vars: Record<string, string>, html: boolean): string {
  let out = template;
  for (const [key, raw] of Object.entries(vars)) {
    const val = html && key === "body" ? escapeHtml(raw).replace(/\n/g, "<br/>") : raw;
    out = out.split(`{{${key}}}`).join(val);
  }
  return out;
}

export function renderFromTemplate(
  templates: EmailTemplateDef[],
  key: string,
  vars: Record<string, string>
): { html: string; text: string; subject: string } | null {
  const tpl = templates.find((t) => t.key === key);
  if (!tpl) return null;
  const subject = applyVars(tpl.subject || vars.subject || "", vars, false).trim();
  const mergedVars = {
    footer_note: "This message was sent from Cres Dynamics.",
    ...vars
  };
  return {
    subject,
    html: applyVars(tpl.htmlBody, mergedVars, true),
    text: applyVars(tpl.textBody, mergedVars, false)
  };
}

export async function loadOrgEmailTemplates(
  prisma: PrismaClient,
  orgId: string
): Promise<EmailTemplateDef[]> {
  const config = await prisma.emailAutomationConfig.findUnique({
    where: { orgId },
    select: { templates: true }
  });
  const overrides =
    config?.templates && typeof config.templates === "object" && !Array.isArray(config.templates)
      ? (config.templates as EmailTemplateOverrides)
      : undefined;
  return mergeTemplates(overrides);
}

export async function saveOrgTemplateOverrides(
  prisma: PrismaClient,
  orgId: string,
  key: string,
  patch: EmailTemplateOverride
): Promise<EmailTemplateDef[]> {
  const existing = await prisma.emailAutomationConfig.findUnique({ where: { orgId } });
  const prev =
    existing?.templates && typeof existing.templates === "object" && !Array.isArray(existing.templates)
      ? (existing.templates as EmailTemplateOverrides)
      : {};

  const base = DEFAULT_EMAIL_TEMPLATES.find((t) => t.key === key);
  if (!base) throw new Error("Unknown template key");

  const mergedOverride: EmailTemplateOverride = {
    ...(prev[key] ?? {}),
    ...patch
  };

  if (!mergedOverride.useCustomHtml) {
    const design = mergeDesign(key, mergedOverride.design ?? prev[key]?.design);
    mergedOverride.design = design;
    mergedOverride.htmlBody = compileTemplateHtml(design);
  }

  const next: EmailTemplateOverrides = { ...prev, [key]: mergedOverride };

  await prisma.emailAutomationConfig.upsert({
    where: { orgId },
    create: { orgId, templates: next as object },
    update: { templates: next as object }
  });
  return mergeTemplates(next);
}
