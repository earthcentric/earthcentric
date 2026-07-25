import nodemailer from "nodemailer";
import { getCredential } from "./credentials";


// Create transporter dynamically on-demand
async function createTransporter() {
  const smtpHost = await getCredential("SMTP_HOST");
  const smtpPort = parseInt(await getCredential("SMTP_PORT", "587"), 10);
  const smtpUser = await getCredential("SMTP_USER");
  const smtpPass = await getCredential("SMTP_PASS");

  const isConfigured = !!(smtpHost && smtpUser && smtpPass);
  
  if (isConfigured) {
    const maskedPass = smtpPass ? `${smtpPass[0]}...${smtpPass[smtpPass.length-1]} (${smtpPass.length} chars)` : "none";
    console.log(`[SMTP DEBUG] host=${smtpHost} port=${smtpPort} user=${smtpUser} pass=${maskedPass}`);
  } else {
    console.log(`[SMTP DEBUG] Not configured: host=${smtpHost} user=${smtpUser} pass=${smtpPass ? "present" : "missing"}`);
  }

  if (!isConfigured) return null;

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465, // true for 465, false for other ports
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
}


const getBaseUrl = () => process.env.NEXTAUTH_URL || "http://localhost:3000";

// ─── Base email template ───────────────────────────────────────────
function wrapInTemplate(bodyHtml: string): string {
  const baseUrl = getBaseUrl();
  return `
    <div style="font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: auto; padding: 0; border-radius: 16px; overflow: hidden; border: 1px solid #D8CEBE; background-color: #FFFFFF;">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #1F3A2E 0%, #2D5A40 100%); padding: 28px 32px; text-align: center;">
        <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 8px;">
          <div style="position: relative; display: inline-block;">
            <h1 style="color: #F5F1EA; font-size: 28px; font-family: sans-serif; font-weight: 900; margin: 0; letter-spacing: -0.5px; padding-right: 12px;">Earth Centric</h1>
            <span style="position: absolute; top: -22px; right: -16px; font-size: 28px;">🌿</span>
          </div>
        </div>
        <p style="color: rgba(245,241,234,0.65); font-size: 13px; margin: 8px 0 0 0; letter-spacing: 0.5px;">Premium Sustainable Marketplace</p>
      </div>
      <!-- Body -->
      <div style="padding: 32px 28px; color: #1A1A1A;">
        ${bodyHtml}
      </div>
      <!-- Footer -->
      <div style="background-color: #F5F1EA; padding: 20px 28px; border-top: 1px solid #D8CEBE; text-align: center;">
        <p style="font-size: 11px; color: #5A5A5A; margin: 0;">
          © ${new Date().getFullYear()} EarthCentric. Carbon-Neutral Operations Since Day One.
        </p>
        <p style="font-size: 10px; color: #8A8A8A; margin: 6px 0 0 0;">
          You are receiving this because of your activity on EarthCentric.
        </p>
      </div>
    </div>
  `;
}

const buttonStyle = `display: inline-block; padding: 12px 28px; background: linear-gradient(135deg, #1F3A2E 0%, #2D5A40 100%); color: #F5F1EA; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 13px;`;
const badgeStyle = `display: inline-block; background: rgba(163,177,138,0.2); color: #1F3A2E; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600;`;

