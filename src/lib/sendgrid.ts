import { getCredential } from "./credentials";
import { sendEmail } from "./email";

export interface SendGridEmailOptions {
  to: string;
  subject: string;
  html: string;
  fromEmail?: string;
  fromName?: string;
}

export interface SendGridEmailResult {
  success: boolean;
  provider: "sendgrid-api" | "smtp-fallback" | "simulated";
  messageId?: string;
  error?: string;
}

/**
 * Sends an email using SendGrid v3 REST API.
 * Falls back to nodemailer SMTP if SendGrid API key is not configured or encounters delivery failure,
 * ensuring buyer onboarding is never blocked in dev/test while strictly adhering to SendGrid production requirements.
 */
export async function sendEmailWithSendGrid(options: SendGridEmailOptions): Promise<SendGridEmailResult> {
  const apiKey = await getCredential("SENDGRID_API_KEY");
  const configuredFromEmail = await getCredential(
    "SENDGRID_FROM_EMAIL",
    process.env.SMTP_USER || "noreply@earthcentric.com"
  );
  const configuredFromName = await getCredential("SENDGRID_FROM_NAME", "EarthCentric");

  const fromEmail = options.fromEmail || configuredFromEmail;
  const fromName = options.fromName || configuredFromName;

  // 1. If SendGrid API Key is provided, use SendGrid Mail Send v3 API
  if (apiKey && apiKey.trim() !== "") {
    try {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [
            {
              to: [{ email: options.to.trim().toLowerCase() }],
            },
          ],
          from: {
            email: fromEmail.trim(),
            name: fromName.trim(),
          },
          subject: options.subject,
          content: [
            {
              type: "text/html",
              value: options.html,
            },
          ],
        }),
      });

      if (response.status === 202) {
        const messageId = response.headers.get("x-message-id") || `sg_${Date.now()}`;
        return {
          success: true,
          provider: "sendgrid-api",
          messageId,
        };
      }

      const errorText = await response.text();
      console.warn(`[SendGrid API Error status=${response.status}]: ${errorText.substring(0, 300)}`);
      // Fall through to SMTP fallback below
    } catch (err: any) {
      console.warn("[SendGrid API Request Exception]:", err?.message || err);
      // Fall through to SMTP fallback below
    }
  }

  // 2. Fallback to existing configured SMTP (e.g. Gmail SMTP in .env) or simulated
  try {
    const smtpResult = await sendEmail({
      to: options.to,
      subject: options.subject,
      html: options.html,
      from: `${fromName} <${fromEmail}>`,
    });

    return {
      success: smtpResult.success,
      provider: smtpResult.isMock ? "simulated" : "smtp-fallback",
      messageId: smtpResult.id,
      error: smtpResult.error,
    };
  } catch (smtpErr: any) {
    console.error("[Email Delivery Error]:", smtpErr?.message || smtpErr);
    return {
      success: false,
      provider: "smtp-fallback",
      error: "Failed to deliver email. Please check your email configuration.",
    };
  }
}

/**
 * Builds the EarthCentric professional branded email template for Buyer OTP verification.
 * Does NOT log or expose the OTP code.
 */
