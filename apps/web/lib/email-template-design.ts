/** Client-side mirror of API email template design (for live preview). */

export type EmailFontFamily =
  | "system"
  | "inter"
  | "dm-sans"
  | "georgia"
  | "playfair"
  | "arial";

export type EmailHeaderStyle = "gradient" | "solid" | "image";

export type EmailTemplateDesign = {
  accent: string;
  accentSecondary: string;
  pageBackground: string;
  cardBackground: string;
  fontFamily: EmailFontFamily;
  fontSize: number;
  headingSize: number;
  textColor: string;
  headingColor: string;
  headerLabel: string;
  headerStyle: EmailHeaderStyle;
  headerTitle: string;
  logoUrl: string;
  heroImageUrl: string;
  showLogo: boolean;
  showHeroImage: boolean;
  borderRadius: number;
  bodyAlign: "left" | "center";
  contentIntro: string;
  footerText: string;
  footerBackground: string;
  showButton: boolean;
  buttonLabel: string;
  buttonUrl: string;
  buttonColor: string;
  customCss: string;
};

export const FONT_OPTIONS: { id: EmailFontFamily; label: string }[] = [
  { id: "inter", label: "Inter (modern)" },
  { id: "dm-sans", label: "DM Sans" },
  { id: "system", label: "System UI" },
  { id: "georgia", label: "Georgia (serif)" },
  { id: "playfair", label: "Playfair Display" },
  { id: "arial", label: "Arial" }
];

export const FONT_STACKS: Record<EmailFontFamily, string> = {
  system: "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif",
  inter: "'Inter',system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif",
  "dm-sans": "'DM Sans',system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif",
  georgia: "Georgia,'Times New Roman',Times,serif",
  playfair: "'Playfair Display',Georgia,'Times New Roman',serif",
  arial: "Arial,Helvetica,sans-serif"
};

export const GOOGLE_FONT_LINKS: Partial<Record<EmailFontFamily, string>> = {
  inter: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
  "dm-sans": "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap",
  playfair: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&display=swap"
};

const KEY_ACCENTS: Record<string, { accent: string; accentSecondary: string; label: string }> = {
  reply: { accent: "#6366f1", accentSecondary: "#4f46e5", label: "Email" },
  compose_finance: { accent: "#0f766e", accentSecondary: "#115e59", label: "Finance" },
  compose_director: { accent: "#6d28d9", accentSecondary: "#4c1d95", label: "Director" },
  compose_sales: { accent: "#1d4ed8", accentSecondary: "#1e3a8a", label: "Sales" },
  notification: { accent: "#475569", accentSecondary: "#334155", label: "Notification" }
};

export const DESIGN_PRESETS: { id: string; label: string; patch: Partial<EmailTemplateDesign> }[] = [
  {
    id: "modern-indigo",
    label: "Modern Indigo",
    patch: { accent: "#6366f1", accentSecondary: "#4f46e5", fontFamily: "inter", headerStyle: "gradient" }
  },
  {
    id: "executive-teal",
    label: "Executive Teal",
    patch: { accent: "#0f766e", accentSecondary: "#115e59", fontFamily: "dm-sans", headerStyle: "gradient" }
  },
  {
    id: "editorial",
    label: "Editorial Serif",
    patch: {
      accent: "#1e293b",
      accentSecondary: "#0f172a",
      fontFamily: "playfair",
      headerStyle: "solid",
      pageBackground: "#fafaf9",
      textColor: "#1e293b"
    }
  },
  {
    id: "minimal",
    label: "Minimal Light",
    patch: {
      accent: "#ffffff",
      accentSecondary: "#f8fafc",
      headingColor: "#0f172a",
      headerStyle: "solid",
      fontFamily: "system",
      borderRadius: 8,
      pageBackground: "#f8fafc"
    }
  }
];

export function defaultDesignForKey(key: string): EmailTemplateDesign {
  const brand = KEY_ACCENTS[key] ?? KEY_ACCENTS.reply;
  const isReply = key === "reply";
  return {
    accent: brand.accent,
    accentSecondary: brand.accentSecondary,
    pageBackground: "#f1f5f9",
    cardBackground: "#ffffff",
    fontFamily: "inter",
    fontSize: 15,
    headingSize: isReply ? 22 : 24,
    textColor: "#334155",
    headingColor: "#ffffff",
    headerLabel: `Cres Dynamics · ${brand.label}`,
    headerStyle: "gradient",
    headerTitle: isReply ? "Re: {{subject}}" : "{{subject}}",
    logoUrl: "",
    heroImageUrl: "",
    showLogo: false,
    showHeroImage: false,
    borderRadius: 14,
    bodyAlign: "left",
    contentIntro: isReply ? "{{greeting}}" : "",
    footerText: "Cres Dynamics Ltd · Nairobi, Kenya · {{footer_note}}",
    footerBackground: "#f8fafc",
    showButton: false,
    buttonLabel: "Visit Cres Dynamics",
    buttonUrl: "https://www.cresdynamics.com",
    buttonColor: brand.accent,
    customCss: ""
  };
}