// ─── Core send function ────────────────────────────────────────────
interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export async function sendEmail(payload: EmailPayload): Promise<{ success: boolean; id?: string; error?: string }> {
  const smtpFrom = await getCredential("SMTP_FROM", "EarthCentric <noreply@earthcentric.com>");
  const fromAddress = payload.from || smtpFrom;

  const transporter = await createTransporter();

  if (!transporter) {
    console.log("─────────────────────────────────────────");
    console.log(`[EMAIL SIMULATION] Sent to: ${payload.to}`);
    console.log(`Subject: ${payload.subject}`);
    console.log(`Body (Preview): ${payload.html.replace(/<[^>]*>/g, '').substring(0, 200).trim()}...`);
    console.log("─────────────────────────────────────────");
    return { success: true, id: `mock_email_${Date.now()}` };
  }

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    });
    console.log(`[EMAIL SENT] to=${payload.to} subject="${payload.subject}" messageId=${info.messageId}`);
    return { success: true, id: info.messageId };
  } catch (error: any) {
    console.error("Nodemailer email sending failed:", error);
    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║               ⚠️  SMTP LOG-IN / DELIVERY FAILED               ║");
    console.log("║  SMTP sending failed. Falling back to email simulation mode  ║");
    console.log("║  so you aren't blocked! Check the email content below:      ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");
    console.log("─────────────────────────────────────────");
    console.log(`[EMAIL SIMULATION (FALLBACK)] Sent to: ${payload.to}`);
    console.log(`Subject: ${payload.subject}`);
    console.log(`Body (Plaintext): ${payload.html.replace(/<[^>]*>/g, '').trim()}`);
    console.log("─────────────────────────────────────────\n");
    return { success: true, id: `fallback_mock_email_${Date.now()}` };
  }
}

// ─── Welcome Email ─────────────────────────────────────────────────
export async function sendWelcomeEmail(email: string, name: string) {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  return sendEmail({
    to: email,
    subject: "Welcome to EarthCentric — The Sustainable Marketplace",
    html: wrapInTemplate(`
      <h2 style="color: #1F3A2E; font-size: 22px; margin: 0 0 12px 0;">Welcome, ${name}! 🎉</h2>
      <p style="color: #333; font-size: 14px; line-height: 1.7; margin: 0 0 16px 0;">
        Thank you for joining our community of conscious buyers and verified sellers. We are dedicated to accelerating the transition to sustainable consumption.
      </p>
      <p style="color: #555; font-size: 13px; line-height: 1.6; margin: 0 0 20px 0;">
        Explore our marketplace to find premium eco-friendly goods, or verify your brand to begin selling ethical products.
      </p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${baseUrl}/marketplace" style="${buttonStyle}">Explore Marketplace →</a>
      </div>
    `),
  });
}

// ─── Forgot Password OTP Email ─────────────────────────────────────
export async function sendForgotPasswordOTPEmail(email: string, otpCode: string) {
  return sendEmail({
    to: email,
    subject: `Your EarthCentric Password Reset Code: ${otpCode}`,
    html: wrapInTemplate(`
      <h2 style="color: #1F3A2E; font-size: 22px; margin: 0 0 12px 0;">Password Reset Request</h2>
      <p style="color: #333; font-size: 14px; line-height: 1.7; margin: 0 0 8px 0;">
        We received a request to reset your password. Use the verification code below to proceed:
      </p>
      <div style="text-align: center; margin: 28px 0;">
        <div style="display: inline-block; background: linear-gradient(135deg, #1F3A2E 0%, #2D5A40 100%); border-radius: 16px; padding: 20px 36px;">
          <span style="font-size: 36px; font-weight: 800; letter-spacing: 12px; color: #F5F1EA; font-family: 'SF Mono', 'Fira Code', monospace;">${otpCode}</span>
        </div>
      </div>
      <p style="color: #888; font-size: 12px; text-align: center; margin: 0 0 16px 0;">
        This code expires in <strong>10 minutes</strong>. Do not share it with anyone.
      </p>
      <div style="background: #FFF8F0; border: 1px solid #F0E0C8; border-radius: 12px; padding: 14px 18px; margin: 16px 0;">
        <p style="color: #6B4F3A; font-size: 12px; margin: 0; line-height: 1.5;">
          ⚠️ If you did not request a password reset, please ignore this email. Your account remains secure.
        </p>
      </div>
    `),
  });
}

