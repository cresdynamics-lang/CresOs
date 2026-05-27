/**
 * Per-department Resend / SMTP sender identities.
 * Add addresses in Resend under the verified cresdynamics.com domain.
 */

export type EmailChannel = "default" | "finance" | "sales" | "director";

export type EmailSender = {
  from: string;
  replyTo: string;
};

const DEFAULT_FROM = "Cres Dynamics <info@cresdynamics.com>";
const DEFAULT_REPLY = "info@cresdynamics.com";
const FINANCE_FROM = "Cres Dynamics Finance <finance-noreply@cresdynamics.com>";
const FINANCE_REPLY = "info@cresdynamics.com";
const SALES_FROM = "Cres Dynamics Sales <sales-noreply@cresdynamics.com>";
const SALES_REPLY = "info@cresdynamics.com";
const DIRECTOR_FROM = "Cres Dynamics <director-noreply@cresdynamics.com>";
const DIRECTOR_REPLY = "info@cresdynamics.com";

function trimOrEmpty(v: string | undefined): string {
  return (v ?? "").trim();
}

export function getEmailSender(channel: EmailChannel = "default"): EmailSender {
  switch (channel) {
    case "finance":
      return {
        from: trimOrEmpty(process.env.RESEND_FROM_EMAIL_FINANCE) || FINANCE_FROM,
        replyTo: trimOrEmpty(process.env.RESEND_REPLY_TO_FINANCE) || FINANCE_REPLY
      };
    case "sales":
      return {
        from: trimOrEmpty(process.env.RESEND_FROM_EMAIL_SALES) || SALES_FROM,
        replyTo: trimOrEmpty(process.env.RESEND_REPLY_TO_SALES) || SALES_REPLY
      };
    case "director":
      return {
        from: trimOrEmpty(process.env.RESEND_FROM_EMAIL_DIRECTOR) || DIRECTOR_FROM,
        replyTo: trimOrEmpty(process.env.RESEND_REPLY_TO_DIRECTOR) || DIRECTOR_REPLY
      };
    default:
      return {
        from: trimOrEmpty(process.env.RESEND_FROM_EMAIL) || DEFAULT_FROM,
        replyTo: trimOrEmpty(process.env.RESEND_REPLY_TO) || DEFAULT_REPLY
      };
  }
}
