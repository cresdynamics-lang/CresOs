import nodemailer from "nodemailer";

export type SmtpSendInput = {
  to: string;
  subject: string;
  text: string;
  html?: string | null;
  replyTo?: string | null;
};

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromAddress: string;
  fromName: string;
  encryption: string;
};

let cachedTransport: nodemailer.Transporter | null = null;
let cachedKey: string | null = null;

function readSmtpConfig(): SmtpConfig | null {
  const mailer = (process.env.MAIL_MAILER ?? "").trim().toLowerCase();
  if (mailer && mailer !== "smtp") return null;

  const host = (process.env.MAIL_HOST ?? "").trim();
  const port = Number((process.env.MAIL_PORT ?? "").trim() || 0);
  const user = (process.env.MAIL_USERNAME ?? "").trim();
  const pass = String(process.env.MAIL_PASSWORD ?? "");
  const fromAddress = (process.env.MAIL_FROM_ADDRESS ?? "").trim();
  const fromName = (process.env.MAIL_FROM_NAME ?? "CresOS").trim() || "CresOS";
  const encryption = (process.env.MAIL_ENCRYPTION ?? "").trim().toLowerCase();

  const secure =
    String(process.env.MAIL_SECURE ?? "").trim() === "true" ||
    port === 465 ||
    encryption === "ssl" ||
    encryption === "tls";

  if (!host || !port || !user || !pass || !fromAddress) return null;
  return { host, port, secure, user, pass, fromAddress, fromName, encryption };
}

function getTransport(cfg: SmtpConfig): nodemailer.Transporter {
  const key = `${cfg.host}:${cfg.port}:${cfg.secure}:${cfg.user}:${cfg.fromAddress}:${cfg.fromName}`;
  if (cachedTransport && cachedKey === key) return cachedTransport;

  cachedTransport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass }
  });
  cachedKey = key;
  return cachedTransport;
}

export async function smtpSendMail(input: SmtpSendInput): Promise<{ ok: true; id?: string } | { ok: false; error: string }> {
  const cfg = readSmtpConfig();
  if (!cfg) return { ok: false, error: "SMTP not configured" };
  try {
    const transporter = getTransport(cfg);
    const info = await transporter.sendMail({
      from: `${cfg.fromName} <${cfg.fromAddress}>`,
      to: input.to,
      subject: input.subject,
      text: input.text,
      ...(input.html ? { html: input.html } : {}),
      ...(input.replyTo?.trim() ? { replyTo: input.replyTo.trim() } : {})
    });
    return { ok: true, id: typeof info.messageId === "string" ? info.messageId : undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