// ─── Buyer Registration OTP Email ─────────────────────────────────
export async function sendBuyerRegistrationOTPEmail(email: string, name: string, otpCode: string) {
  return sendEmail({
    to: email,
    subject: `Your EarthCentric Verification Code: ${otpCode}`,
    html: wrapInTemplate(`
      <h2 style="color: #1F3A2E; font-size: 22px; margin: 0 0 12px 0;">Verify Your Email, ${name}! 🌿</h2>
      <p style="color: #333; font-size: 14px; line-height: 1.7; margin: 0 0 8px 0;">
        Welcome to EarthCentric! To complete your registration as a Conscious Buyer, please enter the verification code below:
      </p>
      <div style="text-align: center; margin: 28px 0;">
        <div style="display: inline-block; background: linear-gradient(135deg, #1F3A2E 0%, #2D5A40 100%); border-radius: 16px; padding: 20px 36px;">
          <span style="font-size: 36px; font-weight: 800; letter-spacing: 12px; color: #F5F1EA; font-family: 'SF Mono', 'Fira Code', monospace;">${otpCode}</span>
        </div>
      </div>
      <p style="color: #888; font-size: 12px; text-align: center; margin: 0 0 16px 0;">
        This code expires in <strong>10 minutes</strong>. Do not share it with anyone.
      </p>
      <div style="background: #E8F5E9; border: 1px solid #C8E6C9; border-radius: 12px; padding: 14px 18px; margin: 16px 0;">
        <p style="color: #2E7D32; font-size: 12px; margin: 0; line-height: 1.5;">
          🌱 By verifying your email, you're one step closer to shopping from verified sustainable brands on EarthCentric.
        </p>
      </div>
      <div style="background: #FFF8F0; border: 1px solid #F0E0C8; border-radius: 12px; padding: 14px 18px; margin: 16px 0;">
        <p style="color: #6B4F3A; font-size: 12px; margin: 0; line-height: 1.5;">
          ⚠️ If you did not start this registration, please ignore this email.
        </p>
      </div>
    `),
  });
}

// ─── Order Confirmation Email ──────────────────────────────────────
export async function sendOrderConfirmationEmail(email: string, orderId: string, totalAmount: number) {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  return sendEmail({
    to: email,
    subject: `Order Confirmed — #${orderId} | EarthCentric`,
    html: wrapInTemplate(`
      <div style="text-align: center; margin-bottom: 20px;">
        <span style="${badgeStyle}">🌿 Carbon-Neutral Order</span>
      </div>
      <h2 style="color: #1F3A2E; font-size: 22px; margin: 0 0 12px 0; text-align: center;">Your order is confirmed! ✓</h2>
      <p style="color: #333; font-size: 14px; line-height: 1.7; margin: 0 0 20px 0; text-align: center;">
        Thank you for purchasing sustainable goods from EarthCentric. Every purchase supports verified ethical manufacturers.
      </p>
      <div style="background: #F5F1EA; border-radius: 12px; padding: 18px 22px; margin: 16px 0;">
        <table style="width: 100%; font-size: 13px; color: #333;">
          <tr>
            <td style="padding: 6px 0; color: #888;">Order ID</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 700; font-family: monospace;">${orderId}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #888;">Amount Paid</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #1F3A2E;">₹${totalAmount.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #888;">Shipping</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #2D8F4E;">Carbon-Offset (FREE)</td>
          </tr>
        </table>
      </div>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${baseUrl}/orders/${orderId}" style="${buttonStyle}">Track Your Order →</a>
      </div>
    `),
  });
}