export function mergeDesign(
  key: string,
  stored: Partial<EmailTemplateDesign> | null | undefined
): EmailTemplateDesign {
  const base = defaultDesignForKey(key);
  if (!stored || typeof stored !== "object") return base;
  return { ...base, ...stored };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function resolveEmailAssetUrl(url: string, publicApiBase: string): string {
  const u = (url ?? "").trim();
  if (!u) return "";
  if (u.startsWith("http://") || u.startsWith("https://") || u.startsWith("data:")) return u;
  const base = publicApiBase.replace(/\/+$/, "");
  return u.startsWith("/") ? `${base}${u}` : `${base}/${u}`;
}

export function compileTemplateHtml(design: EmailTemplateDesign, publicApiBase: string): string {
  const base = publicApiBase.replace(/\/+$/, "");
  const abs = (path: string) => resolveEmailAssetUrl(path, base);
  const font = FONT_STACKS[design.fontFamily];
  const google = GOOGLE_FONT_LINKS[design.fontFamily];
  const radius = Math.max(0, Math.min(28, design.borderRadius));

  let headerBg = `background:linear-gradient(135deg,${design.accent} 0%,${design.accentSecondary} 100%);`;
  if (design.headerStyle === "solid") {
    headerBg = `background:${design.accent};`;
  } else if (design.headerStyle === "image" && design.showHeroImage && design.heroImageUrl) {
    headerBg = `background:url('${abs(design.heroImageUrl)}') center/cover no-repeat;`;
  }

  const logoBlock =
    design.showLogo && design.logoUrl
      ? `<img src="${abs(design.logoUrl)}" alt="Logo" width="auto" height="48" style="display:block;max-height:48px;margin:0 0 14px 0;border:0;" />`
      : "";

  const introBlock = design.contentIntro.trim()
    ? `<div style="font-size:${design.fontSize + 1}px;color:#0f172a;font-weight:600;margin-bottom:14px;">${design.contentIntro}</div>`
    : "";

  const buttonBlock =
    design.showButton && design.buttonLabel.trim()
      ? `<table cellpadding="0" cellspacing="0" style="margin:24px 0 8px;"><tr><td style="border-radius:10px;background:${design.buttonColor};">
<a href="${escapeHtml(design.buttonUrl || "#")}" style="display:inline-block;padding:12px 22px;font-family:${font};font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">${escapeHtml(design.buttonLabel)}</a>
</td></tr></table>`
      : "";

  const customCss = design.customCss.trim() ? `<style>${design.customCss}</style>` : "";
  const fontLink = google ? `<link href="${google}" rel="stylesheet"/>` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  ${fontLink}
  ${customCss}
</head>
<body style="margin:0;padding:0;background:${design.pageBackground};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${design.pageBackground};padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${design.cardBackground};border-radius:${radius}px;overflow:hidden;box-shadow:0 8px 30px rgba(15,23,42,0.08);">
        <tr>
          <td style="${headerBg}padding:28px 28px 24px;font-family:${font};">
            ${logoBlock}
            <div style="font-size:11px;color:rgba(255,255,255,0.88);letter-spacing:0.12em;text-transform:uppercase;font-weight:600;">${design.headerLabel}</div>
            <div style="font-size:${design.headingSize}px;color:${design.headingColor};font-weight:700;margin-top:10px;line-height:1.3;">${design.headerTitle}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:26px 28px 20px;font-family:${font};font-size:${design.fontSize}px;color:${design.textColor};line-height:1.65;text-align:${design.bodyAlign};">
            ${introBlock}
            <div>{{body}}</div>
            ${buttonBlock}
          </td>
        </tr>
        <tr>
          <td style="background:${design.footerBackground};padding:14px 28px;border-top:1px solid #e2e8f0;font-family:${font};font-size:12px;color:#94a3b8;line-height:1.5;text-align:${design.bodyAlign};">
            ${design.footerText}
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function applyTemplateVars(html: string, vars: Record<string, string>): string {
  let out = html;
  for (const [key, raw] of Object.entries(vars)) {
    const val = key === "body" ? raw.replace(/\n/g, "<br/>") : raw;
    out = out.split(`{{${key}}}`).join(val);
  }
  return out;
}

export function apiBaseUrl(): string {
  const fallback = "http://localhost:4000";
  const s = (process.env.NEXT_PUBLIC_API_URL ?? fallback).trim();
  return s.replace(/\/+$/, "") || fallback;
}
