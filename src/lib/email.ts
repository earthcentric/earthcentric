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
      <!-- Header with Earth Centric Logo -->
      <div style="background: linear-gradient(135deg, #1F3A2E 0%, #2D5A40 100%); padding: 24px 28px; text-align: center;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin: 0 auto; text-align: center;">
          <tr>
            <td align="center" style="padding-bottom: 8px;">
              <a href="${baseUrl}" target="_blank" style="text-decoration: none; display: inline-block;">
                <img src="${baseUrl}/logo.png" alt="Earth Centric" width="180" style="width: 180px; max-width: 80%; height: auto; display: block; margin: 0 auto;" />
              </a>
            </td>
          </tr>
          <tr>
            <td align="center">
              <p style="color: rgba(245,241,234,0.75); font-size: 11px; margin: 0; letter-spacing: 1px; text-transform: uppercase; font-weight: 600;">
                Premium Sustainable Marketplace
              </p>
            </td>
          </tr>
        </table>
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

export async function sendEmail(payload: EmailPayload): Promise<{ success: boolean; id?: string; error?: string; isMock?: boolean }> {
  const smtpFrom = await getCredential("SMTP_FROM", "EarthCentric <noreply@earthcentric.com>");
  const fromAddress = payload.from || smtpFrom;

  const transporter = await createTransporter();

  if (!transporter) {
    console.log("─────────────────────────────────────────");
    console.log(`[EMAIL SIMULATION] Sent to: ${payload.to}`);
    console.log(`Subject: ${payload.subject}`);
    console.log(`Body (Preview): ${payload.html.replace(/<[^>]*>/g, '').substring(0, 200).trim()}...`);
    console.log("─────────────────────────────────────────");
    return { success: true, id: `mock_email_${Date.now()}`, isMock: true };
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
    return { success: true, id: `fallback_mock_email_${Date.now()}`, isMock: true, error: error.message || String(error) };
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
export interface OrderConfirmationItem {
  name: string;
  quantity: number;
  price: number;
  image?: string;
  sellerName?: string;
}

export interface OrderConfirmationData {
  orderId: string;
  buyerName?: string;
  totalAmount: number;
  items?: OrderConfirmationItem[];
  shippingAddress?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  paymentMethod?: string;
  placedAt?: Date | string;
}

export async function sendOrderConfirmationEmail(
  email: string,
  orderId: string,
  totalAmount: number,
  extra?: Partial<OrderConfirmationData>
) {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const data: OrderConfirmationData = {
    orderId,
    totalAmount,
    buyerName: extra?.buyerName,
    items: extra?.items || [],
    shippingAddress: extra?.shippingAddress,
    paymentMethod: extra?.paymentMethod,
    placedAt: extra?.placedAt || new Date(),
  };

  const placedDateStr = data.placedAt
    ? new Date(data.placedAt).toLocaleDateString("en-IN", {
        day: "2-digit", month: "long", year: "numeric",
        hour: "2-digit", minute: "2-digit", hour12: true,
      })
    : new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });

  const shortId = orderId.length > 14 ? `${orderId.substring(0, 14)}…` : orderId;

  // ── Items table rows ──
  const itemRowsHtml = (data.items && data.items.length > 0)
    ? data.items.map((item) => `
      <tr style="border-bottom: 1px solid #E8E2D9;">
        <td style="padding: 12px 8px; vertical-align: middle;">
          ${item.image
            ? `<img src="${item.image}" alt="${item.name}" width="48" height="48" style="border-radius: 8px; object-fit: cover; border: 1px solid #E8E2D9;" />`
            : `<div style="width: 48px; height: 48px; border-radius: 8px; background: #EEF0EC; display: flex; align-items: center; justify-content: center; font-size: 20px;">🌿</div>`}
        </td>
        <td style="padding: 12px 8px; vertical-align: middle;">
          <p style="margin: 0; font-size: 13px; font-weight: 700; color: #1F3A2E;">${item.name}</p>
          ${item.sellerName ? `<p style="margin: 2px 0 0 0; font-size: 11px; color: #888;">by ${item.sellerName}</p>` : ""}
          <p style="margin: 2px 0 0 0; font-size: 11px; color: #888;">Qty: ${item.quantity}</p>
        </td>
        <td style="padding: 12px 8px; vertical-align: middle; text-align: right; font-size: 13px; font-weight: 700; color: #1F3A2E; white-space: nowrap;">
          ₹${(item.price * item.quantity).toFixed(2)}
        </td>
      </tr>
    `).join("")
    : `<tr><td colspan="3" style="padding: 16px 8px; text-align: center; color: #888; font-size: 12px;">Order items will appear in your account dashboard.</td></tr>`;

  // ── Address block ──
  const addr = data.shippingAddress;
  const addressHtml = addr
    ? `
      <div style="background: #F5F1EA; border-radius: 12px; padding: 14px 18px; margin: 16px 0;">
        <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.5px;">📦 Shipping Address</p>
        <p style="margin: 0; font-size: 13px; color: #1F3A2E; line-height: 1.6;">
          ${[addr.street, addr.city, addr.state, addr.postalCode, addr.country].filter(Boolean).join(", ")}
        </p>
      </div>
    `
    : "";

  const bodyHtml = `
    <!-- Order status badge -->
    <div style="text-align: center; margin-bottom: 16px;">
      <span style="${badgeStyle}">🌿 Verified Carbon-Neutral Order</span>
    </div>

    <!-- Confirmation badge -->
    <div style="text-align: center; margin-bottom: 16px;">
      <div style="display: inline-block; width: 64px; height: 64px; border-radius: 50%; background: linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%); line-height: 64px; font-size: 32px; border: 2px solid #A5D6A7; text-align: center;">✅</div>
    </div>

    <h2 style="color: #1F3A2E; font-size: 22px; margin: 0 0 6px 0; text-align: center; font-weight: 800;">
      Order Confirmed!
    </h2>
    <p style="color: #555; font-size: 14px; text-align: center; margin: 0 0 4px 0;">
      ${data.buyerName ? `Hi <strong>${data.buyerName}</strong>, thank you` : "Thank you"} for shopping sustainably. 🌿
    </p>
    <p style="color: #888; font-size: 12px; text-align: center; margin: 0 0 24px 0;">
      Your order is confirmed and has been sent to the supplier for fulfillment.
    </p>

    <!-- Order Summary Card -->
    <div style="background: linear-gradient(135deg, #1F3A2E 0%, #2D5A40 100%); border-radius: 14px; padding: 16px 20px; margin: 0 0 20px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <p style="margin: 0; font-size: 10px; color: rgba(245,241,234,0.6); text-transform: uppercase; letter-spacing: 1px;">Order ID</p>
            <p style="margin: 4px 0 0 0; font-size: 15px; font-weight: 800; color: #F5F1EA; font-family: 'SF Mono', 'Fira Code', monospace;">${shortId}</p>
          </td>
          <td style="text-align: right;">
            <p style="margin: 0; font-size: 10px; color: rgba(245,241,234,0.6); text-transform: uppercase; letter-spacing: 1px;">Total Paid</p>
            <p style="margin: 4px 0 0 0; font-size: 20px; font-weight: 800; color: #A5D6A7;">₹${totalAmount.toFixed(2)}</p>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="padding-top: 10px;">
            <p style="margin: 0; font-size: 11px; color: rgba(245,241,234,0.5);">Placed on ${placedDateStr}</p>
          </td>
        </tr>
      </table>
    </div>

    <!-- Items Table -->
    ${(data.items && data.items.length > 0) ? `
    <div style="margin: 0 0 20px 0;">
      <p style="margin: 0 0 10px 0; font-size: 12px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.5px;">🛍️ Items Ordered</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; border: 1px solid #E8E2D9; border-radius: 12px; overflow: hidden;">
        ${itemRowsHtml}
        <tr style="background: #F5F1EA;">
          <td colspan="2" style="padding: 12px 8px; font-size: 13px; font-weight: 700; color: #1F3A2E; text-align: right;">Total</td>
          <td style="padding: 12px 8px; font-size: 15px; font-weight: 800; color: #1F3A2E; text-align: right; white-space: nowrap;">₹${totalAmount.toFixed(2)}</td>
        </tr>
      </table>
    </div>
    ` : ""}

    <!-- Order Details Grid -->
    <div style="background: #F5F1EA; border-radius: 12px; padding: 16px 18px; margin: 0 0 20px 0;">
      <table width="100%" cellpadding="0" cellspacing="4" style="font-size: 13px;">
        <tr>
          <td style="color: #888; padding: 5px 0; width: 50%;">Order ID</td>
          <td style="color: #1F3A2E; font-weight: 700; font-family: monospace; padding: 5px 0; text-align: right; font-size: 12px;">${orderId}</td>
        </tr>
        <tr>
          <td style="color: #888; padding: 5px 0;">Amount Paid</td>
          <td style="color: #2D8F4E; font-weight: 800; padding: 5px 0; text-align: right;">₹${totalAmount.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="color: #888; padding: 5px 0;">Shipping</td>
          <td style="color: #2D8F4E; font-weight: 600; padding: 5px 0; text-align: right;">Carbon-Offset (FREE)</td>
        </tr>
        ${data.paymentMethod ? `
        <tr>
          <td style="color: #888; padding: 5px 0;">Payment</td>
          <td style="color: #1F3A2E; font-weight: 600; padding: 5px 0; text-align: right;">${data.paymentMethod}</td>
        </tr>
        ` : ""}
      </table>
    </div>

    <!-- Shipping Address -->
    ${addressHtml}

    <!-- Eco Pledge Banner -->
    <div style="background: linear-gradient(135deg, #E8F5E9 0%, #F1F8F1 100%); border: 1px solid #C8E6C9; border-radius: 12px; padding: 14px 18px; margin: 16px 0;">
      <p style="color: #2E7D32; font-size: 12px; margin: 0; line-height: 1.6; text-align: center;">
        🌱 <strong>Your purchase plants a difference.</strong> Every order on EarthCentric supports verified sustainable manufacturers and 100% carbon-offset shipping through certified forestry initiatives.
      </p>
    </div>

    <!-- CTA Button -->
    <div style="text-align: center; margin: 24px 0 8px 0;">
      <a href="${baseUrl}/orders/${orderId}" style="${buttonStyle}">
        Track My Order →
      </a>
    </div>
    <p style="text-align: center; margin: 12px 0 0 0; font-size: 11px; color: #888;">
      Questions? Reply to this email or visit our <a href="${baseUrl}/marketplace" style="color: #2D8F4E; text-decoration: none;">Help Centre</a>
    </p>
  `;

  return sendEmail({
    to: email,
    subject: `✅ Order Confirmed — #${shortId} | EarthCentric`,
    html: wrapInTemplate(bodyHtml),
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

// ─── EMAIL 2 — CANCELLATION REQUEST RECEIVED ───────────────────────
export async function sendCancellationRequestedEmail(
  email: string,
  data: {
    orderId: string;
    customerName?: string;
    items?: Array<{ name: string; quantity: number; price?: number }>;
    refundAmount: number;
    requestDate?: Date | string;
  }
) {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const formattedDate = data.requestDate
    ? new Date(data.requestDate).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });

  const firstItem = data.items?.[0];
  const itemsSummary = data.items && data.items.length > 0
    ? data.items.map((it) => `${it.name} (Qty: ${it.quantity})`).join(", ")
    : "Order Items";

  return sendEmail({
    to: email,
    subject: "Your Earth Centric Cancellation Request Has Been Received",
    html: wrapInTemplate(`
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="display: inline-block; width: 56px; height: 56px; border-radius: 50%; background: #FFF3E0; line-height: 56px; font-size: 28px;">⏳</div>
      </div>
      <h2 style="color: #1F3A2E; font-size: 22px; margin: 0 0 8px 0; text-align: center;">Cancellation Request Received</h2>
      <p style="color: #555; font-size: 14px; line-height: 1.7; margin: 0 0 16px 0;">
        Hello ${data.customerName || "Valued Customer"},
      </p>
      <p style="color: #333; font-size: 14px; line-height: 1.7; margin: 0 0 16px 0;">
        We have received your cancellation request for Order <strong>#${data.orderId}</strong>.
      </p>
      <div style="background: #F5F1EA; border-radius: 12px; padding: 18px 22px; margin: 16px 0;">
        <table style="width: 100%; font-size: 13px; color: #333;">
          <tr>
            <td style="padding: 6px 0; color: #888; width: 45%;">Order ID</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 700; font-family: monospace;">#${data.orderId}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #888;">Product(s)</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 600;">${itemsSummary}</td>
          </tr>
          ${firstItem ? `
          <tr>
            <td style="padding: 6px 0; color: #888;">Quantity</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 600;">${firstItem.quantity}</td>
          </tr>
          ` : ""}
          <tr>
            <td style="padding: 6px 0; color: #888;">Requested Refund</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 800; color: #2D8F4E; font-size: 15px;">₹${data.refundAmount.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #888;">Request Date</td>
            <td style="padding: 6px 0; text-align: right;">${formattedDate}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #888;">Decision Timeline</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #D97706;">Expected within 24–48 hours</td>
          </tr>
        </table>
      </div>
      <p style="color: #555; font-size: 13px; line-height: 1.6; margin: 16px 0;">
        Our team will review your request and provide a decision within <strong>24–48 hours</strong>.
      </p>
      <p style="color: #555; font-size: 13px; line-height: 1.6; margin: 0 0 24px 0;">
        You can check your order and cancellation status anytime from your Earth Centric account.
      </p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${baseUrl}/orders/${data.orderId}" style="${buttonStyle}">View Order & Request Status →</a>
      </div>
      <p style="color: #888; font-size: 12px; text-align: center; margin-top: 20px;">
        Thank you,<br/>
        <strong>Earth Centric Support Team</strong>
      </p>
    `),
  });
}

// ─── EMAIL 3 — CANCELLATION APPROVED ───────────────────────────────
export async function sendCancellationApprovedEmail(
  email: string,
  data: {
    orderId: string;
    customerName?: string;
    items?: Array<{ name: string; quantity: number; price?: number }>;
    approvedAmount: number;
    approvalDate?: Date | string;
    refundStatus: string;
    refundInitiated?: boolean;
  }
) {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const formattedDate = data.approvalDate
    ? new Date(data.approvalDate).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });

  const refundNotice = data.refundInitiated
    ? "The refund has been initiated through our secure payment gateway and is being processed (expected within 24–48 hours, subject to your bank's processing timelines)."
    : "The refund request has been queued and is awaiting gateway initiation.";

  return sendEmail({
    to: email,
    subject: "Your Earth Centric Cancellation Request Has Been Approved",
    html: wrapInTemplate(`
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="display: inline-block; width: 56px; height: 56px; border-radius: 50%; background: #E8F5E9; line-height: 56px; font-size: 28px;">✅</div>
      </div>
      <h2 style="color: #1F3A2E; font-size: 22px; margin: 0 0 8px 0; text-align: center;">Cancellation Approved</h2>
      <p style="color: #555; font-size: 14px; line-height: 1.7; margin: 0 0 16px 0;">
        Hello ${data.customerName || "Valued Customer"},
      </p>
      <p style="color: #333; font-size: 14px; line-height: 1.7; margin: 0 0 16px 0;">
        Your cancellation request for Order <strong>#${data.orderId}</strong> has been <strong>approved</strong> by our team.
      </p>
      <div style="background: #F5F1EA; border-radius: 12px; padding: 18px 22px; margin: 16px 0;">
        <table style="width: 100%; font-size: 13px; color: #333;">
          <tr>
            <td style="padding: 6px 0; color: #888; width: 45%;">Order ID</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 700; font-family: monospace;">#${data.orderId}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #888;">Approved Refund Amount</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 800; color: #2D8F4E; font-size: 15px;">₹${data.approvedAmount.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #888;">Approval Date</td>
            <td style="padding: 6px 0; text-align: right;">${formattedDate}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #888;">Refund Status</td>
            <td style="padding: 6px 0; text-align: right;"><span style="display: inline-block; background: #2D8F4E; color: white; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600;">INITIATED</span></td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #888;">Expected Timeline</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #1F3A2E;">24–48 hours</td>
          </tr>
        </table>
      </div>
      <div style="background: #E8F5E9; border: 1px solid #C8E6C9; border-radius: 12px; padding: 14px 18px; margin: 16px 0;">
        <p style="color: #2E7D32; font-size: 12px; margin: 0; line-height: 1.6;">
          ℹ️ <strong>Refund Processing:</strong> ${refundNotice}
        </p>
      </div>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${baseUrl}/orders/${data.orderId}" style="${buttonStyle}">Track Refund Progress →</a>
      </div>
      <p style="color: #888; font-size: 12px; text-align: center; margin-top: 20px;">
        Thank you for choosing Earth Centric.<br/>
        <strong>Earth Centric Support Team</strong>
      </p>
    `),
  });
}