export function buildBuyerOtpEmailHtml(otpCode: string, recipientName?: string, customReturnUrl?: string): string {
  const safeName = recipientName ? recipientName.trim() : "";
  const year = new Date().getFullYear();
  const rawBaseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "https://earthcentric-2ug9.vercel.app";
  const baseUrl = rawBaseUrl.replace(/\/+$/, "");
  const returnUrl = customReturnUrl || `${baseUrl}/auth/buyer-login?step=otp`;

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; border-radius: 16px; overflow: hidden; border: 1px solid #D8CEBE; background-color: #FFFFFF;">
      <!-- Header with EarthCentric Brand -->
      <div style="background: linear-gradient(135deg, #1F3A2E 0%, #2D5A40 100%); padding: 32px 28px; text-align: center;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin: 0 auto; text-align: center;">
          <tr>
            <td align="center" style="padding-bottom: 6px;">
              <span style="color: #F5F1EA; font-size: 26px; font-weight: 800; letter-spacing: 0.5px; display: inline-block;">
                🌿 EarthCentric
              </span>
            </td>
          </tr>
          <tr>
            <td align="center">
              <p style="color: rgba(245,241,234,0.8); font-size: 11px; margin: 0; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 600;">
                Premium Sustainable Marketplace
              </p>
            </td>
          </tr>
        </table>
      </div>

      <!-- Main Content -->
      <div style="padding: 36px 32px; color: #1A1A1A;">
        <div style="text-align: center; margin-bottom: 20px;">
          <span style="display: inline-block; background: rgba(31,58,46,0.08); color: #1F3A2E; padding: 6px 14px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px;">
            MANDATORY BUYER VERIFICATION
          </span>
        </div>

        <h2 style="color: #1F3A2E; font-size: 22px; margin: 0 0 12px 0; text-align: center; font-weight: 800;">
          Verify Your Buyer Account
        </h2>

        <p style="color: #4A4A4A; font-size: 14px; line-height: 1.7; margin: 0 0 16px 0; text-align: center;">
          Welcome${safeName ? ` <strong>${safeName}</strong>` : ""} to EarthCentric! To protect our sustainable marketplace community and access verified product listings, please enter the verification code below:
        </p>

        <!-- Big OTP Display -->
        <div style="text-align: center; margin: 28px 0;">
          <div style="display: inline-block; background: linear-gradient(135deg, #1F3A2E 0%, #2D5A40 100%); border-radius: 16px; padding: 18px 36px; box-shadow: 0 8px 24px rgba(31,58,46,0.18);">
            <span style="font-size: 36px; font-weight: 800; letter-spacing: 12px; color: #F5F1EA; font-family: 'SF Mono', 'Fira Code', 'Courier New', monospace; display: inline-block; margin-left: 12px;">
              ${otpCode}
            </span>
          </div>
        </div>

        <p style="color: #666666; font-size: 13px; text-align: center; margin: 0 0 20px 0;">
          ⏱️ This one-time code expires in <strong>5 minutes</strong>. Do not share it with anyone.
        </p>

        <!-- Direct Return Button -->
        <div style="text-align: center; margin: 24px 0;">
          <a href="${returnUrl}" style="display: inline-block; background-color: #0F6E56; color: #FFFFFF; font-weight: 700; font-size: 14px; padding: 12px 28px; border-radius: 10px; text-decoration: none; box-shadow: 0 4px 12px rgba(15,110,86,0.25);">
            Enter Code on EarthCentric →
          </a>
        </div>

        <!-- Informational Callout -->
        <div style="background: #F5F1EA; border: 1px solid #E4DDD2; border-radius: 12px; padding: 16px 20px; margin: 20px 0;">
          <p style="color: #1F3A2E; font-size: 12px; margin: 0; line-height: 1.6;">
            🌱 <strong>Why authentication is required:</strong> EarthCentric connects conscious buyers directly with vetted, ethical manufacturers. Verifying your Google account and mobile number ensures order security, prevents unauthorized inquiries, and enables carbon-neutral shipping tracking.
          </p>
        </div>

        <div style="background: #FFF8F0; border: 1px solid #F0E0C8; border-radius: 12px; padding: 12px 18px; margin: 16px 0;">
          <p style="color: #8C5E35; font-size: 11px; margin: 0; line-height: 1.5;">
            ⚠️ If you did not initiate this verification, please disregard this email. Your EarthCentric account remains secure.
          </p>
        </div>
      </div>

      <!-- Footer -->
      <div style="background-color: #F5F1EA; padding: 22px 28px; border-top: 1px solid #D8CEBE; text-align: center;">
        <p style="font-size: 11px; color: #5A5A5A; margin: 0; font-weight: 600;">
          © ${year} EarthCentric. Carbon-Neutral Operations Since Day One.
        </p>
        <p style="font-size: 10px; color: #8A8A8A; margin: 6px 0 0 0;">
          Delivered securely via SendGrid for EarthCentric Buyer Authentication.
        </p>
      </div>
    </div>
  `;
}