// ─── Order Status Update / Delivery Alert Email ────────────────────
export async function sendOrderStatusEmail(
  email: string,
  orderId: string,
  status: string,
  description: string
) {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  
  const statusConfig: Record<string, { emoji: string; color: string; title: string }> = {
    CONFIRMED: { emoji: "✅", color: "#2D8F4E", title: "Order Confirmed" },
    PACKED: { emoji: "📦", color: "#6B4F3A", title: "Order Packed" },
    SHIPPED: { emoji: "🚚", color: "#1F3A2E", title: "Order Shipped" },
    DELIVERED: { emoji: "🎉", color: "#2D8F4E", title: "Order Delivered!" },
    CANCELLED: { emoji: "❌", color: "#CC3333", title: "Order Cancelled" },
    RETURNED: { emoji: "↩️", color: "#CC6600", title: "Return Initiated" },
    REFUNDED: { emoji: "💸", color: "#6B4F3A", title: "Refund Processed" },
  };

  const config = statusConfig[status] || { emoji: "📋", color: "#1F3A2E", title: `Order Update: ${status}` };

  return sendEmail({
    to: email,
    subject: `${config.emoji} ${config.title} — Order #${orderId}`,
    html: wrapInTemplate(`
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="display: inline-block; width: 56px; height: 56px; border-radius: 50%; background: ${config.color}15; line-height: 56px; font-size: 28px;">
          ${config.emoji}
        </div>
      </div>
      <h2 style="color: ${config.color}; font-size: 22px; margin: 0 0 8px 0; text-align: center;">${config.title}</h2>
      <p style="color: #888; font-size: 12px; text-align: center; margin: 0 0 20px 0;">Order #${orderId}</p>
      <div style="background: #F5F1EA; border-radius: 12px; padding: 18px 22px; margin: 16px 0;">
        <p style="color: #333; font-size: 14px; line-height: 1.7; margin: 0;">
          ${description}
        </p>
      </div>
      ${status === "SHIPPED" ? `
        <div style="background: #E8F5E9; border: 1px solid #C8E6C9; border-radius: 12px; padding: 14px 18px; margin: 16px 0;">
          <p style="color: #2E7D32; font-size: 12px; margin: 0; line-height: 1.5;">
            🌱 Your order is being shipped via our carbon-offset logistics partner. 100% of shipping emissions have been compensated through certified forestry initiatives.
          </p>
        </div>
      ` : ""}
      ${status === "DELIVERED" ? `
        <div style="background: #E8F5E9; border: 1px solid #C8E6C9; border-radius: 12px; padding: 14px 18px; margin: 16px 0;">
          <p style="color: #2E7D32; font-size: 12px; margin: 0; line-height: 1.5;">
            ♻️ Please recycle or compost the FSC-recycled packaging. No synthetic materials were used in shipping.
          </p>
        </div>
      ` : ""}
      <div style="text-align: center; margin: 24px 0;">
        <a href="${baseUrl}/orders/${orderId}" style="${buttonStyle}">View Order Details →</a>
      </div>
    `),
  });
}