// ─── EMAIL 4 — AUTOMATIC CANCELLATION WITHIN 24 HOURS ──────────────
export async function sendAutoCancellationEmail(
  email: string,
  data: {
    orderId: string;
    customerName?: string;
    items?: Array<{ name: string; quantity: number; price?: number }>;
    refundAmount: number;
    cancelDate?: Date | string;
  }
) {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const formattedDate = data.cancelDate
    ? new Date(data.cancelDate).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });

  return sendEmail({
    to: email,
    subject: "Your Earth Centric Order Has Been Cancelled",
    html: wrapInTemplate(`
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="display: inline-block; width: 56px; height: 56px; border-radius: 50%; background: #E8F5E9; line-height: 56px; font-size: 28px;">⚡</div>
      </div>
      <h2 style="color: #1F3A2E; font-size: 22px; margin: 0 0 8px 0; text-align: center;">Order Cancelled Automatically</h2>
      <p style="color: #555; font-size: 14px; line-height: 1.7; margin: 0 0 16px 0;">
        Hello ${data.customerName || "Valued Customer"},
      </p>
      <p style="color: #333; font-size: 14px; line-height: 1.7; margin: 0 0 16px 0;">
        As your cancellation request for Order <strong>#${data.orderId}</strong> was placed within 24 hours of order placement prior to dispatch, it has been <strong>automatically approved</strong> per our marketplace policy.
      </p>
      <div style="background: #F5F1EA; border-radius: 12px; padding: 18px 22px; margin: 16px 0;">
        <table style="width: 100%; font-size: 13px; color: #333;">
          <tr>
            <td style="padding: 6px 0; color: #888; width: 45%;">Order ID</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 700; font-family: monospace;">#${data.orderId}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #888;">Refund Amount</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 800; color: #2D8F4E; font-size: 15px;">₹${data.refundAmount.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #888;">Cancellation Date</td>
            <td style="padding: 6px 0; text-align: right;">${formattedDate}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #888;">Policy Trigger</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #2D8F4E;">Instant 24-Hour Approval</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #888;">Expected Refund Timeline</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #1F3A2E;">Within 24 hours</td>
          </tr>
        </table>
      </div>
      <div style="background: #E8F5E9; border: 1px solid #C8E6C9; border-radius: 12px; padding: 14px 18px; margin: 16px 0;">
        <p style="color: #2E7D32; font-size: 12px; margin: 0; line-height: 1.6;">
          💸 <strong>Refund Initiated:</strong> Your full refund of <strong>₹${data.refundAmount.toFixed(2)}</strong> has been initiated through Cashfree Payments. The credit is expected within 24 hours, subject to payment-provider and banking network processing.
        </p>
      </div>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${baseUrl}/orders/${data.orderId}" style="${buttonStyle}">View Cancellation Status →</a>
      </div>
      <p style="color: #888; font-size: 12px; text-align: center; margin-top: 20px;">
        Thank you,<br/>
        <strong>Earth Centric Support Team</strong>
      </p>
    `),
  });
}

// ─── EMAIL 5 — CANCELLATION REJECTED ───────────────────────────────
export async function sendCancellationRejectedEmail(
  email: string,
  data: {
    orderId: string;
    customerName?: string;
    rejectionReason: string;
    reviewDate?: Date | string;
  }
) {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const formattedDate = data.reviewDate
    ? new Date(data.reviewDate).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });

  return sendEmail({
    to: email,
    subject: "Update on Your Earth Centric Cancellation Request",
    html: wrapInTemplate(`
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="display: inline-block; width: 56px; height: 56px; border-radius: 50%; background: #FFF3E0; line-height: 56px; font-size: 28px;">📋</div>
      </div>
      <h2 style="color: #6B4F3A; font-size: 22px; margin: 0 0 8px 0; text-align: center;">Cancellation Request Update</h2>
      <p style="color: #555; font-size: 14px; line-height: 1.7; margin: 0 0 16px 0;">
        Hello ${data.customerName || "Valued Customer"},
      </p>
      <p style="color: #333; font-size: 14px; line-height: 1.7; margin: 0 0 16px 0;">
        Thank you for contacting us regarding Order <strong>#${data.orderId}</strong>. Following review, your cancellation request could not be approved.
      </p>
      <div style="background: #FFF8F0; border: 1px solid #F0E0C8; border-radius: 12px; padding: 18px 22px; margin: 16px 0;">
        <p style="color: #888; font-size: 12px; text-transform: uppercase; font-weight: 700; margin: 0 0 6px 0;">Reason for Rejection</p>
        <p style="color: #6B4F3A; font-size: 14px; line-height: 1.6; margin: 0; font-weight: 600;">
          ${data.rejectionReason}
        </p>
        <p style="color: #999; font-size: 11px; margin: 10px 0 0 0;">Decision recorded on ${formattedDate}</p>
      </div>
      <div style="background: #E8F5E9; border: 1px solid #C8E6C9; border-radius: 12px; padding: 14px 18px; margin: 16px 0;">
        <p style="color: #2E7D32; font-size: 12px; margin: 0; line-height: 1.6;">
          📦 <strong>Original Order Remains Active:</strong> Your order remains active and will continue through standard fulfillment and dispatch. Once delivered, you may request a return if the item is eligible under our return policy.
        </p>
      </div>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${baseUrl}/orders/${data.orderId}" style="${buttonStyle}">Track Order Progress →</a>
      </div>
      <p style="color: #888; font-size: 12px; text-align: center; margin-top: 20px;">
        If you have questions, please reach out through our support desk.<br/>
        <strong>Earth Centric Support Team</strong>
      </p>
    `),
  });
}