// ─── Seller Verification Update Email ──────────────────────────────
export async function sendSellerVerificationUpdateEmail(
  email: string,
  companyName: string,
  status: "APPROVED" | "REJECTED",
  reason?: string
) {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const isApproved = status === "APPROVED";

  const bodyHtml = isApproved
    ? `
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="display: inline-block; width: 56px; height: 56px; border-radius: 50%; background: #E8F5E9; line-height: 56px; font-size: 28px;">🏆</div>
      </div>
      <h2 style="color: #1F3A2E; font-size: 22px; margin: 0 0 12px 0; text-align: center;">Congratulations, ${companyName}!</h2>
      <p style="color: #333; font-size: 14px; line-height: 1.7; margin: 0 0 16px 0; text-align: center;">
        Your application to become an EarthCentric verified seller has been <strong style="color: #2D8F4E;">approved</strong>.
      </p>
      <div style="background: #E8F5E9; border-radius: 12px; padding: 16px 22px; margin: 16px 0; text-align: center;">
        <span style="display: inline-block; background: #2D8F4E; color: white; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: 700;">✓ Verified Business Badge Assigned</span>
      </div>
      <p style="color: #555; font-size: 13px; line-height: 1.6; margin: 0 0 20px 0;">
        You can now log into your Seller Dashboard to add sustainable products to our marketplace catalog.
      </p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${baseUrl}/seller/dashboard" style="${buttonStyle}">Go to Seller Dashboard →</a>
      </div>
    `
    : `
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="display: inline-block; width: 56px; height: 56px; border-radius: 50%; background: #FFF3E0; line-height: 56px; font-size: 28px;">📋</div>
      </div>
      <h2 style="color: #6B4F3A; font-size: 22px; margin: 0 0 12px 0; text-align: center;">Verification Update</h2>
      <p style="color: #333; font-size: 14px; line-height: 1.7; margin: 0 0 16px 0;">
        Unfortunately, your seller verification request for <strong>${companyName}</strong> was not approved at this time.
      </p>
      ${reason ? `
        <div style="background: #FFF8F0; border: 1px solid #F0E0C8; border-radius: 12px; padding: 16px 22px; margin: 16px 0;">
          <p style="color: #6B4F3A; font-size: 13px; margin: 0;"><strong>Reason from Admin:</strong></p>
          <p style="color: #6B4F3A; font-size: 13px; margin: 6px 0 0 0; line-height: 1.6;">${reason}</p>
        </div>
      ` : ""}
      <p style="color: #555; font-size: 13px; line-height: 1.6; margin: 0 0 20px 0;">
        Please review your details and re-upload valid documents (GST, PAN, or certifications) to resubmit for review.
      </p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${baseUrl}/seller/verification" style="display: inline-block; padding: 12px 28px; background: #6B4F3A; color: #F5F1EA; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 13px;">Update Documents →</a>
      </div>
    `;

  return sendEmail({
    to: email,
    subject: isApproved
      ? "🏆 Seller Verification Approved! | EarthCentric"
      : "📋 Seller Verification Action Required | EarthCentric",
    html: wrapInTemplate(bodyHtml),
  });
}

// ─── Payout Settlement Notification Email ──────────────────────────
export async function sendPayoutSettledEmail(
  email: string,
  companyName: string,
  amount: number,
  notes?: string
) {
  return sendEmail({
    to: email,
    subject: `💰 Payout Settled — ₹${amount.toFixed(2)} | EarthCentric`,
    html: wrapInTemplate(`
      <h2 style="color: #1F3A2E; font-size: 22px; margin: 0 0 12px 0;">Payout Confirmed, ${companyName}!</h2>
      <p style="color: #333; font-size: 14px; line-height: 1.7; margin: 0 0 20px 0;">
        Your withdrawal request has been processed and the funds have been settled to your registered bank account.
      </p>
      <div style="background: #F5F1EA; border-radius: 12px; padding: 18px 22px; margin: 16px 0;">
        <table style="width: 100%; font-size: 13px; color: #333;">
          <tr>
            <td style="padding: 6px 0; color: #888;">Amount Settled</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #2D8F4E; font-size: 16px;">₹${amount.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #888;">Status</td>
            <td style="padding: 6px 0; text-align: right;"><span style="display: inline-block; background: #2D8F4E; color: white; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600;">SETTLED</span></td>
          </tr>
          ${notes ? `
          <tr>
            <td style="padding: 6px 0; color: #888;">Notes</td>
            <td style="padding: 6px 0; text-align: right; font-size: 12px;">${notes}</td>
          </tr>
          ` : ""}
        </table>
      </div>
    `),
  });
}

// ─── Newsletter Subscription Confirmation ──────────────────────────
export async function sendNewsletterConfirmation(email: string) {
  return sendEmail({
    to: email,
    subject: "🌿 You're In — EarthCentric Newsletter",
    html: wrapInTemplate(`
      <h2 style="color: #1F3A2E; font-size: 22px; margin: 0 0 12px 0; text-align: center;">Welcome to the Movement! 🌍</h2>
      <p style="color: #333; font-size: 14px; line-height: 1.7; margin: 0 0 16px 0; text-align: center;">
        You've successfully subscribed to EarthCentric sustainability updates. We'll send you curated insights on eco-commerce, new verified brands, and exclusive offers.
      </p>
      <div style="text-align: center; margin: 8px 0;">
        <span style="${badgeStyle}">♻️ Carbon-Neutral Subscriber</span>
      </div>
    `),
  });
}