// ─── EMAIL 6 — REFUND COMPLETED ────────────────────────────────────
export async function sendRefundCompletedEmail(
  email: string,
  data: {
    orderId: string;
    customerName?: string;
    amount: number;
    refundReference?: string;
    completedDate?: Date | string;
  }
) {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const formattedDate = data.completedDate
    ? new Date(data.completedDate).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });

  return sendEmail({
    to: email,
    subject: "Your Earth Centric Refund Has Been Completed",
    html: wrapInTemplate(`
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="display: inline-block; width: 56px; height: 56px; border-radius: 50%; background: #E8F5E9; line-height: 56px; font-size: 28px;">💸</div>
      </div>
      <h2 style="color: #1F3A2E; font-size: 22px; margin: 0 0 8px 0; text-align: center;">Refund Completed Successfully</h2>
      <p style="color: #555; font-size: 14px; line-height: 1.7; margin: 0 0 16px 0;">
        Hello ${data.customerName || "Valued Customer"},
      </p>
      <p style="color: #333; font-size: 14px; line-height: 1.7; margin: 0 0 16px 0;">
        Your refund for Order <strong>#${data.orderId}</strong> has been successfully processed and completed by Cashfree Payments.
      </p>
      <div style="background: #F5F1EA; border-radius: 12px; padding: 18px 22px; margin: 16px 0;">
        <table style="width: 100%; font-size: 13px; color: #333;">
          <tr>
            <td style="padding: 6px 0; color: #888; width: 45%;">Order ID</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 700; font-family: monospace;">#${data.orderId}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #888;">Refund Amount</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 800; color: #2D8F4E; font-size: 16px;">₹${data.amount.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #888;">Refund Reference / ARN</td>
            <td style="padding: 6px 0; text-align: right; font-family: monospace; font-weight: 700;">${data.refundReference || "CF-REFUND-VERIFIED"}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #888;">Completion Date</td>
            <td style="padding: 6px 0; text-align: right;">${formattedDate}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #888;">Status</td>
            <td style="padding: 6px 0; text-align: right;"><span style="display: inline-block; background: #2D8F4E; color: white; padding: 2px 10px; border-radius: 10px; font-size: 11px; font-weight: 700;">COMPLETED</span></td>
          </tr>
        </table>
      </div>
      <p style="color: #555; font-size: 13px; line-height: 1.6; margin: 16px 0;">
        Depending on your issuing bank or card provider, the amount should reflect on your original payment source statement within 1–3 business days.
      </p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${baseUrl}/orders/${data.orderId}" style="${buttonStyle}">View Order Details →</a>
      </div>
      <p style="color: #888; font-size: 12px; text-align: center; margin-top: 20px;">
        Thank you for being part of Earth Centric's sustainable community.<br/>
        <strong>Earth Centric Finance Team</strong>
      </p>
    `),
  });
}

// ─── EMAIL 7 — REFUND DELAYED OR FAILED ────────────────────────────
export async function sendRefundFailedEmail(
  email: string,
  data: {
    orderId: string;
    customerName?: string;
    amount: number;
    errorDetail?: string;
  }
) {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  return sendEmail({
    to: email,
    subject: "Update Regarding Your Earth Centric Refund",
    html: wrapInTemplate(`
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="display: inline-block; width: 56px; height: 56px; border-radius: 50%; background: #FFF3E0; line-height: 56px; font-size: 28px;">⚠️</div>
      </div>
      <h2 style="color: #6B4F3A; font-size: 22px; margin: 0 0 8px 0; text-align: center;">Important Refund Processing Update</h2>
      <p style="color: #555; font-size: 14px; line-height: 1.7; margin: 0 0 16px 0;">
        Hello ${data.customerName || "Valued Customer"},
      </p>
      <p style="color: #333; font-size: 14px; line-height: 1.7; margin: 0 0 16px 0;">
        We are reaching out to let you know that the automated refund for Order <strong>#${data.orderId}</strong> (amounting to <strong>₹${data.amount.toFixed(2)}</strong>) encountered a delay with the banking network and requires manual assistance.
      </p>
      <div style="background: #FFF8F0; border: 1px solid #F0E0C8; border-radius: 12px; padding: 18px 22px; margin: 16px 0;">
        <p style="color: #6B4F3A; font-size: 13px; line-height: 1.6; margin: 0;">
          🛡️ <strong>Our Team Is on It:</strong> Our finance team has been automatically alerted and is manually reconciling your refund with the payment gateway to ensure it reaches your bank account safely. You do not need to take any action.
        </p>
      </div>
      <p style="color: #555; font-size: 13px; line-height: 1.6; margin: 16px 0;">
        We apologize for the delay. We will notify you via email the moment the refund transaction is completed.
      </p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${baseUrl}/orders/${data.orderId}" style="${buttonStyle}">Check Status in Your Account →</a>
      </div>
      <p style="color: #888; font-size: 12px; text-align: center; margin-top: 20px;">
        Earth Centric Support & Finance Team
      </p>
    `),
  });
}

